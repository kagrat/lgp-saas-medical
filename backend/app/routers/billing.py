"""
Module Facturation reelle (nouveau, chantier prioritaire du cahier des
charges de M. Faustin).

Remplace le "revenu estime" (simple calcul prix x nombre de rendez-vous)
par de vraies factures numerotees et un suivi reel des encaissements.
Isolation multi-tenant identique au reste du projet.

Choix technique: statut de facture et methode de paiement en texte simple
(pas d'Enum Postgres), meme principe deliberé que Room/Admission -
evite tout risque de ALTER TYPE plus tard.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Invoice, InvoiceLineItem, Payment, Patient, User, UserRole, AuditLog
from app.schemas import (
    InvoiceCreate, InvoiceOut, InvoiceSummaryOut, InvoiceLineItemOut,
    PaymentCreate, PaymentOut, BillingSummaryOut,
)
from app.deps import require_roles

router = APIRouter(prefix="/billing", tags=["facturation"])

BILLING_ROLES = (UserRole.ESTABLISHMENT_ADMIN, UserRole.ACCOUNTANT)


def _amount_paid(invoice: Invoice) -> float:
    return sum(p.amount for p in invoice.payments)


def _to_summary_out(invoice: Invoice) -> InvoiceSummaryOut:
    paid = _amount_paid(invoice)
    return InvoiceSummaryOut(
        id=invoice.id, invoice_number=invoice.invoice_number,
        patient_name=invoice.patient.user.full_name, status=invoice.status,
        total_amount=invoice.total_amount, amount_paid=paid,
        balance_due=round(invoice.total_amount - paid, 2), issued_at=invoice.issued_at,
    )


def _to_full_out(invoice: Invoice) -> InvoiceOut:
    paid = _amount_paid(invoice)
    return InvoiceOut(
        id=invoice.id, invoice_number=invoice.invoice_number,
        patient_id=invoice.patient_id, patient_name=invoice.patient.user.full_name,
        status=invoice.status, total_amount=invoice.total_amount,
        amount_paid=paid, balance_due=round(invoice.total_amount - paid, 2),
        notes=invoice.notes, issued_at=invoice.issued_at, due_date=invoice.due_date,
        line_items=[
            InvoiceLineItemOut(
                id=li.id, description=li.description, quantity=li.quantity,
                unit_price=li.unit_price, line_total=round(li.quantity * li.unit_price, 2),
            ) for li in invoice.line_items
        ],
        payments=[
            PaymentOut(
                id=p.id, amount=p.amount, payment_method=p.payment_method,
                reference=p.reference, recorded_by_name=p.recorded_by.full_name if p.recorded_by else "Inconnu",
                paid_at=p.paid_at,
            ) for p in invoice.payments
        ],
    )


def _generate_invoice_number(db: Session, establishment_id: str) -> str:
    """
    Numerotation sequentielle par etablissement et par annee (ex:
    FAC-2026-0001). LIMITE CONNUE: en cas de creation strictement
    simultanee de deux factures (meme milliseconde), un doublon de numero
    est theoriquement possible sous tres forte concurrence - acceptable
    pour le volume attendu, a revisiter avec un compteur dedie si le
    besoin grandit.
    """
    year = datetime.utcnow().year
    count = (
        db.query(Invoice)
        .filter(Invoice.establishment_id == establishment_id, Invoice.invoice_number.like(f"FAC-{year}-%"))
        .count()
    )
    return f"FAC-{year}-{count + 1:04d}"


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(*BILLING_ROLES))):
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    total = sum(li.quantity * li.unit_price for li in payload.line_items)

    invoice = Invoice(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        patient_id=payload.patient_id, issued_by_user_id=current_user.id,
        invoice_number=_generate_invoice_number(db, current_user.establishment_id),
        status="issued", total_amount=round(total, 2), notes=payload.notes,
        due_date=payload.due_date, appointment_id=payload.appointment_id, admission_id=payload.admission_id,
    )
    db.add(invoice)
    db.flush()

    for li in payload.line_items:
        db.add(InvoiceLineItem(
            id=str(uuid.uuid4()), invoice_id=invoice.id, description=li.description,
            quantity=li.quantity, unit_price=li.unit_price,
        ))

    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="create_invoice", details=f"Facture {invoice.invoice_number} - {patient.user.full_name} - {invoice.total_amount} FCFA"))
    db.commit()
    db.refresh(invoice)
    return _to_full_out(invoice)


@router.get("/invoices/establishment", response_model=list[InvoiceSummaryOut])
def list_invoices(invoice_status: str = None, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(*BILLING_ROLES))):
    query = db.query(Invoice).filter(Invoice.establishment_id == current_user.establishment_id)
    if invoice_status:
        query = query.filter(Invoice.status == invoice_status)
    invoices = query.order_by(Invoice.issued_at.desc()).all()
    return [_to_summary_out(i) for i in invoices]


@router.get("/invoices/mine", response_model=list[InvoiceSummaryOut])
def my_invoices(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """Le patient voit ses propres factures, tous etablissements confondus
    - meme principe que le dossier de sante (voir health_records.py)."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    invoices = db.query(Invoice).filter(Invoice.patient_id == patient.id).order_by(Invoice.issued_at.desc()).all()
    return [_to_summary_out(i) for i in invoices]


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: str, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(*BILLING_ROLES, UserRole.PATIENT))):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable")

    if current_user.role == UserRole.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or invoice.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a cette facture")
    elif invoice.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a cette facture")

    return _to_full_out(invoice)


@router.post("/invoices/{invoice_id}/payments", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def record_payment(invoice_id: str, payload: PaymentCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(*BILLING_ROLES))):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.establishment_id == current_user.establishment_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable")
    if invoice.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette facture est annulee")

    already_paid = _amount_paid(invoice)
    remaining = invoice.total_amount - already_paid
    if payload.amount > remaining + 0.01:  # tolerance flottante
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Le montant depasse le solde restant du ({round(remaining, 2)} FCFA)",
        )

    payment = Payment(
        id=str(uuid.uuid4()), invoice_id=invoice.id, amount=payload.amount,
        payment_method=payload.payment_method, reference=payload.reference,
        recorded_by_user_id=current_user.id,
    )
    db.add(payment)
    db.flush()

    new_total_paid = already_paid + payload.amount
    if new_total_paid >= invoice.total_amount - 0.01:
        invoice.status = "paid"
    else:
        invoice.status = "partially_paid"

    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="record_payment", details=f"Facture {invoice.invoice_number}: {payload.amount} FCFA ({payload.payment_method})"))
    db.commit()
    db.refresh(invoice)
    return _to_full_out(invoice)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceOut)
def cancel_invoice(invoice_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(*BILLING_ROLES))):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.establishment_id == current_user.establishment_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable")
    if invoice.payments:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Impossible d'annuler une facture avec des paiements enregistres")

    invoice.status = "cancelled"
    db.commit()
    db.refresh(invoice)
    return _to_full_out(invoice)


@router.get("/summary", response_model=BillingSummaryOut)
def billing_summary(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*BILLING_ROLES))):
    """NOUVEAU: rapport financier REEL, remplace le revenu ESTIME du
    tableau de bord existant (dashboard.py)."""
    invoices = db.query(Invoice).filter(
        Invoice.establishment_id == current_user.establishment_id, Invoice.status != "cancelled"
    ).all()

    total_invoiced = sum(i.total_amount for i in invoices)
    total_collected = sum(_amount_paid(i) for i in invoices)
    unpaid = [i for i in invoices if i.status != "paid"]

    return BillingSummaryOut(
        total_invoiced=round(total_invoiced, 2), total_collected=round(total_collected, 2),
        total_outstanding=round(total_invoiced - total_collected, 2),
        invoice_count=len(invoices), unpaid_invoice_count=len(unpaid),
    )

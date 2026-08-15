"""
Module 5 - Pharmacie: stock, suivi de commande detaille + statistiques
propres a la pharmacie (nouveau - remplace les cartes generiques RDV/
Medecins qui n'avaient pas de sens pour ce type d'etablissement).
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    PharmacyStock, PharmacyReservation, PharmacyReservationStatusHistory,
    Patient, User, UserRole, ReservationStatus, AuditLog,
)
from app.schemas import (
    StockItemCreate, StockItemOut, ReservationCreate, ReservationOut,
    ReservationStatusUpdate, ReservationHistoryOut, PharmacyStatsOut,
)
from app.deps import require_roles

router = APIRouter(prefix="/pharmacy", tags=["pharmacie"])


def _to_stock_out(item: PharmacyStock) -> StockItemOut:
    return StockItemOut(
        id=item.id, reference=item.reference, medication_name=item.medication_name, category=item.category,
        quantity=item.quantity, alert_threshold=item.alert_threshold, unit_price=item.unit_price,
        establishment_id=item.establishment_id, is_low_stock=item.quantity <= item.alert_threshold,
    )


def _to_reservation_out(reservation: PharmacyReservation) -> ReservationOut:
    return ReservationOut(
        id=reservation.id, establishment_id=reservation.establishment_id,
        patient_id=reservation.patient_id, medication_id=reservation.medication_id,
        medication_name=reservation.medication.medication_name,
        medication_reference=reservation.medication.reference,
        quantity=reservation.quantity, delivery_mode=reservation.delivery_mode,
        status=reservation.status, estimated_ready_at=reservation.estimated_ready_at,
        pharmacist_note=reservation.pharmacist_note, created_at=reservation.created_at,
    )


@router.post("/stock", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
def add_stock_item(payload: StockItemCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    existing_reference = (
        db.query(PharmacyStock)
        .filter(PharmacyStock.establishment_id == current_user.establishment_id, PharmacyStock.reference == payload.reference)
        .first()
    )
    if existing_reference:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette reference existe deja dans ton stock")

    item = PharmacyStock(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        reference=payload.reference, medication_name=payload.medication_name, category=payload.category,
        quantity=payload.quantity, alert_threshold=payload.alert_threshold, unit_price=payload.unit_price,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_stock_out(item)


@router.get("/stock", response_model=list[StockItemOut])
def list_stock(db: Session = Depends(get_db),
               current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    items = db.query(PharmacyStock).filter(PharmacyStock.establishment_id == current_user.establishment_id).all()
    return [_to_stock_out(i) for i in items]


@router.get("/search", response_model=list[StockItemOut])
def search_medication(name: str, db: Session = Depends(get_db)):
    items = (
        db.query(PharmacyStock)
        .filter(
            (PharmacyStock.medication_name.ilike(f"%{name}%")) | (PharmacyStock.reference.ilike(f"%{name}%")),
            PharmacyStock.quantity > 0,
        )
        .limit(50)
        .all()
    )
    return [_to_stock_out(i) for i in items]


@router.get("/stats", response_model=PharmacyStatsOut)
def pharmacy_stats(db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """NOUVEAU: statistiques propres a la pharmacie, remplace les cartes generiques RDV/Medecins."""
    establishment_id = current_user.establishment_id
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_orders = db.query(PharmacyReservation).filter(PharmacyReservation.establishment_id == establishment_id).count()
    orders_this_month = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == establishment_id, PharmacyReservation.created_at >= this_month_start)
        .count()
    )
    pending_orders = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == establishment_id, PharmacyReservation.status == ReservationStatus.PENDING)
        .count()
    )
    low_stock_items = (
        db.query(PharmacyStock)
        .filter(PharmacyStock.establishment_id == establishment_id, PharmacyStock.quantity <= PharmacyStock.alert_threshold)
        .count()
    )

    return PharmacyStatsOut(
        total_orders=total_orders,
        orders_this_month=orders_this_month,
        pending_orders=pending_orders,
        low_stock_items=low_stock_items,
    )


@router.get("/reservations/mine", response_model=list[ReservationOut])
def my_reservations(db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    reservations = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.patient_id == patient.id)
        .order_by(PharmacyReservation.created_at.desc())
        .all()
    )
    return [_to_reservation_out(r) for r in reservations]


@router.get("/reservations/establishment", response_model=list[ReservationOut])
def establishment_reservations(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    reservations = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == current_user.establishment_id)
        .order_by(PharmacyReservation.created_at.desc())
        .all()
    )
    return [_to_reservation_out(r) for r in reservations]


@router.get("/reservations/{reservation_id}/history", response_model=list[ReservationHistoryOut])
def reservation_history(reservation_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(
                             UserRole.PATIENT, UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")

    if current_user.role == UserRole.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or reservation.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    else:
        if reservation.establishment_id != current_user.establishment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    history = (
        db.query(PharmacyReservationStatusHistory)
        .filter(PharmacyReservationStatusHistory.reservation_id == reservation_id)
        .order_by(PharmacyReservationStatusHistory.created_at.asc())
        .all()
    )
    return [
        ReservationHistoryOut(id=h.id, status=h.status, note=h.note, created_at=h.created_at)
        for h in history
    ]


@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.PATIENT))):
    stock_item = db.query(PharmacyStock).filter(PharmacyStock.id == payload.medication_id).first()
    if not stock_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicament introuvable")
    if stock_item.quantity < payload.quantity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stock insuffisant pour cette quantite")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    reservation = PharmacyReservation(
        id=str(uuid.uuid4()), establishment_id=stock_item.establishment_id,
        patient_id=patient.id, medication_id=stock_item.id,
        quantity=payload.quantity, delivery_mode=payload.delivery_mode,
        status=ReservationStatus.PENDING,
    )
    stock_item.quantity -= payload.quantity
    db.add(reservation)
    db.flush()

    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=ReservationStatus.PENDING, note="Commande recue", changed_by_user_id=current_user.id,
    ))
    db.add(AuditLog(user_id=current_user.id, establishment_id=stock_item.establishment_id,
                     action="create_reservation", details=f"Reservation {payload.quantity}x {stock_item.medication_name}"))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)


@router.patch("/reservations/{reservation_id}/status", response_model=ReservationOut)
def update_reservation_status(reservation_id: str, payload: ReservationStatusUpdate, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or reservation.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")

    reservation.status = payload.status
    if payload.estimated_ready_at is not None:
        reservation.estimated_ready_at = payload.estimated_ready_at
    if payload.note is not None:
        reservation.pharmacist_note = payload.note

    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=payload.status, note=payload.note, changed_by_user_id=current_user.id,
    ))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)

"""
Module 5 - Pharmacie: gestion du stock (cote etablissement) et
reservations patients (cote portail web).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PharmacyStock, PharmacyReservation, Patient, User, UserRole, ReservationStatus, AuditLog
from app.schemas import StockItemCreate, StockItemOut, ReservationCreate, ReservationOut
from app.deps import require_roles

router = APIRouter(prefix="/pharmacy", tags=["pharmacie"])


def _to_stock_out(item: PharmacyStock) -> StockItemOut:
    return StockItemOut(
        id=item.id, medication_name=item.medication_name, category=item.category,
        quantity=item.quantity, alert_threshold=item.alert_threshold, unit_price=item.unit_price,
        establishment_id=item.establishment_id, is_low_stock=item.quantity <= item.alert_threshold,
    )


@router.post("/stock", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
def add_stock_item(payload: StockItemCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    item = PharmacyStock(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        medication_name=payload.medication_name, category=payload.category,
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
    """Recherche publique - pharmacie en ligne, comparaison entre pharmacies adherentes."""
    items = (
        db.query(PharmacyStock)
        .filter(PharmacyStock.medication_name.ilike(f"%{name}%"), PharmacyStock.quantity > 0)
        .limit(50)
        .all()
    )
    return [_to_stock_out(i) for i in items]


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
    )
    # On decremente le stock immediatement pour eviter la survente
    # (transaction geree par la session SQLAlchemy - commit atomique ci-dessous).
    stock_item.quantity -= payload.quantity
    db.add(reservation)
    db.add(AuditLog(user_id=current_user.id, establishment_id=stock_item.establishment_id,
                     action="create_reservation", details=f"Reservation {payload.quantity}x {stock_item.medication_name}"))
    db.commit()
    db.refresh(reservation)
    return reservation


@router.patch("/reservations/{reservation_id}/status", response_model=ReservationOut)
def update_reservation_status(reservation_id: str, new_status: ReservationStatus, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or reservation.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    reservation.status = new_status
    db.commit()
    db.refresh(reservation)
    return reservation

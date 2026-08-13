"""
Module "Tables globales Super Admin" (nouveau).

Zero risque de schema: ces routes ne font QUE lire des tables deja
existantes, sous un angle "toute la plateforme" au lieu de "un seul
etablissement". Aucune nouvelle colonne, aucune nouvelle table.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Appointment, PharmacyReservation, Doctor, Establishment, EstablishmentType, User, UserRole,
)
from app.schemas import (
    GlobalAppointmentOut, GlobalOrderOut, GlobalDoctorOut, GlobalEstablishmentSummaryOut,
)
from app.deps import require_roles

router = APIRouter(prefix="/platform", tags=["super-admin-tables"])


@router.get("/appointments", response_model=list[GlobalAppointmentOut])
def all_appointments(limit: int = 200, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    limit = max(1, min(limit, 500))
    appointments = db.query(Appointment).order_by(Appointment.scheduled_at.desc()).limit(limit).all()
    results = []
    for a in appointments:
        results.append(GlobalAppointmentOut(
            id=a.id,
            patient_name=a.patient.user.full_name if a.patient else "Inconnu",
            doctor_name=a.doctor.user.full_name if a.doctor else "Inconnu",
            establishment_name=a.establishment.name if a.establishment else "Inconnu",
            scheduled_at=a.scheduled_at, status=a.status,
        ))
    return results


@router.get("/orders", response_model=list[GlobalOrderOut])
def all_orders(limit: int = 200, db: Session = Depends(get_db),
               current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    limit = max(1, min(limit, 500))
    orders = db.query(PharmacyReservation).order_by(PharmacyReservation.created_at.desc()).limit(limit).all()
    results = []
    for o in orders:
        results.append(GlobalOrderOut(
            id=o.id,
            patient_name=o.patient.user.full_name if o.patient else "Inconnu",
            medication_name=o.medication.medication_name if o.medication else "Inconnu",
            establishment_name=o.establishment.name if o.establishment else "Inconnu",
            quantity=o.quantity, status=o.status, created_at=o.created_at,
        ))
    return results


@router.get("/doctors", response_model=list[GlobalDoctorOut])
def all_doctors(db: Session = Depends(get_db),
                current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    doctors = db.query(Doctor).order_by(Doctor.specialty).all()
    results = []
    for d in doctors:
        results.append(GlobalDoctorOut(
            id=d.id, full_name=d.user.full_name, specialty=d.specialty,
            establishment_name=d.establishment.name if d.establishment else "Inconnu",
            is_active=d.is_active,
        ))
    return results


@router.get("/pharmacies", response_model=list[GlobalEstablishmentSummaryOut])
def all_pharmacies(db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    return _establishment_summaries(db, EstablishmentType.PHARMACIE)


@router.get("/laboratories", response_model=list[GlobalEstablishmentSummaryOut])
def all_laboratories(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    return _establishment_summaries(db, EstablishmentType.LABORATOIRE)


def _establishment_summaries(db: Session, est_type: EstablishmentType) -> list[GlobalEstablishmentSummaryOut]:
    establishments = db.query(Establishment).filter(Establishment.type == est_type).order_by(Establishment.name).all()
    results = []
    for e in establishments:
        admin = db.query(User).filter(User.establishment_id == e.id, User.role == UserRole.ESTABLISHMENT_ADMIN).first()
        results.append(GlobalEstablishmentSummaryOut(
            id=e.id, name=e.name, city=e.city, is_active=e.is_active,
            subscription_status=e.subscription_status, admin_email=admin.email if admin else None,
        ))
    return results

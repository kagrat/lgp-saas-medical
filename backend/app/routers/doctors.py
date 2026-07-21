"""
Module 4 - Gestion des medecins.
Creation reservee a establishment_admin (jamais d'auto-inscription medecin).
Recherche publique ouverte a tous (portail patient).
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Doctor, User, UserRole, DoctorAvailability, DoctorAbsence, Establishment
from app.schemas import DoctorCreate, DoctorOut, DoctorAvailabilityCreate, DoctorAbsenceCreate, DoctorAvailabilityOut
from app.deps import require_roles, get_current_user
from app.security import hash_password

router = APIRouter(prefix="/doctors", tags=["medecins"])


@router.post("", response_model=DoctorOut, status_code=status.HTTP_201_CREATED)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est deja utilise")

    user = User(
        id=str(uuid.uuid4()),
        establishment_id=current_user.establishment_id,
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.DOCTOR,
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        id=str(uuid.uuid4()),
        user_id=user.id,
        establishment_id=current_user.establishment_id,
        specialty=payload.specialty,
        consultation_price=payload.consultation_price,
        bio=payload.bio,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return DoctorOut(
        id=doctor.id, full_name=user.full_name, phone=user.phone, specialty=doctor.specialty,
        consultation_price=doctor.consultation_price, bio=doctor.bio,
        photo_url=doctor.photo_url, establishment_id=doctor.establishment_id,
        is_active=doctor.is_active,
    )


@router.get("/search", response_model=list[DoctorOut])
def search_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    establishment_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Recherche publique - module 'Recherche et decouverte' du portail patient."""
    query = db.query(Doctor).join(Establishment).filter(Doctor.is_active == True, Establishment.is_active == True)
    if specialty:
        query = query.filter(Doctor.specialty.ilike(f"%{specialty}%"))
    if city:
        query = query.filter(Establishment.city.ilike(f"%{city}%"))
    if establishment_id:
        query = query.filter(Doctor.establishment_id == establishment_id)

    results = []
    for doctor in query.limit(50).all():
        results.append(DoctorOut(
            id=doctor.id, full_name=doctor.user.full_name, phone=doctor.user.phone, specialty=doctor.specialty,
            consultation_price=doctor.consultation_price, bio=doctor.bio,
            photo_url=doctor.photo_url, establishment_id=doctor.establishment_id,
            is_active=doctor.is_active,
        ))
    return results


@router.get("/establishment", response_model=list[DoctorOut])
def list_establishment_doctors(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY))):
    """Liste des medecins de l'etablissement courant (isolation tenant stricte)."""
    doctors = db.query(Doctor).filter(Doctor.establishment_id == current_user.establishment_id).all()
    return [DoctorOut(
        id=d.id, full_name=d.user.full_name, phone=d.user.phone, specialty=d.specialty,
        consultation_price=d.consultation_price, bio=d.bio, photo_url=d.photo_url,
        establishment_id=d.establishment_id, is_active=d.is_active,
    ) for d in doctors]


@router.post("/{doctor_id}/availabilities", status_code=status.HTTP_201_CREATED)
def add_availability(doctor_id: str, payload: DoctorAvailabilityCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    availability = DoctorAvailability(
        id=str(uuid.uuid4()), doctor_id=doctor.id,
        day_of_week=payload.day_of_week, start_time=payload.start_time,
        end_time=payload.end_time, slot_duration_minutes=payload.slot_duration_minutes,
    )
    db.add(availability)
    db.commit()
    return {"message": "Disponibilite ajoutee"}


@router.get("/{doctor_id}/availabilities", response_model=list[DoctorAvailabilityOut])
def list_availabilities(doctor_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    return (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.doctor_id == doctor.id)
        .order_by(DoctorAvailability.day_of_week, DoctorAvailability.start_time)
        .all()
    )


@router.delete("/{doctor_id}/availabilities/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(doctor_id: str, availability_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    availability = (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.id == availability_id, DoctorAvailability.doctor_id == doctor.id)
        .first()
    )
    if not availability:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disponibilite introuvable")
    db.delete(availability)
    db.commit()


@router.post("/{doctor_id}/absences", status_code=status.HTTP_201_CREATED)
def add_absence(doctor_id: str, payload: DoctorAbsenceCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    absence = DoctorAbsence(
        id=str(uuid.uuid4()), doctor_id=doctor.id,
        start_date=payload.start_date, end_date=payload.end_date, reason=payload.reason,
    )
    db.add(absence)
    db.commit()
    return {"message": "Absence enregistree"}


def _get_doctor_in_scope(db: Session, doctor_id: str, current_user: User) -> Doctor:
    """Verifie l'isolation tenant: un admin ne peut modifier que les medecins de SON etablissement."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")
    if doctor.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a ce medecin")
    return doctor

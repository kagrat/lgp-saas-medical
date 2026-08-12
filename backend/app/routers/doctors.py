"""
Module 4 - Gestion des medecins + Notes/avis + page profil public (nouveau).
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Doctor, User, UserRole, DoctorAvailability, DoctorAbsence, Establishment,
    DoctorReview, Patient, Appointment, AppointmentStatus,
)
from app.schemas import (
    DoctorCreate, DoctorOut, DoctorAvailabilityCreate, DoctorAbsenceCreate,
    DoctorAvailabilityOut, DoctorReviewCreate, DoctorReviewOut, DoctorDetailOut,
)
from app.deps import require_roles, get_current_user
from app.security import hash_password

router = APIRouter(prefix="/doctors", tags=["medecins"])


def _rating_stats(db: Session, doctor_id: str) -> tuple[Optional[float], int]:
    avg_rating, count = (
        db.query(func.avg(DoctorReview.rating), func.count(DoctorReview.id))
        .filter(DoctorReview.doctor_id == doctor_id)
        .first()
    )
    return (round(avg_rating, 1) if avg_rating is not None else None), (count or 0)


def _to_doctor_out(db: Session, doctor: Doctor) -> DoctorOut:
    avg_rating, review_count = _rating_stats(db, doctor.id)
    return DoctorOut(
        id=doctor.id, full_name=doctor.user.full_name, phone=doctor.user.phone, specialty=doctor.specialty,
        consultation_price=doctor.consultation_price, bio=doctor.bio, photo_url=doctor.photo_url,
        establishment_id=doctor.establishment_id, is_active=doctor.is_active,
        average_rating=avg_rating, review_count=review_count,
    )


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
    return _to_doctor_out(db, doctor)


@router.get("/search", response_model=list[DoctorOut])
def search_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    establishment_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Doctor).join(Establishment).filter(Doctor.is_active == True, Establishment.is_active == True)
    if specialty:
        query = query.filter(Doctor.specialty.ilike(f"%{specialty}%"))
    if city:
        query = query.filter(Establishment.city.ilike(f"%{city}%"))
    if establishment_id:
        query = query.filter(Doctor.establishment_id == establishment_id)

    return [_to_doctor_out(db, doctor) for doctor in query.limit(50).all()]


@router.get("/{doctor_id}/profile", response_model=DoctorDetailOut)
def doctor_public_profile(doctor_id: str, db: Session = Depends(get_db)):
    """NOUVEAU: fiche publique complete d'un medecin (page profil patient)."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    establishment = db.query(Establishment).filter(Establishment.id == doctor.establishment_id).first()
    avg_rating, review_count = _rating_stats(db, doctor.id)

    return DoctorDetailOut(
        id=doctor.id, full_name=doctor.user.full_name, phone=doctor.user.phone, specialty=doctor.specialty,
        consultation_price=doctor.consultation_price, bio=doctor.bio, photo_url=doctor.photo_url,
        establishment_id=doctor.establishment_id, is_active=doctor.is_active,
        average_rating=avg_rating, review_count=review_count,
        establishment_name=establishment.name if establishment else "Inconnu",
        establishment_city=establishment.city if establishment else "",
        establishment_address=establishment.address if establishment else None,
    )


@router.get("/establishment", response_model=list[DoctorOut])
def list_establishment_doctors(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY))):
    doctors = db.query(Doctor).filter(Doctor.establishment_id == current_user.establishment_id).all()
    return [_to_doctor_out(db, d) for d in doctors]


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


@router.post("/{doctor_id}/reviews", response_model=DoctorReviewOut, status_code=status.HTTP_201_CREATED)
def create_or_update_review(doctor_id: str, payload: DoctorReviewCreate, db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles(UserRole.PATIENT))):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    has_completed_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.patient_id == patient.id,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
        .first()
    )
    if not has_completed_appointment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu ne peux laisser un avis qu'apres un rendez-vous termine avec ce medecin.",
        )

    existing_review = (
        db.query(DoctorReview)
        .filter(DoctorReview.doctor_id == doctor_id, DoctorReview.patient_id == patient.id)
        .first()
    )
    if existing_review:
        existing_review.rating = payload.rating
        existing_review.comment = payload.comment
        db.commit()
        db.refresh(existing_review)
        review = existing_review
    else:
        review = DoctorReview(
            id=str(uuid.uuid4()), doctor_id=doctor_id, patient_id=patient.id,
            rating=payload.rating, comment=payload.comment,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    return DoctorReviewOut(
        id=review.id, doctor_id=review.doctor_id, patient_id=review.patient_id,
        patient_name=current_user.full_name, rating=review.rating,
        comment=review.comment, created_at=review.created_at,
    )


@router.get("/{doctor_id}/reviews", response_model=list[DoctorReviewOut])
def list_reviews(doctor_id: str, db: Session = Depends(get_db)):
    reviews = (
        db.query(DoctorReview)
        .filter(DoctorReview.doctor_id == doctor_id)
        .order_by(DoctorReview.created_at.desc())
        .all()
    )
    return [
        DoctorReviewOut(
            id=r.id, doctor_id=r.doctor_id, patient_id=r.patient_id,
            patient_name=r.patient.user.full_name, rating=r.rating,
            comment=r.comment, created_at=r.created_at,
        )
        for r in reviews
    ]


@router.get("/reviewable")
def list_reviewable_appointments(db: Session = Depends(get_db),
                                  current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []

    completed_doctor_ids = (
        db.query(Appointment.doctor_id)
        .filter(Appointment.patient_id == patient.id, Appointment.status == AppointmentStatus.COMPLETED)
        .distinct()
        .all()
    )
    results = []
    for (doctor_id,) in completed_doctor_ids:
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if not doctor:
            continue
        existing_review = (
            db.query(DoctorReview)
            .filter(DoctorReview.doctor_id == doctor_id, DoctorReview.patient_id == patient.id)
            .first()
        )
        results.append({
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.full_name,
            "specialty": doctor.specialty,
            "existing_rating": existing_review.rating if existing_review else None,
            "existing_comment": existing_review.comment if existing_review else None,
        })
    return results


def _get_doctor_in_scope(db: Session, doctor_id: str, current_user: User) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")
    if doctor.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a ce medecin")
    return doctor

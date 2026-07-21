"""
Module 3 - Gestion des rendez-vous + moteur de suggestion automatique.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, Doctor, Patient, User, UserRole, AppointmentStatus, AuditLog
from app.schemas import (
    AppointmentCreate, AppointmentOut, AppointmentSearchRequest, AppointmentSearchResponse
)
from app.deps import require_roles, get_current_user
from app.services.suggestion_engine import find_appointment_or_suggest

router = APIRouter(prefix="/appointments", tags=["rendez-vous"])


@router.post("/search", response_model=AppointmentSearchResponse)
def search_appointment_slots(payload: AppointmentSearchRequest, db: Session = Depends(get_db)):
    """
    Etape 1-2 du moteur de suggestion (section 6): le patient decrit ce qu'il
    veut, le systeme verifie la disponibilite et renvoie soit une confirmation
    immediate possible, soit des suggestions alternatives.
    """
    requested_doctor_id = None
    if payload.establishment_id and payload.preferred_time:
        # si un seul medecin de la specialite dans l'etablissement, on le cible directement
        doctor = (
            db.query(Doctor)
            .filter(Doctor.establishment_id == payload.establishment_id, Doctor.specialty == payload.specialty)
            .first()
        )
        requested_doctor_id = doctor.id if doctor else None

    exact_match, suggestions = find_appointment_or_suggest(
        db=db,
        specialty=payload.specialty,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
        city=payload.city,
        establishment_id=payload.establishment_id,
        requested_doctor_id=requested_doctor_id,
    )
    return AppointmentSearchResponse(exact_match_available=exact_match, suggestions=suggestions)


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """Etape 5 (section 6): le patient choisit et confirme en un clic."""
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    # Alerte de conflit d'horaire (module 3): re-verification cote serveur,
    # jamais uniquement cote client, pour eviter les doubles reservations
    # en cas de requetes simultanees.
    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_at == payload.scheduled_at,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce creneau vient d'etre pris. Merci de choisir un autre creneau suggere.",
        )

    appointment = Appointment(
        id=str(uuid.uuid4()),
        establishment_id=doctor.establishment_id,
        doctor_id=doctor.id,
        patient_id=patient.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
    )
    db.add(appointment)
    db.add(AuditLog(user_id=current_user.id, establishment_id=doctor.establishment_id,
                     action="create_appointment", details=f"RDV cree pour patient {patient.dossier_number}"))
    db.commit()
    db.refresh(appointment)
    # NOTE: l'envoi de la confirmation email/SMS (module "Notifications") se
    # branche ici via app/services/notifications.py - voir README, section
    # "SMS et email" pour le cablage avec un vrai fournisseur.
    return appointment


@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """Espace patient: historique + RDV a venir."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Appointment).filter(Appointment.patient_id == patient.id).order_by(Appointment.scheduled_at.desc()).all()


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")

    # Isolation: un patient ne peut annuler que SON rdv; un staff etablissement
    # ne peut annuler que les rdv de SON etablissement.
    if current_user.role == UserRole.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or appointment.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    elif current_user.role in (UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR):
        if appointment.establishment_id != current_user.establishment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    appointment.status = AppointmentStatus.CANCELLED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="cancel_appointment", details=f"RDV {appointment.id} annule"))
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/establishment", response_model=list[AppointmentOut])
def establishment_appointments(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    """Module 3 - calendrier des RDV de l'etablissement (vue admin/secretaire/medecin)."""
    query = db.query(Appointment).filter(Appointment.establishment_id == current_user.establishment_id)
    if current_user.role == UserRole.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doctor:
            query = query.filter(Appointment.doctor_id == doctor.id)
    return query.order_by(Appointment.scheduled_at.asc()).all()

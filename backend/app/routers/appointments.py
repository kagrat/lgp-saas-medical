"""
Module 3 - Gestion des rendez-vous + moteur de suggestion automatique.

NOUVEAU: chaque rendez-vous renvoie desormais le nom du patient
(patient_name) - jusqu'ici, la liste des RDV cote etablissement
n'affichait que la date et le statut, sans jamais dire de qui il
s'agissait. Corrige via une fonction commune reutilisee partout dans ce
fichier, pour garantir que ce champ est toujours rempli correctement.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, Doctor, Patient, User, UserRole, AppointmentStatus, AuditLog
from app.schemas import (
    AppointmentCreate, AppointmentOut, AppointmentSearchRequest, AppointmentSearchResponse, AppointmentReschedule
)
from app.deps import require_roles, get_current_user
from app.services.suggestion_engine import find_appointment_or_suggest

router = APIRouter(prefix="/appointments", tags=["rendez-vous"])


def _to_appointment_out(appointment: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=appointment.id,
        establishment_id=appointment.establishment_id,
        doctor_id=appointment.doctor_id,
        patient_id=appointment.patient_id,
        patient_name=appointment.patient.user.full_name if appointment.patient else "Inconnu",
        scheduled_at=appointment.scheduled_at,
        duration_minutes=appointment.duration_minutes,
        status=appointment.status,
        notes=appointment.notes,
    )


@router.post("/search", response_model=AppointmentSearchResponse)
def search_appointment_slots(payload: AppointmentSearchRequest, db: Session = Depends(get_db)):
    requested_doctor_id = payload.doctor_id

    if not requested_doctor_id and payload.establishment_id and payload.preferred_time:
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
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

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
    return _to_appointment_out(appointment)


@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    appointments = db.query(Appointment).filter(Appointment.patient_id == patient.id).order_by(Appointment.scheduled_at.desc()).all()
    return [_to_appointment_out(a) for a in appointments]


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")

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
    return _to_appointment_out(appointment)


@router.post("/{appointment_id}/arrive", response_model=AppointmentOut)
def mark_arrived(appointment_id: str, db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(
                      UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seul un rendez-vous confirme peut etre marque arrive")

    appointment.status = AppointmentStatus.ARRIVED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="mark_arrived", details=f"RDV {appointment.id} marque arrive"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(appointment_id: str, payload: AppointmentReschedule, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    if appointment.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce rendez-vous ne peut plus etre reporte")

    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_at == payload.new_scheduled_at,
            Appointment.id != appointment.id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Le medecin a deja un rendez-vous a ce nouveau creneau")

    old_time = appointment.scheduled_at
    appointment.scheduled_at = payload.new_scheduled_at
    appointment.status = AppointmentStatus.CONFIRMED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="reschedule_appointment",
                     details=f"RDV {appointment.id} reporte de {old_time} a {payload.new_scheduled_at}"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.post("/{appointment_id}/complete", response_model=AppointmentOut)
def complete_appointment(appointment_id: str, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(
                              UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    if appointment.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seul un rendez-vous confirme ou arrive peut etre marque termine")

    appointment.status = AppointmentStatus.COMPLETED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="complete_appointment", details=f"RDV {appointment.id} marque termine"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.get("/establishment", response_model=list[AppointmentOut])
def establishment_appointments(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    query = db.query(Appointment).filter(Appointment.establishment_id == current_user.establishment_id)
    if current_user.role == UserRole.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doctor:
            query = query.filter(Appointment.doctor_id == doctor.id)
    appointments = query.order_by(Appointment.scheduled_at.asc()).all()
    return [_to_appointment_out(a) for a in appointments]

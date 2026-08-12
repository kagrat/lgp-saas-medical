"""
Module "Repertoire patients" + "Mes proches" (nouveau).

Principe d'isolation: un membre du staff ne voit que les patients ayant
une relation reelle avec SON etablissement (rendez-vous, commande
pharmacie, ou demande d'analyse) - meme regle que pour la messagerie.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Patient, User, UserRole, Appointment, PharmacyReservation, LabTestRequest, Dependent,
)
from app.schemas import PatientDirectoryOut, DependentCreate, DependentOut
from app.deps import require_roles

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/establishment", response_model=list[PatientDirectoryOut])
def establishment_patient_directory(search: Optional[str] = None, db: Session = Depends(get_db),
                                     current_user: User = Depends(require_roles(
                                         UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    establishment_id = current_user.establishment_id

    patient_ids = set()
    for row in db.query(Appointment.patient_id).filter(Appointment.establishment_id == establishment_id).distinct():
        patient_ids.add(row[0])
    for row in db.query(PharmacyReservation.patient_id).filter(PharmacyReservation.establishment_id == establishment_id).distinct():
        patient_ids.add(row[0])
    for row in db.query(LabTestRequest.patient_id).filter(LabTestRequest.establishment_id == establishment_id).distinct():
        patient_ids.add(row[0])

    if not patient_ids:
        return []

    query = db.query(Patient).filter(Patient.id.in_(patient_ids))
    patients = query.all()

    results = []
    for patient in patients:
        if search and search.strip():
            if search.strip().lower() not in patient.user.full_name.lower():
                continue
        last_appointment = (
            db.query(Appointment)
            .filter(Appointment.patient_id == patient.id, Appointment.establishment_id == establishment_id)
            .order_by(Appointment.scheduled_at.desc())
            .first()
        )
        results.append(PatientDirectoryOut(
            id=patient.id, full_name=patient.user.full_name, email=patient.user.email,
            phone=patient.user.phone, dossier_number=patient.dossier_number,
            last_visit=last_appointment.scheduled_at if last_appointment else None,
        ))

    results.sort(key=lambda p: p.full_name)
    return results


# ---------- MES PROCHES (nouveau) ----------

@router.post("/dependents", response_model=DependentOut, status_code=status.HTTP_201_CREATED)
def add_dependent(payload: DependentCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    dependent = Dependent(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        full_name=payload.full_name,
        relation_type=payload.relation_type,
        date_of_birth=payload.date_of_birth,
    )
    db.add(dependent)
    db.commit()
    db.refresh(dependent)
    return dependent


@router.get("/dependents/mine", response_model=list[DependentOut])
def my_dependents(db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Dependent).filter(Dependent.patient_id == patient.id).order_by(Dependent.full_name).all()


@router.delete("/dependents/{dependent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependent(dependent_id: str, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    dependent = db.query(Dependent).filter(Dependent.id == dependent_id, Dependent.patient_id == patient.id).first()
    if not dependent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proche introuvable")
    db.delete(dependent)
    db.commit()

"""
Module "Portail Laboratoire" (nouveau, 4e type d'etablissement).

Principe: parallele au module Pharmacie deja existant (le patient demande,
le laboratoire traite et fait avancer le statut). Volontairement INDEPENDANT
de MedicalDocument (module dossier de sante) plutot que force dedans, pour
eviter de devoir modifier une table deja en production (MedicalDocument
exige un rendez-vous, un test labo n'en a pas forcement). Le dossier de
sante du patient affiche les deux sources cote a cote sans les fusionner
en base de donnees.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import LabTestRequest, Establishment, EstablishmentType, Patient, User, UserRole, AuditLog
from app.schemas import LabTestRequestCreate, LabTestRequestOut, LabTestStatusUpdate, LabOut
from app.deps import require_roles

router = APIRouter(prefix="/lab", tags=["laboratoire"])


def _to_lab_test_out(request: LabTestRequest) -> LabTestRequestOut:
    return LabTestRequestOut(
        id=request.id,
        establishment_id=request.establishment_id,
        establishment_name=request.establishment.name,
        patient_id=request.patient_id,
        test_name=request.test_name,
        sample_type=request.sample_type,
        status=request.status,
        scheduled_sample_at=request.scheduled_sample_at,
        results_text=request.results_text,
        lab_technician_note=request.lab_technician_note,
        created_at=request.created_at,
    )


@router.get("/search", response_model=list[LabOut])
def search_labs(city: Optional[str] = None, db: Session = Depends(get_db)):
    """Recherche publique de laboratoires adherents - equivalent de /doctors/search pour la specialite labo."""
    query = db.query(Establishment).filter(
        Establishment.type == EstablishmentType.LABORATOIRE,
        Establishment.is_active == True,
    )
    if city:
        query = query.filter(Establishment.city.ilike(f"%{city}%"))
    return [LabOut(id=e.id, name=e.name, city=e.city, address=e.address) for e in query.limit(50).all()]


@router.post("/tests", response_model=LabTestRequestOut, status_code=status.HTTP_201_CREATED)
def request_test(payload: LabTestRequestCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(UserRole.PATIENT))):
    lab = db.query(Establishment).filter(
        Establishment.id == payload.establishment_id, Establishment.type == EstablishmentType.LABORATOIRE,
        Establishment.is_active == True,
    ).first()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratoire introuvable")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    lab_test = LabTestRequest(
        id=str(uuid.uuid4()), establishment_id=lab.id, patient_id=patient.id,
        test_name=payload.test_name, sample_type=payload.sample_type,
        scheduled_sample_at=payload.scheduled_sample_at,
    )
    db.add(lab_test)
    db.add(AuditLog(user_id=current_user.id, establishment_id=lab.id,
                     action="request_lab_test", details=f"Demande d'analyse: {payload.test_name}"))
    db.commit()
    db.refresh(lab_test)
    return _to_lab_test_out(lab_test)


@router.get("/tests/mine", response_model=list[LabTestRequestOut])
def my_lab_tests(db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    tests = (
        db.query(LabTestRequest)
        .filter(LabTestRequest.patient_id == patient.id)
        .order_by(LabTestRequest.created_at.desc())
        .all()
    )
    return [_to_lab_test_out(t) for t in tests]


@router.get("/tests/establishment", response_model=list[LabTestRequestOut])
def establishment_lab_tests(db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles(
                                 UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    tests = (
        db.query(LabTestRequest)
        .filter(LabTestRequest.establishment_id == current_user.establishment_id)
        .order_by(LabTestRequest.created_at.desc())
        .all()
    )
    return [_to_lab_test_out(t) for t in tests]


@router.patch("/tests/{test_id}/status", response_model=LabTestRequestOut)
def update_lab_test_status(test_id: str, payload: LabTestStatusUpdate, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    test = db.query(LabTestRequest).filter(LabTestRequest.id == test_id).first()
    if not test or test.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyse introuvable")

    test.status = payload.status
    if payload.results_text is not None:
        test.results_text = payload.results_text
    if payload.lab_technician_note is not None:
        test.lab_technician_note = payload.lab_technician_note

    db.add(AuditLog(user_id=current_user.id, establishment_id=test.establishment_id,
                     action="update_lab_test_status", details=f"Analyse {test.id} -> {payload.status.value}"))
    db.commit()
    db.refresh(test)
    return _to_lab_test_out(test)

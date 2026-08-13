"""
Module Laboratoire - version complete avec:
- Enregistrement d'une analyse PAR le laboratoire lui-meme (pas seulement
  a l'initiative du patient) - utile pour un patient qui se presente
  directement au labo sans etre passe par le portail.
- Statistiques propres au laboratoire (taux de realisation, delai moyen).
- Horodatage du prelevement, distinct du simple changement de statut.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    LabTestRequest, LabTestStatus, Establishment, EstablishmentType, Patient, User, UserRole,
)
from app.schemas import (
    LabTestRequestCreate, LabTestRequestOut, LabTestStatusUpdate, LabOut,
    LabTestRegisterByStaff, LabStatsOut,
)
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
        sample_collected_at=request.sample_collected_at,
        results_text=request.results_text,
        lab_technician_note=request.lab_technician_note,
        created_at=request.created_at,
    )


@router.get("/search", response_model=list[LabOut])
def search_labs(city: Optional[str] = None, db: Session = Depends(get_db)):
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
    db.commit()
    db.refresh(lab_test)
    return _to_lab_test_out(lab_test)


@router.post("/tests/register", response_model=LabTestRequestOut, status_code=status.HTTP_201_CREATED)
def register_test_by_staff(payload: LabTestRegisterByStaff, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    """
    NOUVEAU: le laboratoire enregistre lui-meme une analyse pour un patient
    qui se presente directement (sans etre passe par une demande en ligne).
    Le patient doit deja avoir un compte sur la plateforme (recherche par
    son numero de dossier ou son email - voir le repertoire patients).
    """
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    lab_test = LabTestRequest(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id, patient_id=patient.id,
        test_name=payload.test_name, sample_type=payload.sample_type,
        status=LabTestStatus.SAMPLE_COLLECTED,  # enregistre sur place => prelevement deja fait
        sample_collected_at=datetime.utcnow(),
    )
    db.add(lab_test)
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


@router.get("/stats", response_model=LabStatsOut)
def lab_stats(db: Session = Depends(get_db),
              current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    """NOUVEAU: statistiques propres au laboratoire (taux de realisation, delai moyen de rendu)."""
    tests = db.query(LabTestRequest).filter(LabTestRequest.establishment_id == current_user.establishment_id).all()

    total = len(tests)
    delivered = [t for t in tests if t.status == LabTestStatus.DELIVERED]
    pending = [t for t in tests if t.status in (LabTestStatus.REQUESTED, LabTestStatus.SAMPLE_COLLECTED, LabTestStatus.IN_PROGRESS)]
    to_validate = [t for t in tests if t.status == LabTestStatus.IN_PROGRESS]

    completion_rate = round((len(delivered) / total) * 100, 1) if total > 0 else None

    # Delai moyen (prelevement -> validation), uniquement pour les analyses
    # ou les deux horodatages sont disponibles (les anciennes analyses,
    # creees avant cet ajout, n'en auront pas et sont ignorees du calcul).
    turnarounds = [
        (t.results_validated_at - t.sample_collected_at).total_seconds() / 86400
        for t in tests
        if t.sample_collected_at and t.results_validated_at
    ]
    average_turnaround_days = round(sum(turnarounds) / len(turnarounds), 1) if turnarounds else None

    return LabStatsOut(
        total_tests=total,
        delivered_count=len(delivered),
        pending_count=len(pending),
        to_validate_count=len(to_validate),
        completion_rate_pct=completion_rate,
        average_turnaround_days=average_turnaround_days,
    )


@router.patch("/tests/{test_id}/status", response_model=LabTestRequestOut)
def update_lab_test_status(test_id: str, payload: LabTestStatusUpdate, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    test = db.query(LabTestRequest).filter(LabTestRequest.id == test_id).first()
    if not test or test.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyse introuvable")

    # NOUVEAU: si on passe au statut "prelevement effectue" et que l'horodatage
    # n'est pas deja fixe, on l'enregistre maintenant.
    if payload.status == LabTestStatus.SAMPLE_COLLECTED and not test.sample_collected_at:
        test.sample_collected_at = datetime.utcnow()
    # De meme pour la validation - necessaire pour calculer un vrai delai moyen.
    if payload.status == LabTestStatus.VALIDATED and not test.results_validated_at:
        test.results_validated_at = datetime.utcnow()

    test.status = payload.status
    if payload.results_text is not None:
        test.results_text = payload.results_text
    if payload.lab_technician_note is not None:
        test.lab_technician_note = payload.lab_technician_note

    db.commit()
    db.refresh(test)
    return _to_lab_test_out(test)

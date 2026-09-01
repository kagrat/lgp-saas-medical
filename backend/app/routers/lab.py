"""
Module Laboratoire - version complete avec: enregistrement direct par le
labo, statistiques propres, horodatage prelevement, ET (nouveau) la
transmission directe d'une ordonnance d'analyse par un etablissement
(hopital/clinique) vers un laboratoire precis, au nom du patient.

Principe de tracabilite: une orientation est TOUJOURS rattachee a un
rendez-vous reel (comme pour le dossier de sante) - impossible d'orienter
un patient au hasard, uniquement ceux avec qui on a une consultation.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    LabTestRequest, LabTestStatus, Establishment, EstablishmentType, Patient, Doctor, Appointment, User, UserRole,
)
from app.schemas import (
    LabTestRequestCreate, LabTestRequestOut, LabTestStatusUpdate, LabOut,
    LabTestRegisterByStaff, LabStatsOut, LabReferralCreate,
)
from app.deps import require_roles

router = APIRouter(prefix="/lab", tags=["laboratoire"])


def _to_lab_test_out(request: LabTestRequest, db: Session) -> LabTestRequestOut:
    referring_establishment_name = None
    referring_doctor_name = None
    if request.referred_by_establishment_id:
        referring_est = db.query(Establishment).filter(Establishment.id == request.referred_by_establishment_id).first()
        referring_establishment_name = referring_est.name if referring_est else None
    if request.referred_by_doctor_id:
        referring_doctor = db.query(Doctor).filter(Doctor.id == request.referred_by_doctor_id).first()
        referring_doctor_name = referring_doctor.user.full_name if referring_doctor else None

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
        referred_by_establishment_name=referring_establishment_name,
        referred_by_doctor_name=referring_doctor_name,
    )


@router.get("/search", response_model=list[LabOut])
def search_labs(city: Optional[str] = None, name: Optional[str] = None, db: Session = Depends(get_db)):
    """NOUVEAU: recherche aussi par nom de laboratoire (demande M. Faustin),
    en plus de la ville deja disponible."""
    query = db.query(Establishment).filter(
        Establishment.type == EstablishmentType.LABORATOIRE,
        Establishment.is_active == True,
    )
    if city:
        query = query.filter(Establishment.city.ilike(f"%{city}%"))
    if name:
        query = query.filter(Establishment.name.ilike(f"%{name}%"))
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
    return _to_lab_test_out(lab_test, db)


@router.post("/tests/register", response_model=list[LabTestRequestOut], status_code=status.HTTP_201_CREATED)
def register_test_by_staff(payload: LabTestRegisterByStaff, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    """
    ELARGI (demande M. Faustin): enregistre PLUSIEURS analyses en une
    seule fois pour un patient present sur place, toutes dans la MEME
    transaction - soit toutes reussissent, soit aucune (pas de risque
    d'enregistrer 2 analyses sur 3 puis d'echouer sur la derniere).
    """
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    lab_tests = []
    for item in payload.tests:
        lab_test = LabTestRequest(
            id=str(uuid.uuid4()), establishment_id=current_user.establishment_id, patient_id=patient.id,
            test_name=item.test_name, sample_type=item.sample_type,
            status=LabTestStatus.SAMPLE_COLLECTED,
            sample_collected_at=datetime.utcnow(),
        )
        db.add(lab_test)
        lab_tests.append(lab_test)

    db.commit()
    for lab_test in lab_tests:
        db.refresh(lab_test)
    return [_to_lab_test_out(lab_test, db) for lab_test in lab_tests]


@router.post("/tests/refer", response_model=LabTestRequestOut, status_code=status.HTTP_201_CREATED)
def refer_test_to_lab(payload: LabReferralCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    """
    NOUVEAU: un hopital/clinique oriente directement un patient vers un
    laboratoire precis, a la suite d'une consultation - le patient n'a pas
    besoin de refaire la demande lui-meme, elle apparait directement dans
    son suivi ("Mes analyses").
    """
    appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a ce rendez-vous")

    referring_doctor_id = None
    if current_user.role == UserRole.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor or appointment.doctor_id != doctor.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu ne peux orienter que tes propres patients")
        referring_doctor_id = doctor.id
    else:
        # Admin d'etablissement: on garde une trace du medecin traitant du RDV, s'il existe.
        referring_doctor_id = appointment.doctor_id

    lab = db.query(Establishment).filter(
        Establishment.id == payload.lab_establishment_id, Establishment.type == EstablishmentType.LABORATOIRE,
        Establishment.is_active == True,
    ).first()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratoire introuvable")

    lab_test = LabTestRequest(
        id=str(uuid.uuid4()), establishment_id=lab.id, patient_id=appointment.patient_id,
        test_name=payload.test_name, sample_type=payload.sample_type,
        referred_by_establishment_id=current_user.establishment_id,
        referred_by_doctor_id=referring_doctor_id,
    )
    db.add(lab_test)
    db.commit()
    db.refresh(lab_test)
    return _to_lab_test_out(lab_test, db)


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
    return [_to_lab_test_out(t, db) for t in tests]


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
    return [_to_lab_test_out(t, db) for t in tests]


@router.get("/stats", response_model=LabStatsOut)
def lab_stats(db: Session = Depends(get_db),
              current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN))):
    tests = db.query(LabTestRequest).filter(LabTestRequest.establishment_id == current_user.establishment_id).all()

    total = len(tests)
    delivered = [t for t in tests if t.status == LabTestStatus.DELIVERED]
    pending = [t for t in tests if t.status in (LabTestStatus.REQUESTED, LabTestStatus.SAMPLE_COLLECTED, LabTestStatus.IN_PROGRESS)]
    to_validate = [t for t in tests if t.status == LabTestStatus.IN_PROGRESS]

    completion_rate = round((len(delivered) / total) * 100, 1) if total > 0 else None

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

    if payload.status == LabTestStatus.SAMPLE_COLLECTED and not test.sample_collected_at:
        test.sample_collected_at = datetime.utcnow()
    if payload.status == LabTestStatus.VALIDATED and not test.results_validated_at:
        test.results_validated_at = datetime.utcnow()

    test.status = payload.status
    if payload.results_text is not None:
        test.results_text = payload.results_text
    if payload.lab_technician_note is not None:
        test.lab_technician_note = payload.lab_technician_note

    db.commit()
    db.refresh(test)
    return _to_lab_test_out(test, db)

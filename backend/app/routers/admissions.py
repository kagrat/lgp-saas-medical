"""
Module Hospitalisation (nouveau, demande confirmee par M. Faustin).

Principe: une Admission est distincte du rendez-vous ponctuel (Appointment).
Le medecin decide l'admission et la sortie. L'infirmier(e) releve les
constantes au quotidien. Le medecin fait sa tournee (notes de suivi). Les
transferts entre departements/chambres sont tracés. Isolation multi-tenant
identique au reste du projet: chaque etablissement ne voit que ses propres
hospitalisations.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Admission, VitalSigns, AdmissionTransfer, MedicalDocument, DocumentType,
    Patient, Doctor, Department, Room, User, UserRole, AuditLog,
)
from app.schemas import (
    AdmissionCreate, AdmissionOut, AdmissionSummaryOut, AdmissionTransferCreate,
    AdmissionTransferOut, AdmissionDischarge, VitalSignsCreate, VitalSignsOut, ProgressNoteCreate,
)
from app.deps import require_roles
from app.routers.health_records import _to_document_out

router = APIRouter(prefix="/admissions", tags=["hospitalisation"])


def _current_doctor(db: Session, current_user: User) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil medecin introuvable")
    return doctor


def _get_admission_in_scope(db: Session, admission_id: str, current_user: User) -> Admission:
    admission = db.query(Admission).filter(Admission.id == admission_id).first()
    if not admission or admission.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospitalisation introuvable")
    return admission


def _to_summary_out(admission: Admission) -> AdmissionSummaryOut:
    return AdmissionSummaryOut(
        id=admission.id, patient_id=admission.patient_id,
        patient_name=admission.patient.user.full_name, dossier_number=admission.patient.dossier_number,
        admitting_doctor_name=admission.admitting_doctor.user.full_name,
        department_name=admission.department.name if admission.department else None,
        room_name=admission.room.name if admission.room else None,
        status=admission.status, admission_date=admission.admission_date,
        expected_discharge_date=admission.expected_discharge_date,
    )


def _to_full_out(db: Session, admission: Admission) -> AdmissionOut:
    documents = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.admission_id == admission.id)
        .order_by(MedicalDocument.created_at.desc())
        .all()
    )
    return AdmissionOut(
        id=admission.id, patient_id=admission.patient_id,
        patient_name=admission.patient.user.full_name, dossier_number=admission.patient.dossier_number,
        admitting_doctor_name=admission.admitting_doctor.user.full_name,
        department_id=admission.department_id, department_name=admission.department.name if admission.department else None,
        room_id=admission.room_id, room_name=admission.room.name if admission.room else None,
        status=admission.status, diagnosis=admission.diagnosis,
        admission_date=admission.admission_date, expected_discharge_date=admission.expected_discharge_date,
        actual_discharge_date=admission.actual_discharge_date, discharge_summary=admission.discharge_summary,
        vital_signs=[
            VitalSignsOut(
                id=v.id, recorded_by_name=v.recorded_by.full_name if v.recorded_by else "Inconnu",
                recorded_at=v.recorded_at, weight_kg=v.weight_kg, temperature_celsius=v.temperature_celsius,
                blood_pressure=v.blood_pressure, pulse_bpm=v.pulse_bpm,
                respiratory_rate=v.respiratory_rate, notes=v.notes,
            ) for v in admission.vital_signs
        ],
        transfers=[
            AdmissionTransferOut(
                id=t.id, from_department_name=t.from_department.name if t.from_department else None,
                to_department_name=t.to_department.name if t.to_department else None,
                from_room_name=t.from_room.name if t.from_room else None,
                to_room_name=t.to_room.name if t.to_room else None,
                transferred_by_name=t.transferred_by.full_name if t.transferred_by else "Inconnu",
                note=t.note, created_at=t.created_at,
            ) for t in admission.transfers
        ],
        documents=[_to_document_out(d) for d in documents],
    )


@router.post("", response_model=AdmissionOut, status_code=status.HTTP_201_CREATED)
def admit_patient(payload: AdmissionCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    """Le medecin decide l'admission d'un patient - pas necessairement issue
    d'un rendez-vous programme (admission d'urgence possible)."""
    doctor = _current_doctor(db, current_user)
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    if payload.department_id:
        dept = db.query(Department).filter(Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departement introuvable")
    if payload.room_id:
        room = db.query(Room).filter(Room.id == payload.room_id, Room.establishment_id == current_user.establishment_id).first()
        if not room:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chambre introuvable")
        occupied = db.query(Admission).filter(Admission.room_id == payload.room_id, Admission.status == "active").first()
        if occupied:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette chambre est deja occupee")

    admission = Admission(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        patient_id=payload.patient_id, admitting_doctor_id=doctor.id,
        department_id=payload.department_id, room_id=payload.room_id,
        status="active", diagnosis=payload.diagnosis,
        admission_date=datetime.utcnow(), expected_discharge_date=payload.expected_discharge_date,
    )
    db.add(admission)
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="admit_patient", details=f"Admission de {patient.user.full_name}"))
    db.commit()
    db.refresh(admission)
    return _to_full_out(db, admission)


@router.get("/establishment", response_model=list[AdmissionSummaryOut])
def list_admissions(admission_status: str = "active", db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(
                         UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.HR_MANAGER))):
    """Liste des hospitalisations de l'etablissement. Par defaut, seulement
    les actives - le meme principe que pour les rendez-vous du medecin
    (une fois sortie, une hospitalisation ne doit pas encombrer la liste
    courante par defaut)."""
    query = db.query(Admission).filter(Admission.establishment_id == current_user.establishment_id)
    if admission_status in ("active", "discharged"):
        query = query.filter(Admission.status == admission_status)
    admissions = query.order_by(Admission.admission_date.desc()).all()
    return [_to_summary_out(a) for a in admissions]


@router.get("/{admission_id}", response_model=AdmissionOut)
def get_admission(admission_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(
                       UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.HR_MANAGER))):
    admission = _get_admission_in_scope(db, admission_id, current_user)
    return _to_full_out(db, admission)


@router.post("/{admission_id}/vitals", response_model=VitalSignsOut, status_code=status.HTTP_201_CREATED)
def record_vitals(admission_id: str, payload: VitalSignsCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.NURSE))):
    admission = _get_admission_in_scope(db, admission_id, current_user)
    if admission.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette hospitalisation est terminee")

    vitals = VitalSigns(
        id=str(uuid.uuid4()), admission_id=admission.id, recorded_by_user_id=current_user.id,
        weight_kg=payload.weight_kg, temperature_celsius=payload.temperature_celsius, blood_pressure=payload.blood_pressure,
        pulse_bpm=payload.pulse_bpm, respiratory_rate=payload.respiratory_rate, notes=payload.notes,
    )
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return VitalSignsOut(
        id=vitals.id, recorded_by_name=current_user.full_name, recorded_at=vitals.recorded_at,
        weight_kg=vitals.weight_kg, temperature_celsius=vitals.temperature_celsius, blood_pressure=vitals.blood_pressure,
        pulse_bpm=vitals.pulse_bpm, respiratory_rate=vitals.respiratory_rate, notes=vitals.notes,
    )


@router.post("/{admission_id}/progress-note", status_code=status.HTTP_201_CREATED)
def add_progress_note(admission_id: str, payload: ProgressNoteCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    """Note de tournee medicale quotidienne - meme principe de tracabilite
    que les documents lies a un rendez-vous, mais rattachee a l'admission."""
    admission = _get_admission_in_scope(db, admission_id, current_user)
    doctor = _current_doctor(db, current_user)

    document = MedicalDocument(
        id=str(uuid.uuid4()), admission_id=admission.id, patient_id=admission.patient_id,
        doctor_id=doctor.id, author_user_id=current_user.id, establishment_id=current_user.establishment_id,
        document_type=DocumentType.DAILY_PROGRESS_NOTE, title=payload.title, content=payload.content,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return _to_document_out(document)


@router.post("/{admission_id}/nursing-note", status_code=status.HTTP_201_CREATED)
def add_nursing_note(admission_id: str, payload: ProgressNoteCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.NURSE))):
    """
    NOUVEAU (lacune identifiee lors d'un audit complet: "NURSING_NOTE"
    existait deja comme type de document possible, mais AUCUN endpoint ne
    permettait a un infirmier d'en creer un reellement - seul le medecin
    pouvait ecrire une note pour un patient hospitalise. Dans un hopital
    reel, le dossier de soins infirmiers (surveillance, soins prodigues,
    observations entre les visites medicales) est un document distinct et
    obligatoire, tenu par l'infirmier lui-meme - pas une simple copie du
    dossier medical du medecin.
    """
    admission = _get_admission_in_scope(db, admission_id, current_user)

    document = MedicalDocument(
        id=str(uuid.uuid4()), admission_id=admission.id, patient_id=admission.patient_id,
        doctor_id=None, author_user_id=current_user.id, establishment_id=current_user.establishment_id,
        document_type=DocumentType.NURSING_NOTE, title=payload.title, content=payload.content,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return _to_document_out(document)


@router.post("/{admission_id}/transfer", response_model=AdmissionOut)
def transfer_admission(admission_id: str, payload: AdmissionTransferCreate, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    admission = _get_admission_in_scope(db, admission_id, current_user)
    if admission.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette hospitalisation est terminee")

    if payload.to_room_id:
        room = db.query(Room).filter(Room.id == payload.to_room_id, Room.establishment_id == current_user.establishment_id).first()
        if not room:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chambre introuvable")
        occupied = db.query(Admission).filter(
            Admission.room_id == payload.to_room_id, Admission.status == "active", Admission.id != admission.id
        ).first()
        if occupied:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette chambre est deja occupee")

    transfer = AdmissionTransfer(
        id=str(uuid.uuid4()), admission_id=admission.id,
        from_department_id=admission.department_id, to_department_id=payload.to_department_id,
        from_room_id=admission.room_id, to_room_id=payload.to_room_id,
        transferred_by_user_id=current_user.id, note=payload.note,
    )
    db.add(transfer)

    admission.department_id = payload.to_department_id or admission.department_id
    admission.room_id = payload.to_room_id
    db.commit()
    db.refresh(admission)
    return _to_full_out(db, admission)


@router.post("/{admission_id}/discharge", response_model=AdmissionOut)
def discharge_admission(admission_id: str, payload: AdmissionDischarge, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    admission = _get_admission_in_scope(db, admission_id, current_user)
    if admission.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette hospitalisation est deja terminee")

    admission.status = "discharged"
    admission.actual_discharge_date = datetime.utcnow()
    admission.discharge_summary = payload.discharge_summary
    # Libere la chambre automatiquement - coherent avec le calcul
    # d'occupation en temps reel de RoomOut (jamais de champ stocke a
    # desynchroniser).
    db.commit()
    db.refresh(admission)
    return _to_full_out(db, admission)

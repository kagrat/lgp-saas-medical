"""
Module "Chat concierge" - avec cloisonnement par role (nouveau).

Principe retenu (valide avec le client): pas d'anonymat total vis-a-vis de
l'etablissement (irrealiste - si un medecin est absent, quelqu'un doit
pouvoir reprendre le suivi), mais un cloisonnement strict par role:
- Admin etablissement: voit TOUTES les conversations (responsabilite de
  continuite des soins).
- Medecin: voit uniquement SES propres conversations patients.
- Secretariat: ne voit plus aucun contenu clinique (retire de la
  messagerie - son role est la gestion des RDV, pas le contenu medical).
- Pharmacien / Technicien labo: voient uniquement les conversations SANS
  medecin associe (non liees a une consultation medicale).

LIMITE CONNUE: si un patient a a la fois une relation medecin ET une
commande pharmacie avec le meme etablissement, sa conversation est
rattachee au medecin (confidentialite clinique prioritaire), et le
pharmacien ne la verra donc pas meme pour une question sur sa commande.
Un vrai systeme multi-canal (un fil par type de sujet) serait la suite
logique si ce cas devient frequent en usage reel.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Message, MessageSenderRole, Appointment, PharmacyReservation, LabTestRequest,
    Patient, Doctor, Establishment, User, UserRole,
)
from app.schemas import MessageCreate, MessageOut, ConversationSummaryOut
from app.deps import require_roles

router = APIRouter(prefix="/messages", tags=["messagerie"])

ESTABLISHMENT_STAFF_ROLES = (
    UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN,
)


def _patient_has_relationship(db: Session, patient_id: str, establishment_id: str) -> bool:
    has_appointment = db.query(Appointment).filter(
        Appointment.patient_id == patient_id, Appointment.establishment_id == establishment_id
    ).first()
    if has_appointment:
        return True
    has_order = db.query(PharmacyReservation).filter(
        PharmacyReservation.patient_id == patient_id, PharmacyReservation.establishment_id == establishment_id
    ).first()
    if has_order:
        return True
    has_lab_test = db.query(LabTestRequest).filter(
        LabTestRequest.patient_id == patient_id, LabTestRequest.establishment_id == establishment_id
    ).first()
    return bool(has_lab_test)


def _resolve_thread_doctor_id(db: Session, patient_id: str, establishment_id: str) -> str | None:
    """
    Determine a quel medecin (s'il y en a un) rattacher ce fil de
    discussion: le medecin du rendez-vous le plus recent du patient dans
    cet etablissement, s'il en existe un. None si aucune relation medecin
    (conversation consideree comme non-clinique, visible pharmacien/labo).
    """
    last_appointment = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id, Appointment.establishment_id == establishment_id)
        .order_by(Appointment.scheduled_at.desc())
        .first()
    )
    return last_appointment.doctor_id if last_appointment else None


def _to_message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id, patient_id=message.patient_id, establishment_id=message.establishment_id,
        sender_role=message.sender_role, sender_name=message.sender_name,
        content=message.content, created_at=message.created_at,
    )


def _current_doctor_id(db: Session, current_user: User) -> str | None:
    if current_user.role != UserRole.DOCTOR:
        return None
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    return doctor.id if doctor else None


def _can_staff_access_thread(current_user: User, thread_doctor_id: str | None, current_doctor_id: str | None) -> bool:
    if current_user.role == UserRole.ESTABLISHMENT_ADMIN:
        return True
    if current_user.role == UserRole.DOCTOR:
        return thread_doctor_id is not None and thread_doctor_id == current_doctor_id
    if current_user.role in (UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN):
        return thread_doctor_id is None
    return False


# ---------- COTE PATIENT ----------

@router.get("/establishments", response_model=list[ConversationSummaryOut])
def my_conversations(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []

    establishment_ids = set()
    for appt in db.query(Appointment.establishment_id).filter(Appointment.patient_id == patient.id).distinct():
        establishment_ids.add(appt[0])
    for order in db.query(PharmacyReservation.establishment_id).filter(PharmacyReservation.patient_id == patient.id).distinct():
        establishment_ids.add(order[0])
    for test in db.query(LabTestRequest.establishment_id).filter(LabTestRequest.patient_id == patient.id).distinct():
        establishment_ids.add(test[0])

    results = []
    for est_id in establishment_ids:
        establishment = db.query(Establishment).filter(Establishment.id == est_id).first()
        if not establishment:
            continue
        last_message = (
            db.query(Message)
            .filter(Message.patient_id == patient.id, Message.establishment_id == est_id)
            .order_by(Message.created_at.desc())
            .first()
        )
        results.append(ConversationSummaryOut(
            establishment_id=est_id, establishment_name=establishment.name, patient_id=patient.id,
            patient_name=current_user.full_name,
            last_message=last_message.content if last_message else None,
            last_message_at=last_message.created_at if last_message else None,
        ))
    results.sort(key=lambda c: c.last_message_at or datetime.min, reverse=True)
    return results


@router.get("/conversation/{establishment_id}", response_model=list[MessageOut])
def patient_conversation(establishment_id: str, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient or not _patient_has_relationship(db, patient.id, establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec cet etablissement")

    messages = (
        db.query(Message)
        .filter(Message.patient_id == patient.id, Message.establishment_id == establishment_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [_to_message_out(m) for m in messages]


@router.post("/conversation/{establishment_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def patient_send_message(establishment_id: str, payload: MessageCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient or not _patient_has_relationship(db, patient.id, establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec cet etablissement")

    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etablissement introuvable")

    doctor_id = _resolve_thread_doctor_id(db, patient.id, establishment_id)

    message = Message(
        id=str(uuid.uuid4()), patient_id=patient.id, establishment_id=establishment_id,
        doctor_id=doctor_id,
        sender_role=MessageSenderRole.PATIENT, sender_name=current_user.full_name,
        content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_message_out(message)


# ---------- COTE ETABLISSEMENT ----------

@router.get("/establishment/patients", response_model=list[ConversationSummaryOut])
def establishment_conversations(db: Session = Depends(get_db),
                                 current_user: User = Depends(require_roles(*ESTABLISHMENT_STAFF_ROLES))):
    current_doctor_id = _current_doctor_id(db, current_user)

    rows = (
        db.query(Message.patient_id, Message.doctor_id)
        .filter(Message.establishment_id == current_user.establishment_id)
        .distinct()
        .all()
    )

    results = []
    for patient_id, thread_doctor_id in rows:
        if not _can_staff_access_thread(current_user, thread_doctor_id, current_doctor_id):
            continue
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            continue
        last_message = (
            db.query(Message)
            .filter(
                Message.patient_id == patient_id, Message.establishment_id == current_user.establishment_id,
                Message.doctor_id == thread_doctor_id,
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        results.append(ConversationSummaryOut(
            establishment_id=current_user.establishment_id, establishment_name="",
            patient_id=patient_id, patient_name=patient.user.full_name,
            last_message=last_message.content if last_message else None,
            last_message_at=last_message.created_at if last_message else None,
        ))
    results.sort(key=lambda c: c.last_message_at or datetime.min, reverse=True)
    return results


@router.get("/establishment/conversation/{patient_id}", response_model=list[MessageOut])
def establishment_conversation(patient_id: str, db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(*ESTABLISHMENT_STAFF_ROLES))):
    current_doctor_id = _current_doctor_id(db, current_user)
    thread_doctor_id = _resolve_thread_doctor_id(db, patient_id, current_user.establishment_id)

    if not _can_staff_access_thread(current_user, thread_doctor_id, current_doctor_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a cette conversation")

    messages = (
        db.query(Message)
        .filter(Message.patient_id == patient_id, Message.establishment_id == current_user.establishment_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [_to_message_out(m) for m in messages]


@router.post("/establishment/conversation/{patient_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def establishment_send_message(patient_id: str, payload: MessageCreate, db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(*ESTABLISHMENT_STAFF_ROLES))):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")
    if not _patient_has_relationship(db, patient_id, current_user.establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec ce patient")

    current_doctor_id = _current_doctor_id(db, current_user)
    thread_doctor_id = _resolve_thread_doctor_id(db, patient_id, current_user.establishment_id)

    if not _can_staff_access_thread(current_user, thread_doctor_id, current_doctor_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a cette conversation")

    message = Message(
        id=str(uuid.uuid4()), patient_id=patient_id, establishment_id=current_user.establishment_id,
        doctor_id=thread_doctor_id,
        sender_role=MessageSenderRole.STAFF, sender_name=current_user.full_name,
        content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_message_out(message)

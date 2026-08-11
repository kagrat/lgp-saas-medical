"""
Module "Chat concierge" (nouveau, dernier module de la liste).

Choix technique deliberé: pas de WebSockets. Le frontend interroge ces
routes toutes les quelques secondes (polling) pendant que la conversation
est ouverte. C'est legerement moins "instantane" qu'un vrai WebSocket,
mais infiniment plus simple a deployer de façon fiable sur Railway/Vercel
- vu les difficultes deja rencontrees avec le deploiement de fonctionnalites
bien plus simples, ce choix evite d'ajouter une source de pannes difficile
a diagnostiquer (connexions persistantes, reverse proxy, timeouts...).

Regle d'eligibilite: un patient ne peut demarrer une conversation qu'avec
un etablissement avec lequel il a deja une relation reelle (rendez-vous,
commande pharmacie, ou demande d'analyse) - ca evite le spam vers des
etablissements au hasard, et reste coherent avec le principe "chaque
etablissement ne voit que ses propres patients" deja applique ailleurs.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Message, MessageSenderRole, Appointment, PharmacyReservation, LabTestRequest,
    Patient, Establishment, User, UserRole,
)
from app.schemas import MessageCreate, MessageOut, ConversationSummaryOut
from app.deps import require_roles

router = APIRouter(prefix="/messages", tags=["messagerie"])


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


def _to_message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id, patient_id=message.patient_id, establishment_id=message.establishment_id,
        sender_role=message.sender_role, sender_name=message.sender_name,
        content=message.content, created_at=message.created_at,
    )


# ---------- COTE PATIENT ----------

@router.get("/establishments", response_model=list[ConversationSummaryOut])
def my_conversations(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """Etablissements avec lesquels le patient peut discuter (relation existante), avec apercu du dernier message."""
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

    message = Message(
        id=str(uuid.uuid4()), patient_id=patient.id, establishment_id=establishment_id,
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
                                 current_user: User = Depends(require_roles(
                                     UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    """Liste des patients ayant deja echange avec l'etablissement, avec apercu du dernier message."""
    patient_ids = (
        db.query(Message.patient_id)
        .filter(Message.establishment_id == current_user.establishment_id)
        .distinct()
        .all()
    )
    results = []
    for (patient_id,) in patient_ids:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            continue
        last_message = (
            db.query(Message)
            .filter(Message.patient_id == patient_id, Message.establishment_id == current_user.establishment_id)
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
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    messages = (
        db.query(Message)
        .filter(Message.patient_id == patient_id, Message.establishment_id == current_user.establishment_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [_to_message_out(m) for m in messages]


@router.post("/establishment/conversation/{patient_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def establishment_send_message(patient_id: str, payload: MessageCreate, db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")
    if not _patient_has_relationship(db, patient_id, current_user.establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec ce patient")

    message = Message(
        id=str(uuid.uuid4()), patient_id=patient_id, establishment_id=current_user.establishment_id,
        sender_role=MessageSenderRole.STAFF, sender_name=current_user.full_name,
        content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_message_out(message)

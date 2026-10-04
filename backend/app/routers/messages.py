"""
Module "Chat concierge" - messagerie patient <-> personnel de sante.

PRINCIPE (decision explicite de M. Faustin, qui REMPLACE le principe
precedent "l'admin voit toutes les conversations"): chaque conversation
reste ENTRE LES DEUX PERSONNES QUI CONVERSENT, et personne d'autre.

- Une conversation = (patient, etablissement, membre du personnel).
  Message.staff_user_id identifie ce membre du personnel.
- Un medecin ne voit QUE ses propres conversations. Jamais celles d'un
  autre medecin - meme s'il a traite le meme patient.
- L'admin d'etablissement, l'infirmier, l'accueil, le secretariat, les RH
  et la comptabilite: idem. Chacun ne voit que SES propres conversations
  avec les patients, JAMAIS celles des medecins (ni celles des autres).
- Le patient ne voit que les siennes, et les voit separement par
  interlocuteur (un fil par medecin / par personne).

EXCEPTION DOCUMENTEE - le "guichet" d'une pharmacie ou d'un laboratoire
(staff_user_id NULL): le patient y ecrit a l'ETABLISSEMENT (une commande,
une analyse), pas a une personne precise. Ce fil est partage par le
personnel de CETTE pharmacie/CE laboratoire uniquement (pharmacien,
technicien, admin) - jamais par un autre etablissement. Ce n'est pas une
conversation clinique avec un medecin.

LIMITE ASSUMEE: si un medecin est absent, personne d'autre ne peut lire
ses conversations. C'est la consequence directe de la confidentialite
stricte demandee.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Message, MessageSenderRole, Appointment, PharmacyReservation, LabTestRequest,
    Patient, Doctor, Establishment, EstablishmentType, User, UserRole, InternalMessage,
)
from app.schemas import (
    MessageCreate, MessageOut, ConversationSummaryOut,
    InternalMessageCreate, InternalMessageOut, InternalConversationSummaryOut,
)
from app.deps import require_roles, get_current_user

router = APIRouter(prefix="/messages", tags=["messagerie"])

# Tout le personnel peut ecrire a un patient avec qui il a un lien reel
# (demande precedente de M. Faustin) - mais CHAQUE conversation reste privee
# entre ce membre du personnel et ce patient (voir le principe ci-dessus).
ESTABLISHMENT_STAFF_ROLES = (
    UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN,
    UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.SECRETARY, UserRole.HR_MANAGER, UserRole.ACCOUNTANT,
)

DESK_ESTABLISHMENT_TYPES = (EstablishmentType.PHARMACIE, EstablishmentType.LABORATOIRE)
DESK_ROLES = (UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN)


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


def doctor_has_patient_relationship(db: Session, doctor_id: str, patient_id: str) -> bool:
    """Un medecin ne peut ecrire qu'a un patient qui a (ou a eu) un rendez-vous
    AVEC LUI - pas a n'importe quel patient de l'etablissement."""
    return db.query(Appointment.id).filter(
        Appointment.doctor_id == doctor_id, Appointment.patient_id == patient_id
    ).first() is not None


def _is_desk_user(db: Session, user: User) -> bool:
    """Guichet d'une pharmacie/d'un laboratoire: voir l'exception documentee."""
    if user.role not in DESK_ROLES or not user.establishment_id:
        return False
    establishment = db.query(Establishment).filter(Establishment.id == user.establishment_id).first()
    return establishment is not None and establishment.type in DESK_ESTABLISHMENT_TYPES


def _my_conversation_filter(db: Session, user: User):
    """Critere SQL des SEULES conversations dont ce membre du personnel est
    l'une des deux personnes. C'est ICI que se joue toute la confidentialite:
    aucune lecture de message ne doit passer ailleurs que par ce critere."""
    if _is_desk_user(db, user):
        return and_(Message.establishment_id == user.establishment_id, Message.staff_user_id.is_(None))
    return and_(Message.establishment_id == user.establishment_id, Message.staff_user_id == user.id)


def _resolve_thread_doctor_id(db: Session, patient_id: str, establishment_id: str) -> str | None:
    """Medecin du rendez-vous le plus recent du patient dans cet etablissement
    (None s'il n'y en a pas). Sert UNIQUEMENT de destinataire par defaut quand
    un patient ecrit sans preciser a qui - jamais a decider d'un acces."""
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


def _staff_filter(staff_user_id: Optional[str]):
    return Message.staff_user_id == staff_user_id if staff_user_id else Message.staff_user_id.is_(None)


def _default_counterparty_user_id(db: Session, patient_id: str, establishment_id: str) -> Optional[str]:
    """Interlocuteur par defaut d'un patient qui n'en precise pas (anciens
    clients): le guichet pour une pharmacie/un labo, sinon le medecin de son
    rendez-vous le plus recent."""
    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if establishment is not None and establishment.type in DESK_ESTABLISHMENT_TYPES:
        return None
    doctor_id = _resolve_thread_doctor_id(db, patient_id, establishment_id)
    if not doctor_id:
        return None
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    return doctor.user_id if doctor else None


# ---------- COTE PATIENT ----------

@router.get("/establishments", response_model=list[ConversationSummaryOut])
def my_conversations(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """Une entree par INTERLOCUTEUR (pas par etablissement): chaque medecin
    avec qui le patient a un rendez-vous, chaque membre du personnel qui lui
    a ecrit, et le guichet des pharmacies/laboratoires ou il a commande."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []

    entries: dict[tuple[str, Optional[str]], Optional[str]] = {}

    for est_id, doctor_id in db.query(Appointment.establishment_id, Appointment.doctor_id).filter(
            Appointment.patient_id == patient.id).distinct():
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if doctor:
            entries[(est_id, doctor.user_id)] = f"{doctor.user.full_name} ({doctor.specialty})"
    for (est_id,) in db.query(PharmacyReservation.establishment_id).filter(PharmacyReservation.patient_id == patient.id).distinct():
        entries.setdefault((est_id, None), None)
    for (est_id,) in db.query(LabTestRequest.establishment_id).filter(LabTestRequest.patient_id == patient.id).distinct():
        entries.setdefault((est_id, None), None)
    for est_id, staff_uid in db.query(Message.establishment_id, Message.staff_user_id).filter(
            Message.patient_id == patient.id, Message.staff_user_id.isnot(None)).distinct():
        if (est_id, staff_uid) not in entries:
            staff_user = db.query(User).filter(User.id == staff_uid).first()
            if staff_user:
                entries[(est_id, staff_uid)] = staff_user.full_name

    results = []
    for (est_id, staff_uid), counterparty_name in entries.items():
        establishment = db.query(Establishment).filter(Establishment.id == est_id).first()
        if not establishment:
            continue
        last_message = (
            db.query(Message)
            .filter(Message.patient_id == patient.id, Message.establishment_id == est_id, _staff_filter(staff_uid))
            .order_by(Message.created_at.desc())
            .first()
        )
        results.append(ConversationSummaryOut(
            establishment_id=est_id, establishment_name=establishment.name, patient_id=patient.id,
            patient_name=current_user.full_name,
            last_message=last_message.content if last_message else None,
            last_message_at=last_message.created_at if last_message else None,
            counterparty_user_id=staff_uid, counterparty_name=counterparty_name,
        ))
    results.sort(key=lambda c: c.last_message_at or datetime.min, reverse=True)
    return results


@router.get("/conversation/{establishment_id}", response_model=list[MessageOut])
def patient_conversation(establishment_id: str, with_user_id: Optional[str] = None,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient or not _patient_has_relationship(db, patient.id, establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec cet etablissement")

    staff_uid = with_user_id or _default_counterparty_user_id(db, patient.id, establishment_id)
    messages = (
        db.query(Message)
        .filter(Message.patient_id == patient.id, Message.establishment_id == establishment_id, _staff_filter(staff_uid))
        .order_by(Message.created_at.asc())
        .all()
    )
    return [_to_message_out(m) for m in messages]


@router.post("/conversation/{establishment_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def patient_send_message(establishment_id: str, payload: MessageCreate, with_user_id: Optional[str] = None,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient or not _patient_has_relationship(db, patient.id, establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec cet etablissement")

    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etablissement introuvable")

    staff_uid = with_user_id or _default_counterparty_user_id(db, patient.id, establishment_id)
    doctor_id = None
    if staff_uid is None:
        if establishment.type not in DESK_ESTABLISHMENT_TYPES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Choisis la personne a qui ecrire")
    else:
        # Le patient n'ecrit qu'a un medecin avec qui il a un rendez-vous, ou
        # en reponse a un membre du personnel qui lui a deja ecrit - jamais
        # a une personne arbitraire de l'etablissement.
        doctor = db.query(Doctor).filter(Doctor.user_id == staff_uid, Doctor.establishment_id == establishment_id).first()
        is_my_doctor = bool(doctor) and doctor_has_patient_relationship(db, doctor.id, patient.id)
        replied_to = db.query(Message.id).filter(
            Message.patient_id == patient.id, Message.establishment_id == establishment_id,
            Message.staff_user_id == staff_uid, Message.sender_role == MessageSenderRole.STAFF,
        ).first() is not None
        if not (is_my_doctor or replied_to):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu ne peux pas ecrire a cette personne")
        doctor_id = doctor.id if doctor else None

    message = Message(
        id=str(uuid.uuid4()), patient_id=patient.id, establishment_id=establishment_id,
        doctor_id=doctor_id, staff_user_id=staff_uid,
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
    """UNIQUEMENT les conversations dont l'utilisateur connecte est l'une des
    deux personnes (voir _my_conversation_filter)."""
    conv_filter = _my_conversation_filter(db, current_user)
    patient_ids = [row[0] for row in db.query(Message.patient_id).filter(conv_filter).distinct().all()]

    results = []
    for patient_id in patient_ids:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            continue
        last_message = (
            db.query(Message).filter(conv_filter, Message.patient_id == patient_id)
            .order_by(Message.created_at.desc()).first()
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
    """Ma conversation avec ce patient - et rien d'autre. Si je n'en ai pas,
    la liste est vide (jamais d'acces a celle d'une autre personne)."""
    messages = (
        db.query(Message)
        .filter(_my_conversation_filter(db, current_user), Message.patient_id == patient_id)
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

    doctor_id = None
    if current_user.role == UserRole.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor or not doctor_has_patient_relationship(db, doctor.id, patient_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec ce patient")
        doctor_id = doctor.id
    elif not _patient_has_relationship(db, patient_id, current_user.establishment_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec ce patient")

    message = Message(
        id=str(uuid.uuid4()), patient_id=patient_id, establishment_id=current_user.establishment_id,
        doctor_id=doctor_id, staff_user_id=None if _is_desk_user(db, current_user) else current_user.id,
        sender_role=MessageSenderRole.STAFF, sender_name=current_user.full_name,
        content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_message_out(message)


# ============================================================================
# NOUVEAU (demande explicite de M. Faustin: "il faut que l'ets puisse
# envoyer des messages aux medecins"). Messagerie interne entre membres du
# personnel d'un meme etablissement - distincte du chat patient <->
# etablissement ci-dessus. Le modele InternalMessage existait deja
# (prepare a l'avance) mais n'avait encore aucun schema ni endpoint.
# ============================================================================

def _internal_staff_role_check(current_user: User):
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Reserve au personnel")
    if not current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte non rattache a un etablissement")


@router.get("/internal/mine", response_model=list[InternalConversationSummaryOut])
def my_internal_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _internal_staff_role_check(current_user)

    messages = (
        db.query(InternalMessage)
        .filter(
            InternalMessage.establishment_id == current_user.establishment_id,
            (InternalMessage.from_user_id == current_user.id) | (InternalMessage.to_user_id == current_user.id),
        )
        .order_by(InternalMessage.created_at.desc())
        .all()
    )

    by_other: dict = {}
    for m in messages:
        other_id = m.to_user_id if m.from_user_id == current_user.id else m.from_user_id
        if other_id not in by_other:
            by_other[other_id] = {"last_message": m.content, "last_message_at": m.created_at, "unread_count": 0}
        if m.to_user_id == current_user.id and not m.is_read:
            by_other[other_id]["unread_count"] += 1

    results = []
    for other_id, info in by_other.items():
        other_user = db.query(User).filter(User.id == other_id).first()
        if not other_user:
            continue
        results.append(InternalConversationSummaryOut(
            other_user_id=other_id, other_user_name=other_user.full_name, other_user_role=other_user.role,
            last_message=info["last_message"], last_message_at=info["last_message_at"],
            unread_count=info["unread_count"],
        ))
    results.sort(key=lambda r: r.last_message_at or datetime.min, reverse=True)
    return results


@router.get("/internal/conversation/{other_user_id}", response_model=list[InternalMessageOut])
def internal_conversation(other_user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _internal_staff_role_check(current_user)

    other_user = db.query(User).filter(
        User.id == other_user_id, User.establishment_id == current_user.establishment_id,
    ).first()
    if not other_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collegue introuvable dans ton etablissement")

    messages = (
        db.query(InternalMessage)
        .filter(
            InternalMessage.establishment_id == current_user.establishment_id,
            (
                (InternalMessage.from_user_id == current_user.id) & (InternalMessage.to_user_id == other_user_id)
            ) | (
                (InternalMessage.from_user_id == other_user_id) & (InternalMessage.to_user_id == current_user.id)
            ),
        )
        .order_by(InternalMessage.created_at.asc())
        .all()
    )
    # Marque comme lus les messages RECUS dans cette conversation.
    for m in messages:
        if m.to_user_id == current_user.id and not m.is_read:
            m.is_read = True
    db.commit()

    return messages


@router.post("/internal/conversation/{other_user_id}", response_model=InternalMessageOut, status_code=status.HTTP_201_CREATED)
def send_internal_message(other_user_id: str, payload: InternalMessageCreate, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    """
    SECURITE: le destinataire doit appartenir au MEME etablissement que
    l'expediteur - sans ce controle, un membre du personnel aurait pu
    envoyer un message interne a n'importe quel utilisateur de la
    plateforme, y compris d'un etablissement totalement different.
    """
    _internal_staff_role_check(current_user)

    other_user = db.query(User).filter(
        User.id == other_user_id, User.establishment_id == current_user.establishment_id,
    ).first()
    if not other_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collegue introuvable dans ton etablissement")
    if other_user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Impossible de s'envoyer un message a soi-meme")

    message = InternalMessage(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        from_user_id=current_user.id, to_user_id=other_user_id,
        sender_name=current_user.full_name, content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

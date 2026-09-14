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
    Patient, Doctor, Establishment, User, UserRole, InternalMessage,
)
from app.schemas import (
    MessageCreate, MessageOut, ConversationSummaryOut,
    InternalMessageCreate, InternalMessageOut, InternalConversationSummaryOut,
)
from app.deps import require_roles, get_current_user

router = APIRouter(prefix="/messages", tags=["messagerie"])

ESTABLISHMENT_STAFF_ROLES = (
    # CORRIGE (demande explicite de M. Faustin: "permettre au medecin ET
    # aux autres utilisateurs d'envoyer des messages aux patients") -
    # avant, seuls admin/medecin/pharmacien/technicien labo pouvaient
    # ecrire a un patient - infirmier, secretariat, accueil, RH et
    # comptabilite en etaient exclus sans raison metier claire. La
    # verification _patient_has_relationship ci-dessous reste inchangee
    # quel que soit le role (aucun acces a un patient sans lien reel).
    UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN,
    UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.SECRETARY, UserRole.HR_MANAGER, UserRole.ACCOUNTANT,
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
    # CORRIGE (demande explicite de M. Faustin: "permettre aux autres
    # utilisateurs d'envoyer des messages aux patients") - cette
    # verification est DISTINCTE de la restriction de role sur
    # l'endpoint (ESTABLISHMENT_STAFF_ROLES ci-dessus) et avait sa PROPRE
    # liste figee, jamais mise a jour en meme temps - le personnel
    # nouvellement autorise (infirmier, accueil, secretariat, RH,
    # comptabilite) etait donc quand meme bloque ici. Traites comme
    # l'admin: acces a toute conversation de LEUR etablissement, pas
    # limites a un medecin precis (role de soutien general, pas une
    # relation de soins individuelle comme un medecin).
    if current_user.role in (
        UserRole.ESTABLISHMENT_ADMIN, UserRole.NURSE, UserRole.RECEPTIONIST,
        UserRole.SECRETARY, UserRole.HR_MANAGER, UserRole.ACCOUNTANT,
    ):
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

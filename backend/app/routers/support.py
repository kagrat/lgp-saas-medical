"""
Module "Messagerie support plateforme" (nouveau).

Distinct du chat concierge patient<->etablissement deja existant: ici
c'est un canal patient OU staff <-> Super Admin / equipe SpeedSanté+,
pour les questions techniques ou administratives sur la plateforme elle-
meme (pas liees a un etablissement precis). Nouvelle table isolee, ne
touche a rien d'existant.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SupportMessage, User, UserRole
from app.schemas import SupportMessageCreate, SupportMessageOut, SupportThreadSummaryOut
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/support", tags=["support"])


def _to_message_out(message: SupportMessage) -> SupportMessageOut:
    return SupportMessageOut(
        id=message.id, user_id=message.user_id, sender_role=message.sender_role,
        sender_name=message.sender_name, content=message.content, created_at=message.created_at,
    )


@router.post("/messages", response_model=SupportMessageOut, status_code=status.HTTP_201_CREATED)
def send_message(payload: SupportMessageCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    """N'importe quel utilisateur connecte (patient ou staff) peut ecrire au support."""
    message = SupportMessage(
        id=str(uuid.uuid4()), user_id=current_user.id,
        sender_role="user", sender_name=current_user.full_name, content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_message_out(message)


@router.get("/messages/mine", response_model=list[SupportMessageOut])
def my_messages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.user_id == current_user.id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    return [_to_message_out(m) for m in messages]


@router.get("/threads", response_model=list[SupportThreadSummaryOut])
def list_threads(db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """Vue Super Admin: tous les fils de discussion, avec apercu du dernier message."""
    user_ids = [row[0] for row in db.query(SupportMessage.user_id).distinct().all()]

    results = []
    for user_id in user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            continue
        last_message = (
            db.query(SupportMessage)
            .filter(SupportMessage.user_id == user_id)
            .order_by(SupportMessage.created_at.desc())
            .first()
        )
        results.append(SupportThreadSummaryOut(
            user_id=user_id, user_name=user.full_name, user_role=user.role,
            last_message=last_message.content if last_message else None,
            last_message_at=last_message.created_at if last_message else None,
        ))

    results.sort(key=lambda t: t.last_message_at or datetime.min, reverse=True)
    return results


@router.get("/thread/{user_id}", response_model=list[SupportMessageOut])
def thread_history(user_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.user_id == user_id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    return [_to_message_out(m) for m in messages]


@router.post("/thread/{user_id}", response_model=SupportMessageOut, status_code=status.HTTP_201_CREATED)
def reply_to_thread(user_id: str, payload: SupportMessageCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    message = SupportMessage(
        id=str(uuid.uuid4()), user_id=user_id,
        sender_role="support", sender_name="Support SpeedSanté+", content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _to_message_out(message)

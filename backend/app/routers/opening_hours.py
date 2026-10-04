"""
Module "Horaires d'ouverture" (nouveau) - horaires generaux de
l'etablissement, distincts des disponibilites par medecin (module 4).
Utile notamment pour pharmacies et laboratoires qui n'ont pas de medecins.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OpeningHours, Establishment, User, UserRole
from app.schemas import OpeningHoursCreate, OpeningHoursOut
from app.deps import require_roles

router = APIRouter(prefix="/opening-hours", tags=["horaires"])


@router.get("/establishment/{establishment_id}", response_model=list[OpeningHoursOut])
def public_opening_hours(establishment_id: str, db: Session = Depends(get_db)):
    """Public - affiche sur le profil medecin / la recherche pharmacie ou labo."""
    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable")
    return (
        db.query(OpeningHours)
        .filter(OpeningHours.establishment_id == establishment_id)
        .order_by(OpeningHours.day_of_week)
        .all()
    )


@router.get("/mine", response_model=list[OpeningHoursOut])
def my_opening_hours(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    return (
        db.query(OpeningHours)
        .filter(OpeningHours.establishment_id == current_user.establishment_id)
        .order_by(OpeningHours.day_of_week)
        .all()
    )


@router.post("", response_model=OpeningHoursOut, status_code=status.HTTP_201_CREATED)
def add_opening_hours(payload: OpeningHoursCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    entry = OpeningHours(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        day_of_week=payload.day_of_week, open_time=payload.open_time, close_time=payload.close_time,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opening_hours(entry_id: str, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    entry = db.query(OpeningHours).filter(
        OpeningHours.id == entry_id, OpeningHours.establishment_id == current_user.establishment_id
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horaire introuvable")
    db.delete(entry)
    db.commit()

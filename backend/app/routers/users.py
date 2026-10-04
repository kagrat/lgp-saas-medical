"""
Module "Table utilisateurs" (nouveau) - visible cote Super Admin uniquement.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole, Establishment
from app.schemas import UserDirectoryOut
from app.deps import require_roles

router = APIRouter(prefix="/users", tags=["utilisateurs"])


@router.get("", response_model=list[UserDirectoryOut])
def list_all_users(role: Optional[UserRole] = None, search: Optional[str] = None,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if search and search.strip():
        query = query.filter(User.full_name.ilike(f"%{search.strip()}%"))

    users = query.order_by(User.full_name).limit(300).all()

    results = []
    for u in users:
        establishment = db.query(Establishment).filter(Establishment.id == u.establishment_id).first() if u.establishment_id else None
        results.append(UserDirectoryOut(
            id=u.id, email=u.email, full_name=u.full_name, role=u.role,
            establishment_name=establishment.name if establishment else None,
            is_active=u.is_active, created_at=u.created_at,
        ))
    return results


@router.patch("/{user_id}/toggle-active", response_model=UserDirectoryOut)
def toggle_user_active(user_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tu ne peux pas désactiver ton propre compte")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)

    establishment = db.query(Establishment).filter(Establishment.id == user.establishment_id).first() if user.establishment_id else None
    return UserDirectoryOut(
        id=user.id, email=user.email, full_name=user.full_name, role=user.role,
        establishment_name=establishment.name if establishment else None,
        is_active=user.is_active, created_at=user.created_at,
    )

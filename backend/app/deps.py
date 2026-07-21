"""
Dependances FastAPI: authentification + isolation multi-tenant.

Regle d'or de securite du projet: TOUTE route qui touche des donnees
d'etablissement doit dependre de `get_current_user` et filtrer ses requetes
SQL par `current_user.establishment_id`, SAUF le role super_admin qui a une
vision globale explicite (section 4, niveau 1).
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides ou session expiree",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*allowed_roles: UserRole):
    """
    Factory de dependance RBAC. Usage:
        @router.post(..., dependencies=[Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))])
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: privileges insuffisants pour cette action",
            )
        return current_user
    return _check


def get_tenant_establishment_id(current_user: User = Depends(get_current_user)) -> Optional[str]:
    """
    Retourne l'establishment_id a utiliser pour filtrer les requetes.
    - super_admin: None => l'appelant doit explicitement gerer la portee globale
      (et ne JAMAIS l'utiliser pour bypasser un filtre sur les autres roles).
    - tous les autres roles: leur establishment_id, jamais modifiable par le client.
    """
    if current_user.role == UserRole.SUPER_ADMIN:
        return None
    if current_user.establishment_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte non rattache a un etablissement",
        )
    return current_user.establishment_id

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
from app.models import User, UserRole, Establishment, EstablishmentType
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
# NOUVEAU (audit de securite complet, demande explicite de M. Faustin:
# anonymiser le nom du patient sur un avis PUBLIC, tout en gardant le
# vrai nom visible pour le medecin concerne et son etablissement).
# auto_error=False: ne rejette jamais une requete sans jeton, contrairement
# a oauth2_scheme normal - permet a un meme endpoint de servir a la fois
# un visiteur anonyme et un utilisateur connecte.
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user_optional(token: str = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides ou session expirée",
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
                detail="Accès refusé: privilèges insuffisants pour cette action",
            )
        return current_user
    return _check


def require_establishment_types(*allowed_types: EstablishmentType):
    """
    Factory de dependance: restreint une route aux comptes dont l'ETABLISSEMENT
    (pas le role individuel) est d'un des types donnes. Complementaire a
    require_roles: un role (ex: establishment_admin) peut exister dans
    n'importe quel type d'etablissement, donc le controle par role seul ne
    suffit pas a empecher, par exemple, l'admin d'un hopital d'appeler des
    endpoints reserves aux pharmacies.
    Usage:
        @router.get(..., dependencies=[Depends(require_establishment_types(EstablishmentType.PHARMACIE))])
    """
    def _check(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user
        if current_user.establishment_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte non rattaché à un établissement")
        establishment = db.query(Establishment).filter(Establishment.id == current_user.establishment_id).first()
        if not establishment or establishment.type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cette action n'est pas disponible pour ce type d'établissement",
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
            detail="Compte non rattaché à un établissement",
        )
    return current_user.establishment_id

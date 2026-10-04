"""
Module "Journal d'activite" (nouveau) - visible cote Super Admin.

Ce module n'ajoute AUCUNE nouvelle table: chaque action sensible est deja
enregistree depuis le tout debut du projet dans audit_logs (creation
d'etablissement, connexion, modification de profil, etc.). Il manquait
juste un ecran pour la consulter.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, User, Establishment, UserRole
from app.schemas import AuditLogOut
from app.deps import require_roles

router = APIRouter(prefix="/audit-logs", tags=["journal-activite"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(limit: int = 100, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    limit = max(1, min(limit, 500))
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()

    results = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        establishment = db.query(Establishment).filter(Establishment.id == log.establishment_id).first() if log.establishment_id else None
        results.append(AuditLogOut(
            id=log.id,
            user_name=user.full_name if user else "Système",
            establishment_name=establishment.name if establishment else None,
            action=log.action,
            details=log.details,
            created_at=log.created_at,
        ))
    return results


@router.get("/establishment", response_model=list[AuditLogOut])
def list_establishment_audit_logs(limit: int = 100, db: Session = Depends(get_db),
                                   current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    """
    NOUVEAU (reporting avance, ferme une lacune du cahier des charges): un
    directeur d'etablissement ne pouvait jusqu'ici pas voir le journal
    d'activite de son PROPRE etablissement (reserve au Super Admin
    uniquement). Meme donnee (audit_logs), simplement filtree a son
    etablissement - aucune nouvelle table.
    """
    limit = max(1, min(limit, 500))
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.establishment_id == current_user.establishment_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        results.append(AuditLogOut(
            id=log.id,
            user_name=user.full_name if user else "Système",
            establishment_name=None,  # inutile ici: toujours son propre etablissement
            action=log.action,
            details=log.details,
            created_at=log.created_at,
        ))
    return results

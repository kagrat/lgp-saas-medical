"""
Module "Parametres generaux" (nouveau, Super Admin).

Perimetre volontairement limite a ce qui est reellement exploitable
aujourd'hui (nom de la plateforme, contact support) - pas de faux
reglages "paiements" ou "roles" qui ne feraient rien de concret sans
infrastructure derriere (voir le sujet Paiements, traite a part).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PlatformSetting, User, UserRole
from app.schemas import PlatformSettingsOut, PlatformSettingsUpdate
from app.deps import require_roles

router = APIRouter(prefix="/settings", tags=["parametres"])

DEFAULTS = {
    "platform_name": "SpeedSanté+",
    "support_email": "",
    "support_phone": "",
}


def _get_value(db: Session, key: str) -> str:
    row = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    return row.value if row and row.value is not None else DEFAULTS.get(key, "")


def _set_value(db: Session, key: str, value: str):
    row = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=key, value=value))


def _build_settings_out(db: Session) -> PlatformSettingsOut:
    return PlatformSettingsOut(
        platform_name=_get_value(db, "platform_name") or DEFAULTS["platform_name"],
        support_email=_get_value(db, "support_email") or None,
        support_phone=_get_value(db, "support_phone") or None,
    )


@router.get("", response_model=PlatformSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    """Public en lecture - utile pour afficher le nom de la plateforme / contact support quelque part."""
    return _build_settings_out(db)


@router.put("", response_model=PlatformSettingsOut)
def update_settings(payload: PlatformSettingsUpdate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    if payload.platform_name is not None:
        _set_value(db, "platform_name", payload.platform_name)
    if payload.support_email is not None:
        _set_value(db, "support_email", payload.support_email)
    if payload.support_phone is not None:
        _set_value(db, "support_phone", payload.support_phone)
    db.commit()
    return _build_settings_out(db)

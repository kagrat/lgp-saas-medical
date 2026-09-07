"""
Module Notifications internes (nouveau, ferme une lacune identifiee dans
l'audit du cahier des charges: les seuils d'alerte de stock existaient deja
comme donnee mais rien ne se declenchait reellement dessus).

Ce centre de notifications est le point d'extension pret pour brancher un
vrai fournisseur SMS plus tard (voir services/notifications.py, deja
documente comme "a completer") - sans avoir a tout reconstruire.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User, UserRole
from app.schemas import NotificationOut
from app.deps import require_roles

router = APIRouter(prefix="/notifications", tags=["notifications"])


def create_stock_alert(db: Session, establishment_id: str, item_name: str, quantity: int, threshold: int) -> None:
    """
    Helper reutilisable, appele depuis pharmacy.py (confirmation de
    commande) et inventory.py (mise a jour de stock general) - le seul
    endroit qui decide QUAND creer une alerte de stock, pour eviter de
    dupliquer cette logique a plusieurs endroits.
    """
    notification = Notification(
        id=str(uuid.uuid4()), establishment_id=establishment_id, user_id=None,
        notification_type="stock_alert", title="Stock bas",
        message=f"{item_name}: il ne reste que {quantity} unite(s) (seuil d'alerte: {threshold}).",
    )
    db.add(notification)


def create_maintenance_alert(db: Session, establishment_id: str, equipment_name: str, due_date) -> None:
    """NOUVEAU (equipement general, gestion interne complete): meme
    principe que create_stock_alert, pour la maintenance preventive
    d'equipement echue ou a echeance."""
    notification = Notification(
        id=str(uuid.uuid4()), establishment_id=establishment_id, user_id=None,
        notification_type="maintenance_alert", title="Maintenance a prevoir",
        message=f"{equipment_name}: maintenance preventive prevue le {due_date.strftime('%d/%m/%Y')}.",
    )
    db.add(notification)


@router.get("/establishment", response_model=list[NotificationOut])
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(
                            UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT,
                            # CORRIGE (lacune identifiee lors d'un audit complet): le
                            # pharmacien ne pouvait jamais voir les alertes de stock bas
                            # generees sur SA PROPRE pharmacie - seul l'admin les voyait,
                            # alors que c'est le pharmacien qui doit reellement agir dessus.
                            UserRole.PHARMACIST))):
    """Notifications de l'etablissement - visibles par l'admin et les roles
    de gestion (pas de ciblage individuel pour l'instant, tout le monde
    dans ces roles voit les memes alertes)."""
    query = db.query(Notification).filter(Notification.establishment_id == current_user.establishment_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    return notifications


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: str, db: Session = Depends(get_db),
              current_user: User = Depends(require_roles(
                  UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.PHARMACIST))):
    notification = db.query(Notification).filter(
        Notification.id == notification_id, Notification.establishment_id == current_user.establishment_id
    ).first()
    if not notification:
        return None
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/read-all", status_code=204)
def mark_all_read(db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(
                       UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.PHARMACIST))):
    db.query(Notification).filter(
        Notification.establishment_id == current_user.establishment_id, Notification.is_read == False
    ).update({"is_read": True})
    db.commit()

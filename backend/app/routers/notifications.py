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


def create_appointment_notification(db: Session, doctor_user_id: str, establishment_id: str, patient_name: str, scheduled_at) -> None:
    """
    NOUVEAU (demande explicite de M. Faustin: "un medecin est alerte pour
    un nouveau rendez-vous"). CIBLEE (user_id renseigne) - seul CE medecin
    doit la voir, pas tout l'etablissement.
    """
    notification = Notification(
        id=str(uuid.uuid4()), establishment_id=establishment_id, user_id=doctor_user_id,
        notification_type="new_appointment", title="Nouveau rendez-vous",
        message=f"{patient_name} - {scheduled_at.strftime('%d/%m/%Y a %H:%M')}",
    )
    db.add(notification)


def create_dossier_share_notification(db: Session, recipient_doctor_user_id: str, establishment_id: str, sender_doctor_name: str, patient_name: str) -> None:
    """
    NOUVEAU (demande explicite de M. Faustin: "si un confrere lui envoi un
    patient ou un dossier"). CIBLEE - seul le medecin destinataire du
    partage doit la voir.
    """
    notification = Notification(
        id=str(uuid.uuid4()), establishment_id=establishment_id, user_id=recipient_doctor_user_id,
        notification_type="dossier_share", title="Dossier partage par un confrere",
        message=f"Dr {sender_doctor_name} t'a transmis le dossier de {patient_name}.",
    )
    db.add(notification)


def create_lab_request_notification(db: Session, lab_establishment_id: str, test_name: str, patient_name: str) -> None:
    """
    NOUVEAU (demande explicite de M. Faustin: "le laboratoire est alerte
    s'il y a une nouvelle analyse"). Diffusee a tout l'etablissement (pas
    cible a un technicien precis) - n'importe quel technicien de garde
    doit pouvoir la voir, meme principe que les alertes de stock pharmacie.
    """
    notification = Notification(
        id=str(uuid.uuid4()), establishment_id=lab_establishment_id, user_id=None,
        notification_type="new_lab_request", title="Nouvelle analyse demandee",
        message=f"{test_name} - {patient_name}",
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
                            UserRole.PHARMACIST,
                            # NOUVEAU (demande explicite de M. Faustin): medecin alerte
                            # pour un nouveau rendez-vous ou un dossier partage par un
                            # confrere; laboratoire alerte pour une nouvelle analyse.
                            UserRole.DOCTOR, UserRole.LAB_TECHNICIAN))):
    """
    Notifications de l'etablissement - diffusion generale (alertes de
    stock, maintenance, nouvelles analyses) VISIBLE PAR TOUS dans ces
    roles, PLUS les notifications personnellement ciblees a CE user precis
    (nouveau rendez-vous, dossier partage) - CORRIGE (lacune identifiee):
    avant, un filtrage par etablissement seul aurait permis a un medecin
    de voir les notifications personnelles d'un AUTRE medecin du meme
    etablissement.
    """
    query = db.query(Notification).filter(
        Notification.establishment_id == current_user.establishment_id,
        (Notification.user_id == None) | (Notification.user_id == current_user.id),
    )
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    return notifications


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: str, db: Session = Depends(get_db),
              current_user: User = Depends(require_roles(
                  UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.PHARMACIST,
                  UserRole.DOCTOR, UserRole.LAB_TECHNICIAN))):
    notification = db.query(Notification).filter(
        Notification.id == notification_id, Notification.establishment_id == current_user.establishment_id,
        (Notification.user_id == None) | (Notification.user_id == current_user.id),
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
                       UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER, UserRole.ACCOUNTANT, UserRole.PHARMACIST,
                       UserRole.DOCTOR, UserRole.LAB_TECHNICIAN))):
    db.query(Notification).filter(
        Notification.establishment_id == current_user.establishment_id,
        (Notification.user_id == None) | (Notification.user_id == current_user.id),
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()

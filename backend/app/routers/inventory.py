"""
Module Stock general (nouveau, gestion interne complete, demande M.
Faustin) - materiel medical et consommables non-pharmaceutiques, distinct
de PharmacyStock (medicaments vendus en pharmacie).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InventoryItem, User, UserRole
from app.schemas import InventoryItemCreate, InventoryItemUpdate, InventoryItemOut
from app.deps import require_roles
from app.routers.notifications import create_stock_alert

router = APIRouter(prefix="/inventory", tags=["stock-general"])


def _to_out(item: InventoryItem) -> InventoryItemOut:
    return InventoryItemOut(
        id=item.id, name=item.name, category=item.category, quantity=item.quantity,
        unit=item.unit, alert_threshold=item.alert_threshold,
        is_low_stock=item.quantity <= item.alert_threshold,
    )


@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: InventoryItemCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    item = InventoryItem(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        name=payload.name, category=payload.category, quantity=payload.quantity,
        unit=payload.unit, alert_threshold=payload.alert_threshold,
    )
    db.add(item)
    if item.quantity <= item.alert_threshold:
        create_stock_alert(db, current_user.establishment_id, item.name, item.quantity, item.alert_threshold)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.get("/mine", response_model=list[InventoryItemOut])
def list_items(db: Session = Depends(get_db),
                current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    items = db.query(InventoryItem).filter(InventoryItem.establishment_id == current_user.establishment_id).order_by(InventoryItem.name).all()
    return [_to_out(i) for i in items]


@router.patch("/{item_id}", response_model=InventoryItemOut)
def update_item(item_id: str, payload: InventoryItemUpdate, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id, InventoryItem.establishment_id == current_user.establishment_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable")

    was_above_threshold = item.quantity > item.alert_threshold

    if payload.quantity is not None:
        item.quantity = payload.quantity
    if payload.category is not None:
        item.category = payload.category
    if payload.unit is not None:
        item.unit = payload.unit
    if payload.alert_threshold is not None:
        item.alert_threshold = payload.alert_threshold

    # NOUVEAU: declenche une vraie alerte uniquement au moment ou le stock
    # FRANCHIT le seuil (pas a chaque mise a jour si deja sous le seuil) -
    # evite de spammer une notification identique en boucle.
    now_at_or_below = item.quantity <= item.alert_threshold
    if was_above_threshold and now_at_or_below:
        create_stock_alert(db, current_user.establishment_id, item.name, item.quantity, item.alert_threshold)

    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: str, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id, InventoryItem.establishment_id == current_user.establishment_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable")
    db.delete(item)
    db.commit()

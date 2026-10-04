"""
Module Fournisseurs et bons de commande (nouveau, gestion interne
complete, demande M. Faustin) - reapprovisionnement du stock general.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Supplier, PurchaseOrder, InventoryItem, User, UserRole
from app.schemas import SupplierCreate, SupplierOut, PurchaseOrderCreate, PurchaseOrderOut
from app.deps import require_roles

router = APIRouter(tags=["fournisseurs"])

MANAGEMENT_ROLES = (UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER)


def _to_po_out(po: PurchaseOrder) -> PurchaseOrderOut:
    return PurchaseOrderOut(
        id=po.id, supplier_id=po.supplier_id, supplier_name=po.supplier.name,
        inventory_item_id=po.inventory_item_id, inventory_item_name=po.inventory_item.name if po.inventory_item else None,
        description=po.description, quantity=po.quantity, status=po.status,
        ordered_by_name=po.ordered_by.full_name, ordered_at=po.ordered_at, received_at=po.received_at,
    )


# ---------- FOURNISSEURS ----------

@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    supplier = Supplier(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        name=payload.name, contact_phone=payload.contact_phone,
        contact_email=payload.contact_email, notes=payload.notes,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/suppliers/mine", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    return db.query(Supplier).filter(Supplier.establishment_id == current_user.establishment_id).order_by(Supplier.name).all()


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: str, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id, Supplier.establishment_id == current_user.establishment_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur introuvable")
    db.delete(supplier)
    db.commit()


# ---------- BONS DE COMMANDE ----------

@router.post("/purchase-orders", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db),
                           current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    supplier = db.query(Supplier).filter(
        Supplier.id == payload.supplier_id, Supplier.establishment_id == current_user.establishment_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur introuvable")

    if payload.inventory_item_id:
        item = db.query(InventoryItem).filter(
            InventoryItem.id == payload.inventory_item_id, InventoryItem.establishment_id == current_user.establishment_id
        ).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article de stock introuvable")

    po = PurchaseOrder(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        supplier_id=payload.supplier_id, inventory_item_id=payload.inventory_item_id,
        description=payload.description, quantity=payload.quantity, status="pending",
        ordered_by_user_id=current_user.id,
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return _to_po_out(po)


@router.get("/purchase-orders/mine", response_model=list[PurchaseOrderOut])
def list_purchase_orders(po_status: str = None, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    query = db.query(PurchaseOrder).filter(PurchaseOrder.establishment_id == current_user.establishment_id)
    if po_status:
        query = query.filter(PurchaseOrder.status == po_status)
    orders = query.order_by(PurchaseOrder.ordered_at.desc()).all()
    return [_to_po_out(o) for o in orders]


@router.post("/purchase-orders/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_purchase_order(po_id: str, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    """
    NOUVEAU: a la reception, si le bon de commande est lie a un article du
    stock general, la quantite recue est AJOUTEE AUTOMATIQUEMENT au stock -
    evite une double saisie manuelle.
    """
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id, PurchaseOrder.establishment_id == current_user.establishment_id
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de commande introuvable")
    if po.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce bon de commande a déjà été traité")

    if po.inventory_item_id:
        item = db.query(InventoryItem).filter(InventoryItem.id == po.inventory_item_id).first()
        if item:
            item.quantity += po.quantity

    po.status = "received"
    po.received_at = datetime.utcnow()
    db.commit()
    db.refresh(po)
    return _to_po_out(po)


@router.post("/purchase-orders/{po_id}/cancel", response_model=PurchaseOrderOut)
def cancel_purchase_order(po_id: str, db: Session = Depends(get_db),
                           current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id, PurchaseOrder.establishment_id == current_user.establishment_id
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de commande introuvable")
    if po.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce bon de commande a déjà été traité")

    po.status = "cancelled"
    db.commit()
    db.refresh(po)
    return _to_po_out(po)

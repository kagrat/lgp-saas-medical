"""
Module "Valeurs de reference" + "Equipements" (nouveau, laboratoire).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReferenceValue, Equipment, User, UserRole
from app.schemas import ReferenceValueCreate, ReferenceValueOut, EquipmentCreate, EquipmentOut
from app.deps import require_roles

router = APIRouter(prefix="/lab-catalog", tags=["laboratoire-catalogue"])

LAB_STAFF_ROLES = (UserRole.ESTABLISHMENT_ADMIN, UserRole.LAB_TECHNICIAN)


@router.post("/reference-values", response_model=ReferenceValueOut, status_code=status.HTTP_201_CREATED)
def create_reference_value(payload: ReferenceValueCreate, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    entry = ReferenceValue(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        test_name=payload.test_name, unit=payload.unit,
        min_value=payload.min_value, max_value=payload.max_value, notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/reference-values/mine", response_model=list[ReferenceValueOut])
def list_reference_values(db: Session = Depends(get_db),
                           current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    return (
        db.query(ReferenceValue)
        .filter(ReferenceValue.establishment_id == current_user.establishment_id)
        .order_by(ReferenceValue.test_name)
        .all()
    )


@router.delete("/reference-values/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reference_value(entry_id: str, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    entry = db.query(ReferenceValue).filter(
        ReferenceValue.id == entry_id, ReferenceValue.establishment_id == current_user.establishment_id
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Valeur de référence introuvable")
    db.delete(entry)
    db.commit()


@router.post("/equipment", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(payload: EquipmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    item = Equipment(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        name=payload.name, status=payload.status, notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/equipment/mine", response_model=list[EquipmentOut])
def list_equipment(db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    return db.query(Equipment).filter(Equipment.establishment_id == current_user.establishment_id).order_by(Equipment.name).all()


@router.patch("/equipment/{equipment_id}", response_model=EquipmentOut)
def update_equipment(equipment_id: str, payload: EquipmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    item = db.query(Equipment).filter(
        Equipment.id == equipment_id, Equipment.establishment_id == current_user.establishment_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipement introuvable")
    item.name = payload.name
    item.status = payload.status
    item.notes = payload.notes
    db.commit()
    db.refresh(item)
    return item


@router.delete("/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(equipment_id: str, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(*LAB_STAFF_ROLES))):
    item = db.query(Equipment).filter(
        Equipment.id == equipment_id, Equipment.establishment_id == current_user.establishment_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipement introuvable")
    db.delete(item)
    db.commit()

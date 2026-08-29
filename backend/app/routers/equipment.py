"""
Module Equipement general (nouveau, gestion interne complete, demande M.
Faustin) - equipement medical HORS laboratoire (le laboratoire garde ses
propres routes dans lab_catalog.py, table partagee mais routes distinctes).
Ajoute le suivi de maintenance preventive, absent jusqu'ici.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Equipment, Department, User, UserRole
from app.schemas import GeneralEquipmentCreate, GeneralEquipmentOut
from app.deps import require_roles
from app.routers.notifications import create_maintenance_alert

router = APIRouter(prefix="/equipment", tags=["equipement"])


def _to_out(item: Equipment) -> GeneralEquipmentOut:
    maintenance_due = bool(item.next_maintenance_date and item.next_maintenance_date <= date.today())
    return GeneralEquipmentOut(
        id=item.id, name=item.name, category=item.category,
        department_id=item.department_id, department_name=item.department.name if item.department else None,
        status=item.status, notes=item.notes,
        last_maintenance_date=item.last_maintenance_date, next_maintenance_date=item.next_maintenance_date,
        maintenance_due=maintenance_due,
    )


@router.post("", response_model=GeneralEquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(payload: GeneralEquipmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departement introuvable")

    item = Equipment(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        department_id=payload.department_id, name=payload.name, category=payload.category,
        status=payload.status, notes=payload.notes,
        last_maintenance_date=payload.last_maintenance_date, next_maintenance_date=payload.next_maintenance_date,
    )
    db.add(item)

    if item.next_maintenance_date and item.next_maintenance_date <= date.today():
        create_maintenance_alert(db, current_user.establishment_id, item.name, item.next_maintenance_date)

    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.get("/mine", response_model=list[GeneralEquipmentOut])
def list_equipment(db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    items = db.query(Equipment).filter(Equipment.establishment_id == current_user.establishment_id).order_by(Equipment.name).all()
    return [_to_out(i) for i in items]


@router.patch("/{equipment_id}", response_model=GeneralEquipmentOut)
def update_equipment(equipment_id: str, payload: GeneralEquipmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    item = db.query(Equipment).filter(
        Equipment.id == equipment_id, Equipment.establishment_id == current_user.establishment_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipement introuvable")

    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departement introuvable")

    was_due = bool(item.next_maintenance_date and item.next_maintenance_date <= date.today())

    item.name = payload.name
    item.category = payload.category
    item.department_id = payload.department_id
    item.status = payload.status
    item.notes = payload.notes
    item.last_maintenance_date = payload.last_maintenance_date
    item.next_maintenance_date = payload.next_maintenance_date

    now_due = bool(item.next_maintenance_date and item.next_maintenance_date <= date.today())
    # NOUVEAU: meme logique de franchissement que les alertes de stock -
    # alerte uniquement au moment ou l'echeance passe due, pas a chaque
    # sauvegarde repetee.
    if now_due and not was_due:
        create_maintenance_alert(db, current_user.establishment_id, item.name, item.next_maintenance_date)

    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(equipment_id: str, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    item = db.query(Equipment).filter(
        Equipment.id == equipment_id, Equipment.establishment_id == current_user.establishment_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipement introuvable")
    db.delete(item)
    db.commit()

"""
Module "Services & tarifs" + "Salles/ressources" (nouveau).

Choix technique deliberé: aucun champ enum en base de donnees ici -
uniquement du texte simple (String) - pour eviter tout risque de devoir
refaire la manipulation ALTER TYPE qui nous a pose souci par le passe sur
d'autres modules.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Service, Room, User, UserRole, Admission, Department
from app.schemas import ServiceCreate, ServiceOut, RoomCreate, RoomOut
from app.deps import require_roles

router = APIRouter(prefix="/services", tags=["services-ressources"])


@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(payload: ServiceCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    service = Service(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        name=payload.name, price=payload.price,
        duration_minutes=payload.duration_minutes, description=payload.description,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/mine", response_model=list[ServiceOut])
def list_my_services(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    return db.query(Service).filter(Service.establishment_id == current_user.establishment_id).order_by(Service.name).all()


@router.get("/establishment/{establishment_id}", response_model=list[ServiceOut])
def public_services(establishment_id: str, db: Session = Depends(get_db)):
    """Public - permet a un patient de voir les tarifs avant de reserver."""
    return db.query(Service).filter(Service.establishment_id == establishment_id).order_by(Service.name).all()


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    service = db.query(Service).filter(Service.id == service_id, Service.establishment_id == current_user.establishment_id).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service introuvable")
    db.delete(service)
    db.commit()


def _to_room_out(db: Session, room: Room) -> RoomOut:
    # NOUVEAU (hospitalisation): occupation calculee a la volee, jamais
    # stockee, pour eviter toute desynchronisation avec la realite.
    active_admission = db.query(Admission).filter(Admission.room_id == room.id, Admission.status == "active").first()
    return RoomOut(
        id=room.id, name=room.name, room_type=room.room_type, capacity=room.capacity,
        department_id=room.department_id, department_name=room.department.name if room.department else None,
        is_occupied=active_admission is not None,
        current_patient_name=active_admission.patient.user.full_name if active_admission else None,
    )


@router.post("/rooms", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    if payload.department_id:
        dept = db.query(Department).filter(Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departement introuvable")

    room = Room(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        name=payload.name, room_type=payload.room_type, capacity=payload.capacity,
        department_id=payload.department_id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return _to_room_out(db, room)


@router.get("/rooms/mine", response_model=list[RoomOut])
def list_my_rooms(db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.HR_MANAGER))):
    rooms = db.query(Room).filter(Room.establishment_id == current_user.establishment_id).order_by(Room.name).all()
    return [_to_room_out(db, r) for r in rooms]


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: str, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    room = db.query(Room).filter(Room.id == room_id, Room.establishment_id == current_user.establishment_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salle introuvable")
    db.delete(room)
    db.commit()

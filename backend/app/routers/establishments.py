"""
Gestion des etablissements - reservee au Super Admin (niveau 1).
Section 4: ajout/suppression d'etablissements, suspension pour non-paiement.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Establishment, User, UserRole, AuditLog
from app.schemas import EstablishmentCreate, EstablishmentOut, EstablishmentStatusUpdate
from app.deps import require_roles
from app.security import hash_password

router = APIRouter(prefix="/establishments", tags=["etablissements"])


@router.post("", response_model=EstablishmentOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def create_establishment(payload: EstablishmentCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    existing_admin = db.query(User).filter(User.email == payload.admin_email.lower()).first()
    if existing_admin:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email admin est deja utilise")

    establishment = Establishment(
        id=str(uuid.uuid4()),
        name=payload.name,
        type=payload.type,
        city=payload.city,
        address=payload.address,
    )
    db.add(establishment)
    db.flush()

    admin_user = User(
        id=str(uuid.uuid4()),
        establishment_id=establishment.id,
        email=payload.admin_email.lower(),
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.admin_full_name,
        role=UserRole.ESTABLISHMENT_ADMIN,
    )
    db.add(admin_user)
    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id,
                     action="create_establishment", details=f"Creation de {establishment.name}"))
    db.commit()
    db.refresh(establishment)
    return establishment


@router.get("", response_model=list[EstablishmentOut],
            dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def list_establishments(db: Session = Depends(get_db)):
    return db.query(Establishment).order_by(Establishment.created_at.desc()).all()


@router.patch("/{establishment_id}/status", response_model=EstablishmentOut,
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def update_establishment_status(establishment_id: str, payload: EstablishmentStatusUpdate,
                                 db: Session = Depends(get_db),
                                 current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etablissement introuvable")

    establishment.is_active = payload.is_active
    if payload.subscription_status:
        establishment.subscription_status = payload.subscription_status

    action = "suspend_establishment" if not payload.is_active else "reactivate_establishment"
    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id, action=action,
                     details=f"Statut mis a jour: is_active={payload.is_active}"))
    db.commit()
    db.refresh(establishment)
    return establishment

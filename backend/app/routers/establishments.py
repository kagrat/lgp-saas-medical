"""
Gestion des etablissements - reservee au Super Admin (niveau 1).
Section 4: ajout/suppression d'etablissements, modification, suspension pour non-paiement.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Establishment, User, UserRole, AuditLog
from app.schemas import EstablishmentCreate, EstablishmentOut, EstablishmentStatusUpdate, EstablishmentUpdate
from app.deps import require_roles
from app.security import hash_password
from app.services.geo import resolve_city_coordinates

router = APIRouter(prefix="/establishments", tags=["etablissements"])


@router.post("", response_model=EstablishmentOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def create_establishment(payload: EstablishmentCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    existing_admin = db.query(User).filter(User.email == payload.admin_email.lower()).first()
    if existing_admin:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email admin est deja utilise")

    # Si le Super Admin ne fournit pas de coordonnees GPS precises, on utilise
    # une position approximative de la ville (voir app/services/geo.py) pour
    # que le moteur de suggestion puisse quand meme calculer une distance.
    latitude, longitude = payload.latitude, payload.longitude
    if latitude is None or longitude is None:
        approx = resolve_city_coordinates(payload.city)
        if approx:
            latitude, longitude = approx

    establishment = Establishment(
        id=str(uuid.uuid4()),
        name=payload.name,
        type=payload.type,
        city=payload.city,
        address=payload.address,
        latitude=latitude,
        longitude=longitude,
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


@router.patch("/{establishment_id}", response_model=EstablishmentOut,
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def update_establishment(establishment_id: str, payload: EstablishmentUpdate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """
    Modification complete d'un etablissement deja cree (nom, type, ville,
    adresse, coordonnees). Reponse au retour de M. SOGADJI FAUSTIN: il
    manquait un moyen de corriger un etablissement apres sa creation.
    Seuls les champs fournis (non None) sont modifies - les autres restent
    inchanges.
    """
    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etablissement introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(establishment, field, value)

    # Si la ville a change mais qu'aucune nouvelle coordonnee n'est fournie
    # explicitement dans cette meme requete, on reactualise la position
    # approximative pour que le moteur de suggestion reste coherent.
    if "city" in update_data and "latitude" not in update_data and "longitude" not in update_data:
        approx = resolve_city_coordinates(establishment.city)
        if approx:
            establishment.latitude, establishment.longitude = approx

    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id,
                     action="update_establishment", details=f"Modification de {establishment.name}"))
    db.commit()
    db.refresh(establishment)
    return establishment


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

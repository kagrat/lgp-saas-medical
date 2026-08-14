"""
Module 1 - Authentification et roles + gestion du profil personnel.

NOUVEAU: separation stricte, appliquee cote serveur (pas seulement a
l'ecran), entre le portail web (patients) et l'application Desktop
(etablissements + Super Admin). Chaque client (web ou desktop) envoie un
en-tete X-Client-Type ; le serveur refuse toute connexion incoherente avec
ce type de client, meme si les identifiants sont corrects. Ca garantit que
les deux produits sont reellement distincts, pas juste separes a l'ecran.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient, UserRole, AuditLog
from app.schemas import (
    LoginRequest, TokenResponse, PatientRegisterRequest, UserProfileUpdate, PasswordChangeRequest, UserProfileOut,
)
from app.security import verify_password, hash_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["authentification"])

STAFF_ROLES = {
    UserRole.SUPER_ADMIN, UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR,
    UserRole.SECRETARY, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN,
}


def _to_profile_out(user: User) -> UserProfileOut:
    return UserProfileOut(
        id=user.id, email=user.email, full_name=user.full_name, phone=user.phone,
        role=user.role, establishment_id=user.establishment_id,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db),
          x_client_type: str = Header(default="web")):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email ou mot de passe incorrect",
    )

    if not user or not verify_password(payload.password, user.hashed_password):
        raise invalid_credentials

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte desactive")

    # Separation stricte web/desktop, appliquee ici, pas juste a l'ecran.
    is_staff = user.role in STAFF_ROLES
    if x_client_type == "desktop" and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte patient n'est pas accessible depuis cette application. Utilise le portail web.",
        )
    if x_client_type == "web" and is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte doit se connecter depuis l'application LGP Console (Desktop).",
        )

    if user.establishment_id and user.role != UserRole.SUPER_ADMIN:
        if user.establishment and not user.establishment.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Etablissement suspendu. Contactez l'administrateur de la plateforme.",
            )

    token = create_access_token({
        "sub": user.id,
        "role": user.role.value,
        "establishment_id": user.establishment_id,
    })

    db.add(AuditLog(user_id=user.id, establishment_id=user.establishment_id, action="login", details=f"Connexion de {user.email}"))
    db.commit()

    return TokenResponse(access_token=token, role=user.role, establishment_id=user.establishment_id)


@router.post("/register-patient", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Un compte existe deja avec cet email")

    user = User(
        id=str(uuid.uuid4()),
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.PATIENT,
        establishment_id=None,
    )
    db.add(user)
    db.flush()

    dossier_number = f"PAT-{uuid.uuid4().hex[:8].upper()}"
    patient = Patient(
        id=str(uuid.uuid4()),
        user_id=user.id,
        dossier_number=dossier_number,
        date_of_birth=payload.date_of_birth,
    )
    db.add(patient)
    db.commit()

    token = create_access_token({"sub": user.id, "role": user.role.value, "establishment_id": None})
    return TokenResponse(access_token=token, role=user.role, establishment_id=None)


@router.get("/me", response_model=UserProfileOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return _to_profile_out(current_user)


@router.patch("/me", response_model=UserProfileOut)
def update_profile(payload: UserProfileUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if payload.email and payload.email.lower() != current_user.email:
        existing = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est deja utilise par un autre compte")
        current_user.email = payload.email.lower()

    if payload.full_name:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone

    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="update_profile", details="Profil modifie"))
    db.commit()
    db.refresh(current_user)
    return _to_profile_out(current_user)


@router.post("/change-password")
def change_password(payload: PasswordChangeRequest, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mot de passe actuel incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="change_password", details="Mot de passe modifie"))
    db.commit()
    return {"message": "Mot de passe mis a jour avec succes"}

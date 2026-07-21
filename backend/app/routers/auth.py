"""
Module 1 - Authentification et roles.

Regle de securite cle: SEUL le role patient peut s'auto-inscrire via
/auth/register-patient. Les comptes admin_etablissement, medecin, secretaire,
pharmacien sont crees exclusivement par un compte deja autorise
(super_admin cree les establishment_admin; establishment_admin cree
medecin/secretaire/pharmacien). Cela empeche toute elevation de privilege
par simple appel API.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient, UserRole, AuditLog
from app.schemas import LoginRequest, TokenResponse, PatientRegisterRequest
from app.security import verify_password, hash_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["authentification"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    # Message d'erreur generique volontaire: ne jamais reveler si c'est
    # l'email ou le mot de passe qui est incorrect (evite l'enumeration de comptes).
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email ou mot de passe incorrect",
    )

    if not user or not verify_password(payload.password, user.hashed_password):
        raise invalid_credentials

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte desactive")

    # Etablissement suspendu => acces bloque (sauf super_admin)
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
    db.flush()  # obtient user.id sans committer

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


@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "establishment_id": current_user.establishment_id,
    }

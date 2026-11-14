"""
Module 1 - Authentification et roles + gestion du profil personnel.

Separation stricte web/desktop appliquee cote serveur (X-Client-Type).
Ajout: sexe et lieu de residence au profil (demande M. Faustin).
"""
import logging
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from app.timeutils import utcnow

from fastapi import APIRouter, Depends, HTTPException, status, Header, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient, UserRole, AuditLog, PasswordResetToken, TwoFactorCode
from app.schemas import (
    LoginRequest, TokenResponse, PatientRegisterRequest, UserProfileUpdate, PasswordChangeRequest, UserProfileOut, UserPhotoUpdate,
    ForgotPasswordRequest, ResetPasswordRequest, LoginResponse, Verify2FARequest, TwoFactorToggle,
)
from app.security import verify_password, hash_password, create_access_token, burn_password_check
from app.ratelimit import rate_limit, allow_key, hash_key, too_many
from app.deps import get_current_user
from app.services.notifications import send_confirmation_email
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["authentification"])

# NOUVEAU (audit de securite complet): protection anti force-brute.
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

STAFF_ROLES = {
    UserRole.SUPER_ADMIN, UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR,
    UserRole.SECRETARY, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN,
    # CORRECTIF (bug reel decouvert en test): ces 4 roles ajoutes en Phase A
    # (gestion interne complete) n'avaient jamais ete ajoutes ICI - une
    # liste separee de ALLOWED_STAFF_ROLES dans establishments.py. Consequence
    # concrete: infirmier/agent d'accueil/comptable/RH n'ont jamais pu se
    # connecter a l'application desktop depuis leur creation, rejetes a tort
    # avec le message reserve aux comptes patient.
    UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.HR_MANAGER,
}


def _to_profile_out(user: User) -> UserProfileOut:
    return UserProfileOut(
        id=user.id, email=user.email, full_name=user.full_name, phone=user.phone,
        role=user.role, establishment_id=user.establishment_id,
        gender=user.gender, residence=user.residence, photo_url=user.photo_url,
        two_factor_enabled=user.two_factor_enabled,
    )


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(rate_limit("login", 60, 300))])
def login(payload: LoginRequest, db: Session = Depends(get_db),
          x_client_type: str = Header(default="web")):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="E-mail ou mot de passe incorrect",
    )

    # NOUVEAU (audit de securite complet, demande explicite de M. Faustin):
    # protection anti force-brute. Un compte verrouille est rejete SANS
    # meme verifier le mot de passe - inutile de faire l'effort de calcul
    # bcrypt pour un compte deja bloque, et ca evite de donner un signal
    # (temps de reponse different) qui pourrait aider un attaquant a
    # distinguer "mauvais mot de passe" de "compte verrouille".
    locked_out = HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Trop de tentatives échouées. Compte temporairement verrouillé, réessaie dans quelques minutes.",
    )
    if user and user.locked_until and user.locked_until > utcnow():
        raise locked_out

    if not user:
        # E-mail inconnu. Ne doit RIEN reveler: ni par la duree de la reponse
        # (avant, un e-mail inconnu etait refuse instantanement alors qu'un vrai
        # compte coutait un calcul bcrypt: on pouvait deviner quels comptes
        # existent), ni par le verrouillage (avant, seul un vrai compte se
        # verrouillait apres 5 essais). Meme sequence que pour un vrai compte:
        # 5 refus normaux, puis le MEME message de verrouillage.
        allowed, _ = allow_key(f"login-unknown:{hash_key(payload.email)}", MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES * 60)
        if not allowed:
            raise locked_out
        burn_password_check(payload.password)
        raise invalid_credentials

    if not verify_password(payload.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                user.locked_until = utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            db.commit()
        raise invalid_credentials

    # Connexion reussie: remet le compteur a zero.
    if user.failed_login_attempts:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé")

    is_staff = user.role in STAFF_ROLES
    if x_client_type == "desktop" and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte patient n'est pas accessible depuis cette application. Utilise le portail web.",
        )
    if x_client_type == "web" and is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte doit se connecter depuis l'application SpeedSanté+ (Desktop).",
        )

    if user.establishment_id and user.role != UserRole.SUPER_ADMIN:
        if user.establishment and not user.establishment.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Établissement suspendu. Contacte l'administrateur de la plateforme.",
            )

    # NOUVEAU (audit de securite complet, demande explicite de M. Faustin):
    # si l'utilisateur a active la double authentification, on ne
    # delivre PAS le jeton tout de suite - un code a 6 chiffres est
    # envoye par email, verifie ensuite via /auth/verify-2fa.
    if user.two_factor_enabled:
        raw_code = f"{secrets.randbelow(1_000_000):06d}"
        db.add(TwoFactorCode(
            id=str(uuid.uuid4()), user_id=user.id, code_hash=_hash_token(raw_code),
            expires_at=utcnow() + timedelta(minutes=10),
        ))
        db.commit()
        body = (
            f"Bonjour {user.full_name},\n\n"
            f"Voici ton code de vérification SpeedSanté+ (valable 10 minutes):\n\n{raw_code}\n\n"
            f"Si tu n'es pas à l'origine de cette connexion, change ton mot de passe immédiatement."
        )
        try:
            send_confirmation_email(user.email, "Ton code de vérification", body)
        except Exception:
            pass
        return LoginResponse(requires_2fa=True, message="Un code de vérification vient d'être envoyé à ton e-mail.")

    token = create_access_token({
        "sub": user.id,
        "role": user.role.value,
        "establishment_id": user.establishment_id,
    })

    db.add(AuditLog(user_id=user.id, establishment_id=user.establishment_id, action="login", details=f"Connexion de {user.email}"))
    db.commit()

    return LoginResponse(requires_2fa=False, token=TokenResponse(access_token=token, role=user.role, establishment_id=user.establishment_id))


@router.post("/verify-2fa", response_model=TokenResponse, dependencies=[Depends(rate_limit("verify-2fa", 30, 600))])
def verify_2fa(payload: Verify2FARequest, db: Session = Depends(get_db),
               x_client_type: str = Header(default="web")):
    """NOUVEAU (audit de securite complet): deuxieme etape de la
    connexion quand la double authentification est active - verifie le
    code recu par email et delivre alors le vrai jeton."""
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Code invalide ou expiré")
    locked_out = HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Trop de tentatives échouées. Compte temporairement verrouillé, réessaie dans quelques minutes.",
    )
    if not user:
        allowed, _ = allow_key(f"2fa-unknown:{hash_key(payload.email)}", MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES * 60)
        raise invalid if allowed else locked_out
    if user.locked_until and user.locked_until > utcnow():
        raise locked_out

    code_hash = _hash_token(payload.code)
    code_entry = (
        db.query(TwoFactorCode)
        .filter(
            TwoFactorCode.user_id == user.id, TwoFactorCode.code_hash == code_hash,
            TwoFactorCode.used == False, TwoFactorCode.expires_at > utcnow(),
        )
        .order_by(TwoFactorCode.created_at.desc())
        .first()
    )
    if not code_entry:
        # Le code a 6 chiffres n'a que 1 000 000 de combinaisons et reste valable 10
        # minutes: SANS limite d'essais, un script pouvait le deviner. 5 mauvais codes
        # verrouillent le compte (meme mecanisme que le mot de passe) ET annulent les
        # codes en attente: il faut refaire la connexion complete (donc le mot de passe).
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            db.query(TwoFactorCode).filter(TwoFactorCode.user_id == user.id, TwoFactorCode.used == False).update({"used": True})
        db.commit()
        raise invalid

    user.failed_login_attempts = 0
    user.locked_until = None
    code_entry.used = True
    token = create_access_token({
        "sub": user.id,
        "role": user.role.value,
        "establishment_id": user.establishment_id,
    })
    db.add(AuditLog(user_id=user.id, establishment_id=user.establishment_id, action="login_2fa", details=f"Connexion (2FA) de {user.email}"))
    db.commit()

    return TokenResponse(access_token=token, role=user.role, establishment_id=user.establishment_id)


@router.patch("/2fa")
def toggle_two_factor(payload: TwoFactorToggle, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    """NOUVEAU (audit de securite complet): chaque utilisateur active ou
    desactive la double authentification sur son PROPRE compte."""
    current_user.two_factor_enabled = payload.enabled
    db.commit()
    return {"two_factor_enabled": current_user.two_factor_enabled}


@router.post("/register-patient", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit("register", 10, 3600))])
def register_patient(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Un compte existe déjà avec cet e-mail")

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
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet e-mail est déjà utilisé par un autre compte")
        current_user.email = payload.email.lower()

    if payload.full_name:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.gender is not None:
        current_user.gender = payload.gender
    if payload.residence is not None:
        current_user.residence = payload.residence

    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="update_profile", details="Profil modifié"))
    db.commit()
    db.refresh(current_user)
    return _to_profile_out(current_user)


@router.patch("/me/photo", response_model=UserProfileOut)
def update_profile_photo(payload: UserPhotoUpdate, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    """NOUVEAU (demande explicite de M. Faustin: "un profil pour chaque
    medecin ou chaque utilisateur... il peut ajouter des photos a son
    profil") - ouvert a TOUT utilisateur connecte (medecin, infirmier,
    secretaire...), chacun ne modifie que sa PROPRE photo."""
    current_user.photo_url = payload.photo_url
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
                     action="change_password", details="Mot de passe modifié"))
    db.commit()
    return {"message": "Mot de passe mis à jour avec succès"}


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _send_reset_email(recipient: str, body: str) -> None:
    """Best-effort: un echec d'envoi est journalise (sans l'adresse) mais jamais montre a l'appelant."""
    try:
        send_confirmation_email(recipient, "Réinitialisation de ton mot de passe", body)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger("lgp.auth").warning("Envoi de l'e-mail de reinitialisation echoue (%s)", type(exc).__name__)


@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot", 10, 900))])
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    NOUVEAU (lacune de securite identifiee lors d'un audit complet):
    jusqu'ici, un mot de passe oublie n'avait AUCUN moyen d'etre recupere
    sans intervention manuelle d'un admin. Repond TOUJOURS avec le meme
    message generique, que l'email existe ou non - evite qu'un attaquant
    puisse decouvrir quels emails sont enregistres sur la plateforme
    (enumeration d'utilisateurs, faille classique).
    """
    generic_response = {"message": "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé."}

    # Au plus 3 e-mails de reinitialisation par heure et par adresse: sans cela, n'importe
    # qui pouvait inonder la boite d'une victime. Reponse IDENTIQUE (rien n'est revele).
    allowed, _ = allow_key(f"forgot-email:{hash_key(payload.email)}", 3, 3600)
    if not allowed:
        return generic_response

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not user.is_active:
        return generic_response

    raw_token = secrets.token_urlsafe(32)
    reset_token = PasswordResetToken(
        id=str(uuid.uuid4()), user_id=user.id, token_hash=_hash_token(raw_token),
        expires_at=utcnow() + timedelta(hours=1),
    )
    db.add(reset_token)
    db.commit()

    reset_link = f"{settings.frontend_url}/reinitialiser-mot-de-passe?token={raw_token}"
    body = (
        f"Bonjour {user.full_name},\n\n"
        f"Une demande de réinitialisation de mot de passe a été faite pour ton compte SpeedSanté+.\n"
        f"Clique sur ce lien pour choisir un nouveau mot de passe (valable 1 heure):\n{reset_link}\n\n"
        f"Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail - "
        f"ton mot de passe actuel reste inchangé."
    )
    # Envoi en TACHE DE FOND: la reponse part tout de suite. Avant, l'envoi SMTP (plusieurs
    # secondes) bloquait la requete pour un e-mail existant seulement: duree de reponse
    # revelatrice, et un serveur de messagerie lent pouvait saturer l'application.
    background_tasks.add_task(_send_reset_email, user.email, body)

    return generic_response


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset", 20, 900))])
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.token)
    reset_token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash, PasswordResetToken.used == False)
        .first()
    )
    if not reset_token or reset_token.expires_at < utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce lien de réinitialisation est invalide ou a expiré")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce lien de réinitialisation est invalide ou a expiré")

    user.hashed_password = hash_password(payload.new_password)
    reset_token.used = True

    # NOUVEAU: invalide aussi tout AUTRE token de reinitialisation encore
    # actif pour ce meme utilisateur - evite qu'un ancien lien envoye plus
    # tot (et jamais utilise) reste exploitable apres coup.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.id != reset_token.id, PasswordResetToken.used == False
    ).update({"used": True})

    db.add(AuditLog(user_id=user.id, establishment_id=user.establishment_id,
                     action="reset_password", details="Mot de passe réinitialisé via lien e-mail"))
    db.commit()
    return {"message": "Mot de passe réinitialisé avec succès"}

"""
Securite: hachage des mots de passe (bcrypt) et jetons JWT.

Regle: le mot de passe en clair ne transite jamais en dehors de la requete
de login/creation de compte, et n'est JAMAIS logge ni stocke.

Bibliotheques (choix documente dans requirements.in):
  - PyJWT   : remplace python-jose (4 failles connues, dependance ecdsa sans
              correctif prevu).
  - bcrypt  : utilise directement, remplace passlib (abandonne depuis 2020).
Les jetons deja emis (HS256) et les hachages deja stockes ($2b$...) restent
valides: aucune reconnexion forcee, aucune migration de donnees.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()

# bcrypt ne lit que les 72 premiers octets d'un mot de passe. passlib tronquait
# silencieusement a cette limite: on fait pareil pour rester compatible avec
# les hachages deja en base (bcrypt >= 5 leve une erreur au-dela de 72 octets).
_BCRYPT_MAX_BYTES = 72
_BCRYPT_ROUNDS = 12

# Tolerance d'horloge (secondes) entre les serveurs qui emettent et verifient un jeton.
_JWT_LEEWAY_SECONDS = 10


def _password_bytes(plain_password: str) -> bytes:
    return plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(_password_bytes(plain_password), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare un mot de passe a son hachage. Un hachage illisible = refus (jamais d'exception)."""
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), hashed_password.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


# Hachage factice, calcule une seule fois: permet de depenser le MEME temps de
# calcul quand l'e-mail n'existe pas, pour qu'un attaquant ne puisse pas
# deviner quels comptes existent en mesurant la duree de la reponse.
_DUMMY_HASH = hash_password("mot-de-passe-factice-pour-egaliser-le-temps")


def burn_password_check(plain_password: str) -> None:
    """A appeler quand le compte est introuvable, pour egaliser le temps de reponse."""
    verify_password(plain_password, _DUMMY_HASH)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Cree un JWT signe. Le payload doit contenir au minimum:
    sub (user id), role, establishment_id (ou None pour super_admin).
    """
    now = datetime.now(timezone.utc)
    to_encode = data.copy()
    to_encode.update({
        "exp": now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes)),
        "iat": now,
    })
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Retourne le payload si le jeton est valide et non expire, sinon None.
    Un jeton sans date d'expiration ("exp") ou sans utilisateur ("sub") est refuse.
    """
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
            leeway=_JWT_LEEWAY_SECONDS,
        )
    except jwt.PyJWTError:
        return None

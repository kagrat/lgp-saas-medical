"""
Compatibilite avec les jetons et mots de passe EMIS PAR L'ANCIENNE PILE
(passlib + python-jose): les valeurs ci-dessous ont ete generees par ces
bibliotheques avant leur remplacement par bcrypt + PyJWT. Ce test garantit que
les utilisateurs deja connectes ne sont pas deconnectes et que les mots de
passe deja en base restent valides apres une mise a jour de securite.
"""
import base64
import time

import jwt as pyjwt
import pytest

from app import security

LEGACY_SECRET = 'secret-de-test-assez-long-pour-hs256-0123456789'
LEGACY_HASHES = {'simple': '$2b$12$5UiLi0DIXJaG07.51duQXOF9RUW7hfHdhYl7t99z3AbbcDEssxSVW', 'accents': '$2b$12$j8OabBhUgoanHUqxALGdDuzSr.J0WsZsGnBb4mDv73kSdUlZTmxl2', 'long_90_car': '$2b$12$MBnE6CePhRxFvlthWVgJb.5pM/yAxMBcH20D2BAFLGJnnpYSg0J/i'}
LEGACY_PASSWORDS = {'simple': 'Passw0rd123', 'accents': 'Motdepasse-é-ç-à1', 'long_90_car': 'Aa1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
# exp = 2100-01-01: fixe lointain pour que ce test ne devienne jamais "periment" avec le temps
LEGACY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJkb2N0b3IiLCJlc3RhYmxpc2htZW50X2lkIjoiRTEiLCJleHAiOjQxMDI0NDQ4MDAsImlhdCI6MTc5NDIzMzAzOX0.R1eRci7q3naae4Gm7m2SMxSreQZfJTzXEw38DV5GF-I'
LEGACY_TOKEN_WITHOUT_EXP = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.-KQmg1QiZx75BnraGJ5u5FYFjPP_2h__pyJI_xwlxMw'


@pytest.fixture()
def legacy_secret(monkeypatch):
    monkeypatch.setattr(security.settings, "jwt_secret_key", LEGACY_SECRET)


@pytest.mark.parametrize("name", sorted(LEGACY_HASHES))
def test_hash_emis_par_passlib_reste_valide(name):
    password = LEGACY_PASSWORDS[name]
    assert security.verify_password(password, LEGACY_HASHES[name])
    assert not security.verify_password("Mauvais1" + password, LEGACY_HASHES[name])


def test_mot_de_passe_de_plus_de_72_octets_compatible():
    """passlib ignorait silencieusement tout apres 72 octets: on fait pareil (bcrypt 5 leverait une erreur)."""
    long_password = LEGACY_PASSWORDS["long_90_car"]
    assert security.verify_password(long_password, LEGACY_HASHES["long_90_car"])
    new_hash = security.hash_password(long_password)
    assert security.verify_password(long_password, new_hash)


def test_hachage_illisible_est_un_refus_pas_une_exception():
    assert security.verify_password("x", "pas-un-hachage") is False
    assert security.verify_password("x", "") is False


def test_jeton_emis_par_python_jose_reste_valide(legacy_secret):
    payload = security.decode_access_token(LEGACY_TOKEN)
    assert payload and payload["sub"] == "user-123" and payload["role"] == "doctor"


def test_jeton_sans_expiration_refuse(legacy_secret):
    assert security.decode_access_token(LEGACY_TOKEN_WITHOUT_EXP) is None


def test_jeton_neuf_valide_et_jeton_altere_refuse():
    token = security.create_access_token({"sub": "u1", "role": "patient"})
    assert security.decode_access_token(token)["sub"] == "u1"
    assert security.decode_access_token(token + "x") is None
    assert security.decode_access_token("n.importe.quoi") is None
    assert security.decode_access_token("") is None


def test_jeton_signe_avec_une_autre_cle_refuse():
    forged = pyjwt.encode({"sub": "u1", "exp": int(time.time()) + 99}, "autre-cle-0123456789-0123456789-0123456789", algorithm="HS256")
    assert security.decode_access_token(forged) is None


def test_jeton_expire_refuse():
    expired = pyjwt.encode({"sub": "u1", "exp": int(time.time()) - 600}, security.settings.jwt_secret_key, algorithm="HS256")
    assert security.decode_access_token(expired) is None


def test_attaque_alg_none_refusee():
    header = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(b'{"sub":"u1","exp":9999999999}').rstrip(b"=").decode()
    assert security.decode_access_token(f"{header}.{body}.") is None

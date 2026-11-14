"""
Protection contre les abus: limiteur de debit, enumeration de comptes, double
authentification, mot de passe oublie, commande sans compte, images.
"""
from app.timeutils import utcnow
import base64
import datetime

import pytest
from pydantic import ValidationError
from starlette.requests import Request

from app import ratelimit
from app.config import get_settings
from app.models import (
    PasswordResetToken, PharmacyReservation, TwoFactorCode, User, UserRole, EstablishmentType,
)
from app.ratelimit import SlidingWindowLimiter, client_ip
from app.routers.auth import _hash_token
from app.schemas import UserPhotoUpdate
from app.security import hash_password
from app.validators import validate_image_data_url
from tests.helpers import TINY_PNG_DATA_URL, uid


# ================================================================ limiteur (unites)
class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture()
def clock(monkeypatch):
    c = FakeClock()
    monkeypatch.setattr(ratelimit.time, "monotonic", c)
    return c


def test_fenetre_glissante(clock):
    lim = SlidingWindowLimiter()
    assert [lim.allow("k", 3, 60)[0] for _ in range(3)] == [True, True, True]
    allowed, retry = lim.allow("k", 3, 60)
    assert allowed is False and 1 <= retry <= 61
    clock.now += 61
    assert lim.allow("k", 3, 60)[0] is True, "la fenetre a glisse: de nouveau autorise"


def test_un_appel_refuse_n_est_pas_compte(clock):
    """Un visiteur legitime qui reessaie ne doit pas prolonger son propre blocage."""
    lim = SlidingWindowLimiter()
    for _ in range(2):
        lim.allow("k", 2, 60)
    for _ in range(50):
        assert lim.allow("k", 2, 60)[0] is False
    clock.now += 61
    assert lim.allow("k", 2, 60)[0] is True


def test_cles_independantes(clock):
    lim = SlidingWindowLimiter()
    lim.allow("a", 1, 60)
    assert lim.allow("a", 1, 60)[0] is False
    assert lim.allow("b", 1, 60)[0] is True


def test_memoire_bornee_face_a_un_attaquant_qui_change_de_cle(clock):
    lim = SlidingWindowLimiter(max_keys=100)
    for i in range(5000):
        lim.allow(f"cle-{i}", 5, 60)
    assert len(lim._events) <= 100


def _request(forwarded=None, client="10.0.0.1"):
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": (client, 1234), "method": "GET", "path": "/"})


def test_adresse_ip_ignore_les_valeurs_falsifiees_par_le_visiteur(monkeypatch):
    """Le visiteur peut ecrire X-Forwarded-For: 6.6.6.6 pour se faire passer pour quelqu'un d'autre:
    seule la valeur ajoutee par notre proxy (la derniere) est fiable."""
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 1)
    assert client_ip(_request("6.6.6.6, 203.0.113.9")) == "203.0.113.9"
    assert client_ip(_request("1.1.1.1, 2.2.2.2, 203.0.113.9")) == "203.0.113.9"
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 2)
    assert client_ip(_request("6.6.6.6, 203.0.113.9, 172.16.0.5")) == "203.0.113.9"


def test_adresse_ip_sans_proxy_ou_invalide(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 0)
    assert client_ip(_request("6.6.6.6", client="198.51.100.4")) == "198.51.100.4"
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 1)
    assert client_ip(_request("pas-une-ip")) == "unknown"
    assert client_ip(_request(None, client="198.51.100.4")) == "198.51.100.4"


def test_ipv6_limite_par_bloc_de_64_bits(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 1)
    a = client_ip(_request("2001:db8:1:2::1"))
    b = client_ip(_request("2001:db8:1:2:ffff:ffff:ffff:ffff"))
    c = client_ip(_request("2001:db8:1:3::1"))
    assert a == b != c


def test_limitation_desactivable_pour_les_tests(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", False)
    assert all(client.get("/doctors/search").status_code != 429 for _ in range(130))


# ================================================================ connexion: pas d'enumeration de comptes
def _login(client, email, password="MauvaisMotDePasse1"):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_compte_inconnu_et_compte_reel_se_comportent_exactement_pareil(client, world):
    """Avant: un e-mail inconnu etait refuse instantanement et ne se verrouillait jamais, un vrai compte coutait un
    calcul bcrypt et se verrouillait apres 5 essais: deux fuites qui permettaient de deviner quels comptes existent."""
    user = world.user(UserRole.PATIENT, email="reel@test.com")
    user.hashed_password = hash_password("BonMotDePasse1")
    world.db.commit()

    reel = [_login(client, "reel@test.com") for _ in range(7)]
    inconnu = [_login(client, "fantome@test.com") for _ in range(7)]
    assert [r.status_code for r in reel] == [r.status_code for r in inconnu] == [401] * 5 + [429] * 2
    assert reel[0].json() == inconnu[0].json()
    assert reel[5].json() == inconnu[5].json()


def test_compte_inconnu_depense_le_meme_calcul_qu_un_vrai_compte(client, monkeypatch):
    from app.routers import auth
    calls = []
    monkeypatch.setattr(auth, "burn_password_check", lambda pw: calls.append(pw))
    _login(client, "fantome@test.com", "Un-Mot-De-Passe-1")
    assert calls == ["Un-Mot-De-Passe-1"]


def test_compte_verrouille_refuse_meme_le_bon_mot_de_passe(client, world):
    user = world.user(UserRole.PATIENT, email="bloque@test.com")
    user.hashed_password = hash_password("BonMotDePasse1")
    world.db.commit()
    for _ in range(5):
        _login(client, "bloque@test.com")
    assert _login(client, "bloque@test.com", "BonMotDePasse1").status_code == 429


def test_connexion_reussie_remet_le_compteur_a_zero(client, world):
    user = world.user(UserRole.PATIENT, email="ok@test.com")
    user.hashed_password = hash_password("BonMotDePasse1")
    world.db.commit()
    for _ in range(4):
        _login(client, "ok@test.com")
    assert _login(client, "ok@test.com", "BonMotDePasse1").status_code == 200
    world.db.refresh(user)
    assert user.failed_login_attempts == 0


# ================================================================ double authentification
def _user_with_2fa(world, code="123456"):
    user = world.user(UserRole.PATIENT, email="2fa@test.com")
    user.two_factor_enabled = True
    world.db.add(TwoFactorCode(
        id=uid(), user_id=user.id,
        code_hash=_hash_token(code), expires_at=utcnow() + datetime.timedelta(minutes=10),
    ))
    world.db.commit()
    return user


def _verify(client, code):
    return client.post("/auth/verify-2fa", json={"email": "2fa@test.com", "code": code})


def test_2fa_cinq_mauvais_codes_verrouillent_le_compte(client, world):
    """Un code a 6 chiffres n'a que 1 000 000 de combinaisons: sans limite d'essais, un script pouvait le deviner."""
    user = _user_with_2fa(world)
    assert [_verify(client, "000000").status_code for _ in range(5)] == [401] * 5
    bon_code = _verify(client, "123456")
    assert bon_code.status_code == 429, "meme le BON code est refuse une fois le compte verrouille"
    world.db.refresh(user)
    assert user.locked_until is not None
    restants = world.db.query(TwoFactorCode).filter(TwoFactorCode.user_id == user.id, TwoFactorCode.used == False).count()
    assert restants == 0, "les codes en attente sont annules: il faut refaire la connexion complete"


def test_2fa_bon_code_apres_quelques_erreurs_fonctionne_et_remet_a_zero(client, world):
    user = _user_with_2fa(world)
    for _ in range(3):
        assert _verify(client, "000000").status_code == 401
    ok = _verify(client, "123456")
    assert ok.status_code == 200 and "access_token" in ok.json()
    world.db.refresh(user)
    assert user.failed_login_attempts == 0 and user.locked_until is None


def test_2fa_compte_inconnu_meme_sequence_qu_un_compte_reel(client, world):
    _user_with_2fa(world)
    reel = [_verify(client, "000000").status_code for _ in range(6)]
    inconnu = [client.post("/auth/verify-2fa", json={"email": "fantome@test.com", "code": "000000"}).status_code for _ in range(6)]
    assert reel == inconnu == [401] * 5 + [429]


# ================================================================ inscription / mot de passe oublie
def test_mot_de_passe_trop_long_refuse(client):
    r = client.post("/auth/register-patient", json={"email": "long@test.com", "password": "Aa1" + "x" * 200, "full_name": "Long"})
    assert r.status_code == 422


def test_inscription_limitee_par_adresse_ip(client):
    codes = [client.post("/auth/register-patient", json={
        "email": f"p{i}@test.com", "password": "Passw0rd123", "full_name": "Test"}).status_code for i in range(12)]
    assert codes[:10] == [201] * 10 and codes[10:] == [429, 429]


def test_mot_de_passe_oublie_limite_par_adresse_et_reponse_identique(client, world, monkeypatch):
    envoyes = []
    from app.routers import auth
    monkeypatch.setattr(auth, "send_confirmation_email", lambda to, subject, body: envoyes.append(to))
    user = world.user(UserRole.PATIENT, email="victime@test.com")

    reponses = [client.post("/auth/forgot-password", json={"email": "victime@test.com"}) for _ in range(6)]
    assert all(r.status_code == 200 for r in reponses), "jamais d'erreur visible: rien n'est revele"
    assert len({r.text for r in reponses}) == 1
    jetons = world.db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).count()
    assert jetons == 3 and len(envoyes) == 3, "3 e-mails par heure au maximum: la boite de la victime n'est pas inondee"
    inconnu = client.post("/auth/forgot-password", json={"email": "fantome@test.com"})
    assert inconnu.text == reponses[0].text, "meme reponse pour un e-mail inconnu"


def test_envoi_de_l_email_ne_bloque_pas_la_reponse(client, world, monkeypatch):
    """L'envoi part en tache de fond: une erreur SMTP ne se voit jamais et ne change pas la reponse."""
    from app.routers import auth

    def smtp_en_panne(*args):
        raise ConnectionError("SMTP injoignable")

    monkeypatch.setattr(auth, "send_confirmation_email", smtp_en_panne)
    world.user(UserRole.PATIENT, email="a@test.com")
    r = client.post("/auth/forgot-password", json={"email": "a@test.com"})
    assert r.status_code == 200


# ================================================================ commande sans compte
@pytest.fixture()
def pharmacy(world):
    return world.establishment("Pharmacie Test", EstablishmentType.PHARMACIE)


def _guest(client, pharmacy, **overrides):
    payload = {"establishment_id": pharmacy.id, "full_name": "Jean Sans-Compte", "phone": "+229 94 85-68.98",
               "delivery_mode": "pickup", "prescription_image": TINY_PNG_DATA_URL}
    payload.update(overrides)
    return client.post("/pharmacy/reservations/guest", json=payload)


def test_commande_invite_valide(client, pharmacy):
    r = _guest(client, pharmacy)
    assert r.status_code == 201 and r.json()["is_guest_order"] is True


def test_un_seul_compte_invite_par_numero_de_telephone(client, pharmacy, world):
    """Avant: un nouveau compte a chaque appel (30 appels = 30 comptes)."""
    for phone in ("+229 94 85-68.98", "+22994856898", "+229.94.85.68.98"):
        assert _guest(client, pharmacy, phone=phone).status_code == 201
    comptes = world.db.query(User).filter(User.email.like("invite-%@sans-compte.speedsante.local")).count()
    assert comptes == 1


def test_plafond_de_commandes_par_telephone_enregistre_en_base(client, pharmacy, world):
    assert [_guest(client, pharmacy).status_code for _ in range(5)] == [201] * 5
    sixieme = _guest(client, pharmacy)
    assert sixieme.status_code == 429 and sixieme.headers["retry-after"] == "3600"
    assert world.db.query(PharmacyReservation).count() == 5
    assert _guest(client, pharmacy, phone="+22900000001").status_code == 201, "un AUTRE numero n'est pas concerne"


def test_commande_invite_refuse_les_pharmacies_inexistantes(client):
    assert client.post("/pharmacy/reservations/guest", json={
        "establishment_id": "00000000-0000-0000-0000-000000000000", "full_name": "Jean", "phone": "+22994856898",
        "prescription_image": TINY_PNG_DATA_URL}).status_code == 404


@pytest.mark.parametrize("telephone", ["abc", "12", "+229 94 85 68 98 12 34 56 78 90 12", "<script>"])
def test_commande_invite_refuse_un_telephone_invalide(client, pharmacy, telephone):
    assert _guest(client, pharmacy, phone=telephone).status_code == 422


# ================================================================ images
def _data_url(raw: bytes, mime="png") -> str:
    return f"data:image/{mime};base64," + base64.b64encode(raw).decode()


PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


@pytest.mark.parametrize("valeur,raison", [
    ("data:image/svg+xml;base64," + base64.b64encode(b"<svg onload=alert(1)/>" + b"x" * 80).decode(), "SVG (peut contenir du script)"),
    ("data:image/gif;base64," + base64.b64encode(b"GIF89a" + b"\0" * 100).decode(), "GIF"),
    ("data:image/heic;base64," + base64.b64encode(b"\0" * 100).decode(), "HEIC"),
    ("data:text/html;base64," + base64.b64encode(b"<script>alert(1)</script>").decode(), "HTML"),
    ("javascript:alert(1)", "pas une data URL"),
    ("data:image/png;base64,@@@pas-du-base64@@@", "base64 invalide"),
    ("data:image/png;base64,AAAA", "trop petite / vide"),
    (_data_url(JPEG_MAGIC + b"\0" * 100, "png"), "annonce PNG mais contenu JPEG"),
    (_data_url(b"MZ" + b"\0" * 100, "png"), "executable deguise en PNG"),
    (_data_url(PNG_MAGIC + b"\0" * (4 * 1024 * 1024)), "trop lourde"),
    ("", "vide"),
])
def test_images_dangereuses_ou_invalides_refusees(valeur, raison):
    with pytest.raises(ValueError):
        validate_image_data_url(valeur, max_decoded_bytes=3 * 1024 * 1024)


@pytest.mark.parametrize("valeur", [
    TINY_PNG_DATA_URL,
    _data_url(JPEG_MAGIC + b"\0" * 100, "jpeg"),
    _data_url(JPEG_MAGIC + b"\0" * 100, "jpg"),
    _data_url(b"RIFF\0\0\0\0WEBP" + b"\0" * 100, "webp"),
])
def test_vraies_images_acceptees(valeur):
    assert validate_image_data_url(valeur, max_decoded_bytes=3 * 1024 * 1024) == valeur


def test_photo_de_profil_et_logo_utilisent_la_meme_validation():
    assert UserPhotoUpdate(photo_url=TINY_PNG_DATA_URL).photo_url == TINY_PNG_DATA_URL
    with pytest.raises(ValidationError):
        UserPhotoUpdate(photo_url="data:image/svg+xml;base64," + base64.b64encode(b"<svg/>" + b"x" * 80).decode())

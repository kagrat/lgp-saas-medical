"""
Exploitation et robustesse: sante reelle, erreurs propres, en-tetes de securite,
CORS, configuration de production, adresse de la base.
"""
import json
import logging

import pytest
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.database import get_db, normalize_database_url
from app.observability import JsonFormatter, request_id_var, security_headers

ORIGIN = "http://localhost:5173"


def _settings(**overrides) -> Settings:
    base = dict(database_url="sqlite://", jwt_secret_key="x" * 64, environment="development", cors_origins=ORIGIN)
    base.update(overrides)
    return Settings(_env_file=None, **base)


# ---------------------------------------------------------------- sante
def test_health_live_ne_depend_pas_de_la_base(client):
    r = client.get("/health/live")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_health_interroge_la_base(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["database"] == "ok" and "schema" in r.json()


def test_health_repond_503_quand_la_base_est_injoignable(client, monkeypatch):
    """Avant, /health repondait 'ok' meme base eteinte: aucune panne n'etait detectable."""
    from app import main

    class Broken:
        def connect(self):
            raise OperationalError("SELECT 1", {}, Exception("connexion refusee"))

    monkeypatch.setattr(main, "engine", Broken())
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json() == {"status": "unavailable", "database": "unreachable"}


# ---------------------------------------------------------------- erreurs propres
def _break_database(client, exc):
    def broken():
        raise exc
        yield  # pragma: no cover

    client.app.dependency_overrides[get_db] = broken


def test_erreur_inattendue_ne_revele_aucun_detail_technique(client):
    _break_database(client, RuntimeError("password=SECRET-INTERNE table users"))
    r = client.get("/doctors/search")
    assert r.status_code == 500
    body = r.json()["detail"]
    assert "SECRET-INTERNE" not in r.text and "Traceback" not in r.text and "users" not in body
    request_id = r.headers["x-request-id"]
    assert request_id in body, "la reference de l'erreur doit etre communiquee a l'utilisateur"


def test_base_indisponible_repond_503_avec_retry_after(client):
    _break_database(client, OperationalError("SELECT", {}, Exception("connexion refusee")))
    r = client.get("/doctors/search")
    assert r.status_code == 503
    assert r.headers["retry-after"] == "5"
    assert "indisponible" in r.json()["detail"]


def test_les_erreurs_portent_les_en_tetes_cors(client):
    """Sinon le navigateur affiche une erreur reseau opaque au lieu du vrai message."""
    _break_database(client, RuntimeError("boom"))
    r = client.get("/doctors/search", headers={"Origin": ORIGIN})
    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") == ORIGIN
    assert "x-request-id" in r.headers.get("access-control-expose-headers", "").lower()


def test_requete_trop_volumineuse_refusee_413(client):
    r = client.post("/auth/login", content=b"x" * (11 * 1024 * 1024), headers={"content-type": "application/json"})
    assert r.status_code == 413


# ---------------------------------------------------------------- en-tetes
def test_en_tetes_de_securite_et_identifiant_de_requete(client):
    r = client.get("/auth/me")
    h = r.headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert h["cache-control"] == "no-store"
    assert h["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in h["content-security-policy"]
    assert len(h["x-request-id"]) >= 8


def test_identifiant_de_requete_entrant_conserve_ou_remplace(client):
    ok = client.get("/health/live", headers={"X-Request-ID": "abc-12345678"})
    assert ok.headers["x-request-id"] == "abc-12345678"
    mauvais = client.get("/health/live", headers={"X-Request-ID": "<script>alert(1)</script>"})
    assert mauvais.headers["x-request-id"] != "<script>alert(1)</script>" and len(mauvais.headers["x-request-id"]) == 32


def test_hsts_uniquement_en_production():
    assert "Strict-Transport-Security" in security_headers("/x", is_production=True)
    assert "Strict-Transport-Security" not in security_headers("/x", is_production=False)


# ---------------------------------------------------------------- CORS
def test_toutes_les_methodes_utilisees_par_les_routes_sont_autorisees_par_le_cors(client):
    """Aurait detecte l'oubli de PUT (la page des parametres de la plateforme etait bloquee)."""
    methods = {m.upper() for path in client.app.openapi()["paths"].values() for m in path if m in ("get", "post", "put", "patch", "delete")}
    for method in sorted(methods):
        r = client.options("/auth/login", headers={"Origin": ORIGIN, "Access-Control-Request-Method": method,
                                                   "Access-Control-Request-Headers": "authorization,content-type"})
        assert r.status_code == 200, f"{method} refuse par le CORS"


def test_origine_inconnue_refusee_par_le_cors(client):
    r = client.options("/auth/login", headers={"Origin": "https://pirate.example", "Access-Control-Request-Method": "POST"})
    assert r.status_code == 400
    assert "access-control-allow-origin" not in r.headers


# ---------------------------------------------------------------- journaux
def test_journal_ne_contient_ni_mot_de_passe_ni_parametres_d_url(client, caplog):
    with caplog.at_level(logging.INFO, logger="lgp.http"):
        client.post("/auth/login", json={"email": "nobody@test.com", "password": "MotDePasse-Secret1"})
        client.get("/doctors/search?name=PARAMETRE-CONFIDENTIEL")
    texte = " ".join(f"{r.getMessage()} {getattr(r, 'path', '')}" for r in caplog.records)
    assert "MotDePasse-Secret1" not in texte and "PARAMETRE-CONFIDENTIEL" not in texte
    assert "/auth/login" in texte


def test_format_json_contient_l_identifiant_de_requete():
    request_id_var.set("req-test-0001")
    record = logging.LogRecord("lgp", logging.ERROR, __file__, 1, "message", None, None)
    record.status = 500
    data = json.loads(JsonFormatter().format(record))
    assert data["request_id"] == "req-test-0001" and data["status"] == 500 and data["level"] == "ERROR"


# ---------------------------------------------------------------- configuration
def test_configuration_de_production_saine_sans_probleme():
    fatal, warnings = _settings(environment="production", cors_origins="https://app.exemple.com",
                                frontend_url="https://app.exemple.com", smtp_host="smtp.exemple.com").security_problems()
    assert fatal == [] and warnings == []


@pytest.mark.parametrize("secret", ["change_me_generate_a_real_random_secret", "secret", "test-secret-key"])
def test_cle_d_exemple_refusee_en_production(secret):
    fatal, _ = _settings(environment="production", jwt_secret_key=secret).security_problems()
    assert any("JWT_SECRET_KEY" in f for f in fatal)


def test_cle_d_exemple_tolere_en_developpement():
    fatal, _ = _settings(environment="development", jwt_secret_key="change_me").security_problems()
    assert fatal == []


def test_cle_courte_est_un_avertissement_jamais_une_panne():
    fatal, warnings = _settings(environment="production", jwt_secret_key="courte", cors_origins="https://a.com",
                                frontend_url="https://a.com", smtp_host="s").security_problems()
    assert fatal == [] and any("courte" in w for w in warnings)


def test_cors_etoile_refuse():
    fatal, _ = _settings(cors_origins="*").security_problems()
    assert any("CORS_ORIGINS" in f for f in fatal)


def test_production_avec_adresses_locales_avertit():
    _, warnings = _settings(environment="production", cors_origins="http://localhost:5173").security_problems()
    assert any("localhost" in w for w in warnings)


def test_serveur_railway_sans_environment_production_avertit(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    _, warnings = _settings(environment="development").security_problems()
    assert any("/docs" in w for w in warnings)


@pytest.mark.parametrize("algo", ["none", "RS256", "HS1", ""])
def test_algorithme_jwt_dangereux_refuse_au_demarrage(algo):
    with pytest.raises(ValueError):
        _settings(jwt_algorithm=algo)


def test_environment_normalise():
    assert _settings(environment="  PRODUCTION ").is_production


# ---------------------------------------------------------------- adresse de la base
@pytest.mark.parametrize("given,expected_prefix", [
    ("postgresql://u:p@h:5432/db", "postgresql+pg8000://"),
    ("postgres://u:p@h:5432/db", "postgresql+pg8000://"),
    ("postgresql+pg8000://u:p@h:5432/db", "postgresql+pg8000://"),
    ("sqlite:///:memory:", "sqlite:///"),
])
def test_normalisation_de_l_adresse_de_la_base(given, expected_prefix):
    assert normalize_database_url(given).startswith(expected_prefix)


def test_normalisation_conserve_un_mot_de_passe_special():
    url = "postgresql://user:p%40ss%2Fw%23rd@host:5432/railway"
    result = normalize_database_url(url)
    from sqlalchemy.engine import make_url
    assert make_url(result).password == "p@ss/w#rd"

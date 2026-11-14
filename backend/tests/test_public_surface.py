"""
SURFACE PUBLIQUE: garde-fou contre les trous de securite.

Principe (par le COMPORTEMENT, donc valable quelle que soit la version de
FastAPI): pour chacun des endpoints du schema OpenAPI, une requete SANS jeton
doit etre refusee (401). Les seuls endpoints qui repondent sans jeton sont
listes ICI, un par un, avec leur justification.

Ajouter un endpoint public = l'ajouter a cette liste, en connaissance de
cause. L'oublier = ce test echoue. Chaque endpoint public qui ECRIT ou qui
coute cher doit en plus etre limite en debit (verifie plus bas).
"""
import re

import pytest

# (methode, chemin) -> nombre de requetes autorisees avant 429, ou None si lecture libre non limitee
PUBLIC_ENDPOINTS: dict[tuple[str, str], int] = {
    # --- authentification (limites strictes) ---
    ("POST", "/auth/login"): 60,
    ("POST", "/auth/verify-2fa"): 30,
    ("POST", "/auth/register-patient"): 10,
    ("POST", "/auth/forgot-password"): 10,
    ("POST", "/auth/reset-password"): 20,
    # --- commande sans compte (limite stricte + plafond par telephone en base) ---
    ("POST", "/pharmacy/reservations/guest"): 10,
    # --- recherche et consultation publiques (parcours patient avant inscription) ---
    ("POST", "/appointments/search"): 120,
    ("GET", "/appointments/available-slots"): 120,
    ("GET", "/doctors/search"): 120,
    ("GET", "/doctors/{doctor_id}/profile"): 120,
    ("GET", "/doctors/{doctor_id}/reviews"): 120,   # avis publics (anonymises pour les visiteurs)
    ("GET", "/establishments/search"): 120,
    ("GET", "/lab/search"): 120,
    ("GET", "/opening-hours/establishment/{establishment_id}"): 120,
    ("GET", "/pharmacy/search"): 120,
    ("GET", "/pharmacy/pharmacies/search"): 120,
    ("GET", "/pharmacy/stock/public"): 120,
    ("GET", "/services/establishment/{establishment_id}"): 120,
    ("GET", "/settings"): 120,
}
DUMMY_ID = "00000000-0000-0000-0000-000000000000"
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _operations(client):
    for path, item in client.app.openapi()["paths"].items():
        for method in item:
            if method in ("get", "post", "put", "patch", "delete"):
                yield method.upper(), path


def _call(client, method, path):
    url = re.sub(r"\{[^}]+\}", DUMMY_ID, path)
    if method in WRITE_METHODS:
        return client.request(method, url, json={})
    return client.request(method, url)


def test_la_liste_des_endpoints_publics_correspond_a_des_routes_existantes(client):
    existing = set(_operations(client))
    inconnus = sorted(set(PUBLIC_ENDPOINTS) - existing)
    assert not inconnus, f"endpoints publics declares mais inexistants (liste a mettre a jour): {inconnus}"


def test_tout_endpoint_hors_liste_publique_exige_une_authentification(client):
    ouverts = []
    total = 0
    for method, path in _operations(client):
        if (method, path) in PUBLIC_ENDPOINTS:
            continue
        total += 1
        status = _call(client, method, path).status_code
        if status != 401:
            ouverts.append((method, path, status))
    assert total > 150, "le schema OpenAPI semble incomplet"
    assert not ouverts, (
        "Endpoints accessibles SANS jeton alors qu'ils ne figurent pas dans PUBLIC_ENDPOINTS "
        f"(trou de securite, ou liste a completer en connaissance de cause): {ouverts}"
    )


@pytest.mark.parametrize("operation,limit", sorted(PUBLIC_ENDPOINTS.items()), ids=lambda v: str(v))
def test_chaque_endpoint_public_est_limite_en_debit(client, operation, limit):
    method, path = operation
    for i in range(limit):
        status = _call(client, method, path).status_code
        assert status != 429, f"{method} {path}: bloque trop tot (appel {i + 1}/{limit})"
    blocked = _call(client, method, path)
    assert blocked.status_code == 429, f"{method} {path} n'est PAS limite en debit"
    assert int(blocked.headers["retry-after"]) >= 1

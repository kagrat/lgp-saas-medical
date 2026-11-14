"""
Aucune route ne doit planter (HTTP 5xx) pour aucun role, meme appelee avec des donnees vides ou
des identifiants inexistants. Une erreur 500 = bug (import oublie, colonne inexistante...).
Ce test aurait detecte l'import manquant de MedicalDocument dans lab.py.
"""
import re

import pytest

from app.models import EstablishmentType, UserRole
from tests.test_public_surface import DUMMY_ID, PUBLIC_ENDPOINTS, WRITE_METHODS, _operations

ROLES = [r for r in UserRole]


@pytest.fixture()
def tokens(world):
    est = {
        EstablishmentType.CLINIQUE: world.establishment("Clinique", EstablishmentType.CLINIQUE),
        EstablishmentType.PHARMACIE: world.establishment("Pharmacie", EstablishmentType.PHARMACIE),
        EstablishmentType.LABORATOIRE: world.establishment("Labo", EstablishmentType.LABORATOIRE),
    }
    out = {}
    for role in ROLES:
        if role == UserRole.SUPER_ADMIN:
            u = world.user(role)
            from tests.helpers import bearer
            out[role] = bearer(u)
        elif role == UserRole.PATIENT:
            out[role] = world.patient()[2]
        elif role == UserRole.DOCTOR:
            out[role] = world.doctor(est[EstablishmentType.CLINIQUE])[2]
        else:
            kind = {UserRole.PHARMACIST: EstablishmentType.PHARMACIE, UserRole.LAB_TECHNICIAN: EstablishmentType.LABORATOIRE}.get(role, EstablishmentType.CLINIQUE)
            out[role] = world.staff(role, est[kind])[1]
    return out


@pytest.mark.parametrize("role", ROLES, ids=lambda r: r.value)
def test_aucune_route_ne_renvoie_d_erreur_serveur(client, tokens, role):
    headers = tokens[role]
    plantes = []
    for method, path in _operations(client):
        if (method, path) in PUBLIC_ENDPOINTS:
            continue
        url = re.sub(r"\{[^}]+\}", DUMMY_ID, path)
        kwargs = {"json": {}} if method in WRITE_METHODS else {}
        r = client.request(method, url, headers=headers, **kwargs)
        if r.status_code >= 500:
            plantes.append((method, path, r.status_code))
    assert not plantes, f"routes qui plantent pour le role {role.value}: {plantes}"

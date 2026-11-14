"""Transfert d'un rendez-vous a un confrere: le dossier quitte la liste des RDV mais la trace reste, les deux medecins peuvent ecrire au patient."""
from app.timeutils import utcnow
import datetime

import pytest

from app.models import AppointmentStatus, EstablishmentType, UserRole


@pytest.fixture()
def scene(world):
    clinic = world.establishment()
    uA, dA, hA = world.doctor(clinic, "Dr Alpha")
    uB, dB, hB = world.doctor(clinic, "Dr Beta")
    uC, dC, hC = world.doctor(clinic, "Dr Gamma")
    _, admin = world.staff(UserRole.ESTABLISHMENT_ADMIN, clinic, "Admin")
    pu, P, hP = world.patient("Patient Transfere")
    when = utcnow() + datetime.timedelta(days=3)
    appt = world.appointment(clinic, dA, P, when, AppointmentStatus.CONFIRMED)
    return dict(w=world, clinic=clinic, uA=uA, dA=dA, hA=hA, uB=uB, dB=dB, hB=hB, hC=hC, dC=dC, admin=admin, P=P, hP=hP, appt=appt)


def _transfer(client, s, headers, to):
    return client.patch(f"/appointments/{s['appt'].id}/transfer", json={"new_doctor_id": to.id}, headers=headers)


def test_transfert_puis_trace_chez_les_deux_medecins(client, scene):
    s = scene
    assert _transfer(client, s, s["hA"], s["dB"]).status_code == 200
    emetteur = {p["id"]: p for p in client.get("/doctors/me/patients", headers=s["hA"]).json()}
    receveur = {p["id"]: p for p in client.get("/doctors/me/patients", headers=s["hB"]).json()}
    assert emetteur[s["P"].id]["transfer_status"] == "transferred_out"
    assert receveur[s["P"].id]["transfer_status"] == "transferred_in"
    assert emetteur[s["P"].id]["transfer_counterpart"] == "Dr Beta"


def test_le_rendez_vous_change_de_medecin(client, scene):
    s = scene
    _transfer(client, s, s["hA"], s["dB"])
    a_after = s["w"].db.get(type(s["appt"]), s["appt"].id)
    s["w"].db.refresh(a_after)
    assert a_after.doctor_id == s["dB"].id


def test_le_receveur_peut_ecrire_au_patient_transfere(client, scene):
    s = scene
    assert client.post(f"/messages/establishment/conversation/{s['P'].id}", json={"content": "Bonjour"}, headers=s["hB"]).status_code == 403
    _transfer(client, s, s["hA"], s["dB"])
    assert client.post(f"/messages/establishment/conversation/{s['P'].id}", json={"content": "Bonjour, je reprends votre suivi"}, headers=s["hB"]).status_code == 201


def test_un_troisieme_medecin_n_a_aucune_trace(client, scene):
    s = scene
    _transfer(client, s, s["hA"], s["dB"])
    ids = [p["id"] for p in client.get("/doctors/me/patients", headers=s["hC"]).json()]
    assert s["P"].id not in ids


def test_un_medecin_ne_transfere_pas_le_rdv_d_un_confrere(client, scene):
    s = scene
    assert _transfer(client, s, s["hC"], s["dB"]).status_code == 403


def test_admin_peut_transferer_et_la_cible_doit_etre_valide(client, scene):
    s = scene
    assert _transfer(client, s, s["admin"], s["dA"]).status_code == 422, "deja avec ce medecin"
    autre = s["w"].establishment("Autre", EstablishmentType.CLINIQUE)
    _, dX, _ = s["w"].doctor(autre, "Dr Externe")
    assert _transfer(client, s, s["admin"], dX).status_code == 404, "medecin d'un autre etablissement"
    assert _transfer(client, s, s["admin"], s["dB"]).status_code == 200


def test_rdv_termine_non_transferable(client, scene):
    s = scene
    s["appt"].status = AppointmentStatus.COMPLETED
    s["w"].db.commit()
    assert _transfer(client, s, s["hA"], s["dB"]).status_code == 409


def test_transfert_refuse_sur_creneau_deja_pris(client, scene):
    s = scene
    s["w"].appointment(s["clinic"], s["dB"], s["w"].patient("Autre patient")[1], s["appt"].scheduled_at, AppointmentStatus.CONFIRMED)
    assert _transfer(client, s, s["hA"], s["dB"]).status_code == 409


def test_patient_ne_peut_pas_transferer(client, scene):
    s = scene
    assert _transfer(client, s, s["hP"], s["dB"]).status_code == 403

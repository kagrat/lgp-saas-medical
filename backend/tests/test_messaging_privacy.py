"""
CONFIDENTIALITE DES MESSAGES patient <-> personnel.

Decision de M. Faustin: chaque conversation reste ENTRE LES DEUX PERSONNES QUI
CONVERSENT, et personne d'autre: ni un autre medecin du meme patient, ni
l'admin, ni l'infirmier, la reception, le secretariat, les RH ou la comptabilite,
ni le personnel d'un autre etablissement.
Exception documentee: le "guichet" d'une pharmacie / d'un laboratoire, partage
par le personnel de CET etablissement uniquement.
"""
from app.timeutils import utcnow
import datetime
from types import SimpleNamespace

import pytest

from app.models import (
    AppointmentStatus, DeliveryMode, EstablishmentType, PharmacyReservation, ReservationStatus, UserRole,
)
from tests.helpers import uid


@pytest.fixture()
def scene(world):
    w = world
    clinic = w.establishment("Clinique", EstablishmentType.CLINIQUE)
    other_clinic = w.establishment("Autre Clinique", EstablishmentType.CLINIQUE)
    uA, dA, hA = w.doctor(clinic, "Dr Alpha", "Cardiologue")
    uB, dB, hB = w.doctor(clinic, "Dr Beta")
    uC, dC, hC = w.doctor(clinic, "Dr Gamma (sans lien)")
    uD, dD, hD = w.doctor(other_clinic, "Dr Autre Clinique")
    staff = {
        "admin": w.staff(UserRole.ESTABLISHMENT_ADMIN, clinic, "Admin Clinique"),
        "infirmiere": w.staff(UserRole.NURSE, clinic, "Infirmiere"),
        "receptionniste": w.staff(UserRole.RECEPTIONIST, clinic, "Receptionniste"),
        "secretaire": w.staff(UserRole.SECRETARY, clinic, "Secretaire"),
        "rh": w.staff(UserRole.HR_MANAGER, clinic, "RH"),
        "comptable": w.staff(UserRole.ACCOUNTANT, clinic, "Comptable"),
    }
    admin_other = w.staff(UserRole.ESTABLISHMENT_ADMIN, other_clinic, "Admin Autre Clinique")
    pu, P, hP = w.patient("Patiente Confidentielle")
    now = utcnow()
    w.appointment(clinic, dA, P, now - datetime.timedelta(days=30), AppointmentStatus.COMPLETED)
    w.appointment(clinic, dB, P, now + datetime.timedelta(days=2), AppointmentStatus.CONFIRMED)
    return SimpleNamespace(w=w, clinic=clinic, other_clinic=other_clinic, uA=uA, hA=hA, uB=uB, hB=hB, uC=uC, hC=hC,
                           hD=hD, staff=staff, admin_other=admin_other, P=P, pu=pu, hP=hP)


def _texts(response):
    return sorted(m["content"] for m in response.json())


class Chat:
    def __init__(self, client, s):
        self.c, self.s = client, s

    def conv(self, headers):
        return self.c.get(f"/messages/establishment/conversation/{self.s.P.id}", headers=headers)

    def send(self, headers, text):
        return self.c.post(f"/messages/establishment/conversation/{self.s.P.id}", json={"content": text}, headers=headers)

    def listing(self, headers):
        return self.c.get("/messages/establishment/patients", headers=headers)

    def patient_send(self, text, to=None, est=None):
        est = est or self.s.clinic
        url = f"/messages/conversation/{est.id}" + (f"?with_user_id={to}" if to else "")
        return self.c.post(url, json={"content": text}, headers=self.s.hP)

    def patient_get(self, to=None, est=None):
        est = est or self.s.clinic
        url = f"/messages/conversation/{est.id}" + (f"?with_user_id={to}" if to else "")
        return self.c.get(url, headers=self.s.hP)


@pytest.fixture()
def chat(client, scene):
    ch = Chat(client, scene)
    assert ch.patient_send("Question pour Alpha", to=scene.uA.id).status_code == 201
    assert ch.patient_send("Question pour Beta", to=scene.uB.id).status_code == 201
    assert ch.send(scene.hA, "Reponse d'Alpha").status_code == 201
    assert ch.send(scene.hB, "Reponse de Beta").status_code == 201
    return ch


def test_chaque_medecin_ne_voit_que_sa_propre_conversation(chat, scene):
    """Le cas de la fuite d'origine: Beta (rendez-vous le plus recent) lisait la conversation du patient avec Alpha."""
    assert _texts(chat.conv(scene.hA)) == ["Question pour Alpha", "Reponse d'Alpha"]
    assert _texts(chat.conv(scene.hB)) == ["Question pour Beta", "Reponse de Beta"]


def test_apercu_des_conversations_limite_aux_siennes(chat, scene):
    assert [c["last_message"] for c in chat.listing(scene.hA).json()] == ["Reponse d'Alpha"]
    assert [c["last_message"] for c in chat.listing(scene.hB).json()] == ["Reponse de Beta"]


@pytest.mark.parametrize("role", ["admin", "infirmiere", "receptionniste", "secretaire", "rh", "comptable"])
def test_aucun_autre_membre_du_personnel_ne_voit_les_conversations_medecin(chat, scene, role):
    headers = scene.staff[role][1]
    assert chat.conv(headers).json() == []
    assert chat.listing(headers).json() == []


def test_medecin_sans_rendez_vous_avec_le_patient_ne_voit_rien_et_ne_peut_pas_ecrire(chat, scene):
    assert chat.conv(scene.hC).json() == [] and chat.listing(scene.hC).json() == []
    assert chat.send(scene.hC, "intrusion").status_code == 403


def test_personnel_d_un_autre_etablissement_ne_voit_rien(chat, scene):
    for headers in (scene.hD, scene.admin_other[1]):
        assert chat.conv(headers).json() == [] and chat.listing(headers).json() == []


def test_le_personnel_peut_ecrire_mais_sa_conversation_reste_privee(chat, scene):
    nurse, admin = scene.staff["infirmiere"][1], scene.staff["admin"][1]
    assert chat.send(nurse, "Message de l'infirmiere").status_code == 201
    assert chat.send(admin, "Message de l'admin").status_code == 201
    assert _texts(chat.conv(nurse)) == ["Message de l'infirmiere"]
    assert _texts(chat.conv(admin)) == ["Message de l'admin"]
    for headers in (scene.hA, scene.hB, scene.staff["receptionniste"][1]):
        lus = _texts(chat.conv(headers))
        assert "Message de l'infirmiere" not in lus and "Message de l'admin" not in lus


def test_le_patient_voit_une_conversation_separee_par_interlocuteur(chat, scene):
    chat.send(scene.staff["infirmiere"][1], "Message de l'infirmiere")
    entries = chat.c.get("/messages/establishments", headers=scene.hP).json()
    noms = sorted(e["counterparty_name"] for e in entries if e["establishment_id"] == scene.clinic.id)
    assert noms == sorted(["Dr Alpha (Cardiologue)", "Dr Beta (Generaliste)", "Infirmiere"])
    assert _texts(chat.patient_get(to=scene.uA.id)) == ["Question pour Alpha", "Reponse d'Alpha"]
    assert _texts(chat.patient_get(to=scene.uB.id)) == ["Question pour Beta", "Reponse de Beta"]
    assert _texts(chat.patient_get(to=scene.staff["infirmiere"][0].id)) == ["Message de l'infirmiere"]
    assert _texts(chat.patient_get()) == ["Question pour Beta", "Reponse de Beta"], "defaut = medecin du RDV le plus recent"


def test_le_patient_ne_repond_qu_a_qui_a_un_lien_avec_lui(chat, scene):
    nurse = scene.staff["infirmiere"]
    chat.send(nurse[1], "Message de l'infirmiere")
    assert chat.patient_send("Reponse", to=nurse[0].id).status_code == 201, "repondre a quelqu'un qui a ecrit"
    assert chat.patient_send("harcelement", to=scene.staff["receptionniste"][0].id).status_code == 403
    assert chat.patient_send("hors lien", to=scene.uC.id).status_code == 403
    assert _texts(chat.conv(scene.hB)) == ["Question pour Beta", "Reponse de Beta"], "rien n'a fuite chez les autres"


def test_guichet_pharmacie_partage_par_cette_pharmacie_uniquement(client, scene, world):
    pharmacy = world.establishment("Pharmacie", EstablishmentType.PHARMACIE)
    other_pharmacy = world.establishment("Autre Pharmacie", EstablishmentType.PHARMACIE)
    pharmacist = world.staff(UserRole.PHARMACIST, pharmacy, "Pharmacien")
    admin_ph = world.staff(UserRole.ESTABLISHMENT_ADMIN, pharmacy, "Admin Pharmacie")
    nurse_ph = world.staff(UserRole.NURSE, pharmacy, "Infirmier de la pharmacie")
    pharmacist_other = world.staff(UserRole.PHARMACIST, other_pharmacy, "Pharmacien autre pharmacie")
    world.db.add(PharmacyReservation(id=uid(), establishment_id=pharmacy.id, patient_id=scene.P.id,
                                     delivery_mode=DeliveryMode.PICKUP, status=ReservationStatus.PENDING))
    world.db.commit()
    ch = Chat(client, scene)
    assert ch.patient_send("Ma commande est-elle prete ?", est=pharmacy).status_code == 201
    assert _texts(ch.conv(pharmacist[1])) == ["Ma commande est-elle prete ?"]
    assert _texts(ch.conv(admin_ph[1])) == ["Ma commande est-elle prete ?"]
    assert ch.send(pharmacist[1], "Oui, elle est prete.").status_code == 201
    assert _texts(ch.conv(admin_ph[1])) == ["Ma commande est-elle prete ?", "Oui, elle est prete."]
    assert ch.conv(nurse_ph[1]).json() == [] and ch.conv(pharmacist_other[1]).json() == []
    assert _texts(ch.patient_get(est=pharmacy)) == ["Ma commande est-elle prete ?", "Oui, elle est prete."]
    assert all("Question" not in t for t in _texts(ch.conv(pharmacist[1]))), "le guichet ne voit rien de la clinique"


def test_messagerie_interne_personnel_a_personnel_reste_privee(chat, scene):
    r = chat.c.post(f"/messages/internal/conversation/{scene.uB.id}", json={"content": "Confidentiel entre collegues"}, headers=scene.hA)
    assert r.status_code == 201
    assert chat.c.get(f"/messages/internal/conversation/{scene.uB.id}", headers=scene.staff["admin"][1]).json() == []

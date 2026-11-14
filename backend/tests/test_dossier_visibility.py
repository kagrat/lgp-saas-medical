"""
Retours de M. Faustin (novembre): liste des RDV, cloche cliquable, historique et documents identifies.
"""
import datetime

from app.models import AppointmentStatus, DocumentType, EstablishmentType, MedicalDocument, Notification
from app.timeutils import utcnow
from tests.helpers import uid


def _future(days=3, hour=10):
    d = utcnow() + datetime.timedelta(days=days)
    return d.replace(hour=hour, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------- cloche cliquable
def test_la_notification_de_rdv_pointe_vers_le_patient_et_le_rdv(client, world):
    clinic = world.establishment()
    du, doctor, dh = world.doctor(clinic, "Dr Cloche")
    pu, patient, ph = world.patient("Patient Cloche")
    r = client.post("/appointments", json={"doctor_id": doctor.id, "scheduled_at": _future().isoformat()}, headers=ph)
    assert r.status_code == 201, r.text
    notifs = client.get("/notifications/establishment", headers=dh).json()
    nouveau = [n for n in notifs if n["notification_type"] == "new_appointment"]
    assert len(nouveau) == 1
    assert nouveau[0]["patient_id"] == patient.id and nouveau[0]["appointment_id"] == r.json()["id"]


def test_notification_d_un_autre_medecin_reste_invisible(client, world):
    clinic = world.establishment()
    _, d1, h1 = world.doctor(clinic, "Dr Un")
    _, d2, h2 = world.doctor(clinic, "Dr Deux")
    _, _, ph = world.patient()
    client.post("/appointments", json={"doctor_id": d1.id, "scheduled_at": _future().isoformat()}, headers=ph)
    assert [n for n in client.get("/notifications/establishment", headers=h2).json() if n["notification_type"] == "new_appointment"] == []


def test_notification_ancienne_sans_lien_reste_lisible(client, world):
    clinic = world.establishment()
    du, _, dh = world.doctor(clinic)
    world.db.add(Notification(id=uid(), establishment_id=clinic.id, user_id=du.id, notification_type="new_appointment",
                              title="Ancien", message="avant la mise a jour"))
    world.db.commit()
    anciennes = client.get("/notifications/establishment", headers=dh).json()
    assert anciennes[0]["patient_id"] is None and anciennes[0]["appointment_id"] is None


# ---------------------------------------------------------------- historique et documents
def _terminee(world, clinic, doctor, patient, days_ago=10):
    return world.appointment(clinic, doctor, patient, utcnow() - datetime.timedelta(days=days_ago), AppointmentStatus.COMPLETED)


def test_historique_indique_dossier_medecin_et_etablissement(client, world):
    clinic = world.establishment("Clinique du Lac", EstablishmentType.CLINIQUE)
    _, doctor, dh = world.doctor(clinic, "Dr Historique")
    _, patient, _ = world.patient("Patient Historique")
    _terminee(world, clinic, doctor, patient)
    detail = client.get(f"/doctors/me/patients/{patient.id}", headers=dh).json()
    ligne = detail["appointments"][0]
    assert ligne["dossier_number"] == patient.dossier_number
    assert ligne["doctor_name"] == "Dr Historique"
    assert ligne["establishment_name"] == "Clinique du Lac"


def test_documents_portent_le_numero_de_dossier_cote_medecin_et_cote_patient(client, world):
    clinic = world.establishment()
    _, doctor, dh = world.doctor(clinic)
    _, patient, ph = world.patient()
    appt = _terminee(world, clinic, doctor, patient)
    world.db.add(MedicalDocument(id=uid(), appointment_id=appt.id, patient_id=patient.id, doctor_id=doctor.id,
                                 establishment_id=clinic.id, document_type=DocumentType.PRESCRIPTION,
                                 title="Ordonnance", content="Paracetamol"))
    world.db.commit()
    cote_medecin = client.get(f"/doctors/me/patients/{patient.id}", headers=dh).json()["documents"]
    cote_patient = client.get("/health-records/mine", headers=ph).json()
    for docs in (cote_medecin, cote_patient):
        assert docs and all(d["dossier_number"] == patient.dossier_number for d in docs)


# ---------------------------------------------------------------- liste des RDV
def test_un_rdv_termine_quitte_la_liste_active_du_medecin_mais_reste_dans_ses_patients(client, world):
    clinic = world.establishment()
    _, doctor, dh = world.doctor(clinic)
    _, patient, _ = world.patient()
    appt = world.appointment(clinic, doctor, patient, _future(), AppointmentStatus.CONFIRMED)
    assert [a["id"] for a in client.get("/appointments/establishment", headers=dh).json()] == [appt.id]
    assert client.post(f"/appointments/{appt.id}/complete", headers=dh).status_code == 200
    assert client.get("/appointments/establishment", headers=dh).json() == []
    assert [p["id"] for p in client.get("/doctors/me/patients", headers=dh).json()] == [patient.id]
    archive = client.get("/appointments/establishment", params={"include_completed": True}, headers=dh).json()
    assert [a["id"] for a in archive] == [appt.id]

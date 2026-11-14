"""Avis sur un medecin: uniquement apres un rendez-vous TERMINE, et un seul avis par patient (mis a jour, jamais duplique)."""
from app.timeutils import utcnow
import datetime

from app.models import AppointmentStatus, DoctorReview, EstablishmentType


def test_seul_un_medecin_d_un_rdv_termine_est_notable(client, world):
    clinic = world.establishment()
    _, d_termine, _ = world.doctor(clinic, "Dr Termine", "Cardiologue")
    _, d_confirme, _ = world.doctor(clinic, "Dr SeulementConfirme", "Cardiologue")
    _, d_jamais_vu, _ = world.doctor(clinic, "Dr JamaisVu", "Cardiologue")
    _, patient, headers = world.patient()
    passe = utcnow() - datetime.timedelta(days=2)
    world.appointment(clinic, d_termine, patient, passe, AppointmentStatus.COMPLETED)
    world.appointment(clinic, d_confirme, patient, passe, AppointmentStatus.CONFIRMED)

    notables = sorted(x["doctor_name"] for x in client.get("/doctors/reviewable", headers=headers).json())
    assert notables == ["Dr Termine"]
    for medecin in (d_jamais_vu, d_confirme):
        r = client.post(f"/doctors/{medecin.id}/reviews", json={"rating": 1, "comment": "x"}, headers=headers)
        assert r.status_code == 403


def test_noter_plusieurs_fois_met_a_jour_au_lieu_de_dupliquer(client, world):
    clinic = world.establishment()
    _, medecin, _ = world.doctor(clinic, "Dr Termine", "Cardiologue")
    _, patient, headers = world.patient()
    world.appointment(clinic, medecin, patient, utcnow() - datetime.timedelta(days=2), AppointmentStatus.COMPLETED)
    for note, texte in ((5, "Parfait"), (3, "Finalement moyen"), (4, "Re-modifie")):
        assert client.post(f"/doctors/{medecin.id}/reviews", json={"rating": note, "comment": texte}, headers=headers).status_code in (200, 201)
    avis = world.db.query(DoctorReview).filter(DoctorReview.doctor_id == medecin.id, DoctorReview.patient_id == patient.id).all()
    assert len(avis) == 1 and avis[0].rating == 4

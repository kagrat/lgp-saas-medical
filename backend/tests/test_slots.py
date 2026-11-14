"""Creneaux reservables: une garde programmee rend le medecin reservable ce jour-la; sans garde, l'horaire hebdomadaire s'applique."""
import datetime

from app.models import AppointmentStatus, DoctorAvailability, Shift
from tests.helpers import uid

T = datetime.time


def _monday():
    d = datetime.date.today() + datetime.timedelta(days=14)
    return d + datetime.timedelta(days=(7 - d.weekday()) % 7)


def _slots(client, doctor, day):
    r = client.get("/appointments/available-slots", params={"doctor_id": doctor.id, "target_date": day.isoformat()})
    assert r.status_code == 200
    return r.json()


def test_medecin_sans_aucun_horaire_est_signale(client, world):
    _, d, _ = world.doctor(world.establishment())
    body = _slots(client, d, _monday())
    assert body["slots"] == [] and body["has_availability_configured"] is False


def test_garde_programmee_ouvre_des_creneaux_ce_jour_la(client, world):
    clinic = world.establishment()
    u, d, _ = world.doctor(clinic)
    day = _monday() + datetime.timedelta(days=2)  # mercredi, aucun horaire hebdomadaire
    assert _slots(client, d, day)["slots"] == []
    world.db.add(Shift(id=uid(), establishment_id=clinic.id, user_id=u.id, shift_date=day, start_time=T(8), end_time=T(10), created_by_user_id=u.id))
    world.db.commit()
    starts = [s["slot_start"] for s in _slots(client, d, day)["slots"]]
    assert len(starts) == 4 and starts[0].endswith("08:00:00")  # 2 h / 30 min


def test_la_garde_prime_sur_l_horaire_hebdomadaire(client, world):
    clinic = world.establishment()
    u, d, _ = world.doctor(clinic)
    day = _monday()
    world.db.add(DoctorAvailability(id=uid(), doctor_id=d.id, day_of_week=day.weekday(), start_time=T(8), end_time=T(18), slot_duration_minutes=30))
    world.db.commit()
    assert len(_slots(client, d, day)["slots"]) == 20
    world.db.add(Shift(id=uid(), establishment_id=clinic.id, user_id=u.id, shift_date=day, start_time=T(14), end_time=T(15), created_by_user_id=u.id))
    world.db.commit()
    assert len(_slots(client, d, day)["slots"]) == 2


def test_un_creneau_reserve_disparait_de_la_liste(client, world):
    clinic = world.establishment()
    u, d, _ = world.doctor(clinic)
    _, P, _ = world.patient()
    day = _monday()
    world.db.add(Shift(id=uid(), establishment_id=clinic.id, user_id=u.id, shift_date=day, start_time=T(8), end_time=T(10), created_by_user_id=u.id))
    world.db.commit()
    world.appointment(clinic, d, P, datetime.datetime.combine(day, T(8, 30)), AppointmentStatus.CONFIRMED)
    starts = [s["slot_start"] for s in _slots(client, d, day)["slots"]]
    assert len(starts) == 3 and not any(x.endswith("08:30:00") for x in starts)


def test_date_invalide_et_medecin_inconnu(client):
    assert client.get("/appointments/available-slots", params={"doctor_id": "x", "target_date": "2026-01-01"}).status_code == 404

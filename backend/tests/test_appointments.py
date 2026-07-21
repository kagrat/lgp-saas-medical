"""
Tests du moteur de suggestion de RDV et de l'isolation multi-tenant.
"""
import uuid
from datetime import date, time, timedelta

from app.models import Establishment, EstablishmentType, User, UserRole, Doctor, DoctorAvailability
from app.security import hash_password


def _make_establishment_with_doctor(db_session, city="Cotonou", specialty="Ophtalmologue"):
    establishment = Establishment(id=str(uuid.uuid4()), name="Hopital Test", type=EstablishmentType.HOPITAL, city=city)
    db_session.add(establishment)
    db_session.flush()

    doctor_user = User(
        id=str(uuid.uuid4()), establishment_id=establishment.id,
        email=f"doc-{uuid.uuid4().hex[:6]}@example.com",
        hashed_password=hash_password("Passw0rd123"),
        full_name="Dr. Test", role=UserRole.DOCTOR,
    )
    db_session.add(doctor_user)
    db_session.flush()

    doctor = Doctor(
        id=str(uuid.uuid4()), user_id=doctor_user.id, establishment_id=establishment.id,
        specialty=specialty, consultation_price=5000,
    )
    db_session.add(doctor)
    db_session.flush()

    tomorrow = date.today() + timedelta(days=1)
    availability = DoctorAvailability(
        id=str(uuid.uuid4()), doctor_id=doctor.id,
        day_of_week=tomorrow.weekday(),
        start_time=time(9, 0), end_time=time(12, 0), slot_duration_minutes=30,
    )
    db_session.add(availability)
    db_session.commit()
    return establishment, doctor


def test_suggestion_engine_returns_free_slots(db_session):
    from app.services.suggestion_engine import find_appointment_or_suggest

    establishment, doctor = _make_establishment_with_doctor(db_session)
    tomorrow = date.today() + timedelta(days=1)

    exact_match, suggestions = find_appointment_or_suggest(
        db=db_session, specialty="Ophtalmologue", preferred_date=tomorrow,
        preferred_time=None, city="Cotonou", establishment_id=establishment.id,
    )
    assert len(suggestions) > 0
    assert all(s.doctor_id == doctor.id for s in suggestions)


def test_establishment_admin_cannot_see_other_establishment_doctors(client, db_session):
    establishment_a, doctor_a = _make_establishment_with_doctor(db_session, city="Cotonou")
    _, _ = _make_establishment_with_doctor(db_session, city="Parakou", specialty="Dentiste")

    admin_a = User(
        id=str(uuid.uuid4()), establishment_id=establishment_a.id,
        email="admin-a@example.com", hashed_password=hash_password("Passw0rd123"),
        full_name="Admin A", role=UserRole.ESTABLISHMENT_ADMIN,
    )
    db_session.add(admin_a)
    db_session.commit()

    login = client.post("/auth/login", json={"email": "admin-a@example.com", "password": "Passw0rd123"})
    token = login.json()["access_token"]

    response = client.get("/doctors/establishment", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    doctor_ids = [d["id"] for d in response.json()]
    assert doctor_a.id in doctor_ids
    assert len(doctor_ids) == 1  # ne doit voir aucun medecin de l'autre etablissement

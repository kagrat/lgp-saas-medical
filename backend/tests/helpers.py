"""Fabrique de donnees de test: evite de repeter la creation d'utilisateurs, medecins, patients et jetons."""
from app.timeutils import utcnow
import datetime
import uuid

from app.models import (
    Appointment, AppointmentStatus, Doctor, Establishment, EstablishmentType, Patient, User, UserRole,
)
from app.security import create_access_token

# PNG valide de 1x1 pixel (67 octets): accepte par la validation des images.
TINY_PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def uid() -> str:
    return str(uuid.uuid4())


def bearer(user: User) -> dict:
    token = create_access_token({"sub": user.id, "role": user.role.value, "establishment_id": user.establishment_id})
    return {"Authorization": f"Bearer {token}"}


class World:
    def __init__(self, db):
        self.db = db
        self._n = 0

    def _next(self) -> int:
        self._n += 1
        return self._n

    def establishment(self, name="Clinique Test", type=EstablishmentType.CLINIQUE) -> Establishment:
        e = Establishment(id=uid(), name=name, type=type, city="Cotonou", is_active=True)
        self.db.add(e)
        self.db.commit()
        return e

    def user(self, role, establishment=None, name=None, email=None, phone=None) -> User:
        n = self._next()
        u = User(
            id=uid(), establishment_id=establishment.id if establishment else None,
            email=email or f"user{n}@test.com", hashed_password="x", full_name=name or f"Utilisateur {n}",
            role=role, phone=phone,
        )
        self.db.add(u)
        self.db.commit()
        return u

    def staff(self, role, establishment, name=None):
        u = self.user(role, establishment, name)
        return u, bearer(u)

    def doctor(self, establishment, name=None, specialty="Generaliste"):
        u = self.user(UserRole.DOCTOR, establishment, name)
        d = Doctor(id=uid(), user_id=u.id, establishment_id=establishment.id, specialty=specialty,
                   consultation_price=5000, is_active=True)
        self.db.add(d)
        self.db.commit()
        return u, d, bearer(u)

    def patient(self, name=None, phone=None):
        n = self._next()
        u = self.user(UserRole.PATIENT, None, name or f"Patient {n}", phone=phone)
        p = Patient(id=uid(), user_id=u.id, dossier_number=f"D-{1000 + n}")
        self.db.add(p)
        self.db.commit()
        return u, p, bearer(u)

    def appointment(self, establishment, doctor, patient, when=None, status=AppointmentStatus.CONFIRMED) -> Appointment:
        a = Appointment(
            id=uid(), establishment_id=establishment.id, doctor_id=doctor.id, patient_id=patient.id,
            scheduled_at=when or utcnow() + datetime.timedelta(days=2), status=status,
        )
        self.db.add(a)
        self.db.commit()
        return a

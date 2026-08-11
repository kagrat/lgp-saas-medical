"""
Modeles de donnees - architecture multi-tenant.

Isolation multi-tenant: presque toutes les tables portent une cle
etablissement_id. Les requetes doivent TOUJOURS filtrer par
establishment_id issu du token JWT de l'utilisateur connecte
(sauf pour le role super_admin). Voir app/deps.py::get_current_establishment_id.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, ForeignKey, Enum, Text, Date, Time
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"           # M. SOGADJI FAUSTIN - niveau 1
    ESTABLISHMENT_ADMIN = "establishment_admin"  # niveau 2
    DOCTOR = "doctor"
    SECRETARY = "secretary"
    PHARMACIST = "pharmacist"
    PATIENT = "patient"                   # niveau 3
    LAB_TECHNICIAN = "lab_technician"


class EstablishmentType(str, enum.Enum):
    HOPITAL = "hopital"
    CLINIQUE = "clinique"
    PHARMACIE = "pharmacie"
    LABORATOIRE = "laboratoire"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"    # suspension pour non-paiement (section 4, niveau 1)
    TRIAL = "trial"


class AppointmentStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class DeliveryMode(str, enum.Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"


class Establishment(Base):
    """Un hopital, une clinique, ou une pharmacie adherente."""
    __tablename__ = "establishments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    type = Column(Enum(EstablishmentType), nullable=False)
    city = Column(String(100), nullable=False)
    address = Column(String(300))
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    subscription_status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="establishment")
    doctors = relationship("Doctor", back_populates="establishment")
    appointments = relationship("Appointment", back_populates="establishment")
    stock_items = relationship("PharmacyStock", back_populates="establishment")


class User(Base):
    """
    Compte utilisateur - couvre les 3 niveaux (super admin, admin
    etablissement/medecin/secretaire/pharmacien, patient).
    establishment_id est NULL uniquement pour le super_admin (il n'appartient
    a aucun etablissement, il voit tout).
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)  # bcrypt - jamais en clair
    full_name = Column(String(200), nullable=False)
    phone = Column(String(30))
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment", back_populates="users")
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)


class Doctor(Base):
    """Profil medecin - lie a un User (role=doctor) et a un etablissement."""
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    specialty = Column(String(100), nullable=False)  # Generaliste, Dentiste, Chirurgien...
    consultation_price = Column(Float, nullable=False, default=0)
    bio = Column(Text)
    photo_url = Column(String(500))
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="doctor_profile")
    establishment = relationship("Establishment", back_populates="doctors")
    availabilities = relationship("DoctorAvailability", back_populates="doctor", cascade="all, delete-orphan")
    absences = relationship("DoctorAbsence", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor")


class DoctorAvailability(Base):
    """Creneaux recurrents par jour de semaine (0=lundi ... 6=dimanche)."""
    __tablename__ = "doctor_availabilities"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0-6
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration_minutes = Column(Integer, default=30)

    doctor = relationship("Doctor", back_populates="availabilities")


class DoctorAbsence(Base):
    """Conges et absences ponctuelles (section 4, module 4)."""
    __tablename__ = "doctor_absences"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(300))

    doctor = relationship("Doctor", back_populates="absences")


class Patient(Base):
    """
    Dossier patient. Un patient peut consulter dans plusieurs etablissements
    (portail web central) - le dossier est donc rattache au compte User
    (role=patient), pas a un etablissement.
    """
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, unique=True)
    dossier_number = Column(String(50), unique=True, nullable=False)  # numero unique
    date_of_birth = Column(Date)

    user = relationship("User")
    appointments = relationship("Appointment", back_populates="patient")


class Appointment(Base):
    """Rendez-vous - coeur du module 3 et du moteur de suggestion (section 6)."""
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.CONFIRMED)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    patient = relationship("Patient", back_populates="appointments")


class PharmacyStock(Base):
    """Module 5 - stock pharmacie par etablissement."""
    __tablename__ = "pharmacy_stock"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    reference = Column(String(50), nullable=False)  # numero de reference du medicament (etiquette/fabricant)
    medication_name = Column(String(200), nullable=False)
    category = Column(String(100))
    quantity = Column(Integer, default=0)
    alert_threshold = Column(Integer, default=10)  # alerte rupture de stock configurable
    unit_price = Column(Float, default=0)

    establishment = relationship("Establishment", back_populates="stock_items")
    reservations = relationship("PharmacyReservation", back_populates="medication")


class PharmacyReservation(Base):
    """Reservation patient via le portail web (pharmacie en ligne)."""
    __tablename__ = "pharmacy_reservations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    medication_id = Column(UUID(as_uuid=False), ForeignKey("pharmacy_stock.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    delivery_mode = Column(Enum(DeliveryMode), default=DeliveryMode.PICKUP)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.PENDING)
    estimated_ready_at = Column(DateTime, nullable=True)
    pharmacist_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    medication = relationship("PharmacyStock", back_populates="reservations")


class AuditLog(Base):
    """
    Journal d'audit (section 11) - chaque action sensible tracee.
    Table append-only par convention applicative: aucune route API ne doit
    exposer d'UPDATE ou DELETE sur cette table.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=True)
    action = Column(String(200), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class DoctorReview(Base):
    """Avis patient sur un medecin - uniquement apres un RDV termine, pour eviter les faux avis."""
    __tablename__ = "doctor_reviews"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1 a 5
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("Doctor")
    patient = relationship("Patient")

class PharmacyReservationStatusHistory(Base):
    """Timeline d'une commande - append-only, jamais modifie ni supprime."""
    __tablename__ = "pharmacy_reservation_status_history"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    reservation_id = Column(UUID(as_uuid=False), ForeignKey("pharmacy_reservations.id"), nullable=False)
    status = Column(Enum(ReservationStatus), nullable=False)
    note = Column(Text, nullable=True)
    changed_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentType(str, enum.Enum):
    PRESCRIPTION = "prescription"
    LAB_RESULT = "lab_result"
    CONSULTATION_NOTE = "consultation_note"
    CERTIFICATE = "certificate"
    OTHER = "other"


class MedicalDocument(Base):
    """
    Un element du dossier de sante - toujours rattache a un rendez-vous
    reel (tracabilite complete: quel medecin, quel etablissement, quelle
    consultation, a produit ce document).
    """
    __tablename__ = "medical_documents"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    appointment_id = Column(UUID(as_uuid=False), ForeignKey("appointments.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    document_type = Column(Enum(DocumentType), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    appointment = relationship("Appointment")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
    establishment = relationship("Establishment")

class LabTestStatus(str, enum.Enum):
    REQUESTED = "requested"
    SAMPLE_COLLECTED = "sample_collected"
    IN_PROGRESS = "in_progress"
    VALIDATED = "validated"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class LabTestRequest(Base):
    """Demande d'analyse - independante du dossier de sante (MedicalDocument)
    car un test labo n'a pas forcement de rendez-vous derriere."""
    __tablename__ = "lab_test_requests"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    test_name = Column(String(200), nullable=False)
    sample_type = Column(String(100), nullable=True)
    status = Column(Enum(LabTestStatus), default=LabTestStatus.REQUESTED)
    scheduled_sample_at = Column(DateTime, nullable=True)
    results_text = Column(Text, nullable=True)
    lab_technician_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment")
    patient = relationship("Patient")

class MessageSenderRole(str, enum.Enum):
    PATIENT = "patient"
    STAFF = "staff"


class Message(Base):
    """Message de la messagerie patient <-> etablissement (module chat concierge)."""
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    sender_role = Column(Enum(MessageSenderRole), nullable=False)
    sender_name = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
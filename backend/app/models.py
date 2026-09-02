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
    # NOUVEAU (gestion interne complete, demande M. Faustin):
    NURSE = "nurse"                       # infirmier(e) - regroupe aussi aide-soignant(e)
    RECEPTIONIST = "receptionist"         # agent d'accueil - distinct du secretariat medical
    ACCOUNTANT = "accountant"             # comptable / facturation
    HR_MANAGER = "hr_manager"             # responsable RH


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
    ARRIVED = "arrived"


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    AWAITING_CONFIRMATION = "awaiting_confirmation"

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


class Department(Base):
    """
    NOUVEAU (gestion interne complete, demande M. Faustin) - unite
    organisationnelle d'un etablissement (ex: Maternite, Cardiologie,
    Urgences). Distinct du modele Service (qui est en realite un catalogue
    d'actes tarifes, pas une unite RH). Un Department peut avoir un
    responsable (chef de service) et regroupe le personnel qui y travaille
    (via StaffProfile.department_id) ainsi que les chambres qui en dependent
    (via Room.department_id, ajoute plus bas).
    """
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    name = Column(String(150), nullable=False)
    head_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment")
    head_user = relationship("User", foreign_keys=[head_user_id])


class Admission(Base):
    """
    NOUVEAU (hospitalisation, demande confirmee par M. Faustin) - une
    hospitalisation reelle d'un patient, distincte du rendez-vous ponctuel
    (Appointment). Statut en texte simple (pas d'Enum Postgres), suivant le
    meme choix technique deliberé documente dans services.py pour Room -
    evite tout risque de ALTER TYPE plus tard si de nouveaux statuts
    apparaissent. Valeurs actuelles: "active", "discharged".
    """
    __tablename__ = "admissions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    admitting_doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    room_id = Column(UUID(as_uuid=False), ForeignKey("rooms.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    diagnosis = Column(Text, nullable=True)
    admission_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    expected_discharge_date = Column(DateTime, nullable=True)
    actual_discharge_date = Column(DateTime, nullable=True)
    discharge_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment")
    patient = relationship("Patient")
    admitting_doctor = relationship("Doctor")
    department = relationship("Department")
    room = relationship("Room")
    vital_signs = relationship("VitalSigns", back_populates="admission", order_by="VitalSigns.recorded_at.desc()")
    transfers = relationship("AdmissionTransfer", back_populates="admission", order_by="AdmissionTransfer.created_at.desc()")


class VitalSigns(Base):
    """
    Constantes cliniques (poids, temperature, tension...). Rattachees soit
    a une hospitalisation (Admission), soit a un simple rendez-vous de
    consultation externe (Appointment) - exactement un des deux doit etre
    renseigne, meme principe que MedicalDocument (appointment_id/admission_id).
    Champs simples (pas de sur-ingenierie), suffisants pour un usage
    clinique de base.

    ATTENTION MIGRATION: admission_id devient nullable ici (il etait
    obligatoire avant) - necessite un ALTER COLUMN en production.
    """
    __tablename__ = "vital_signs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    admission_id = Column(UUID(as_uuid=False), ForeignKey("admissions.id"), nullable=True)
    appointment_id = Column(UUID(as_uuid=False), ForeignKey("appointments.id"), nullable=True)
    recorded_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    weight_kg = Column(Float, nullable=True)
    temperature_celsius = Column(Float, nullable=True)
    blood_pressure = Column(String(20), nullable=True)  # format libre "120/80"
    pulse_bpm = Column(Integer, nullable=True)
    respiratory_rate = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    admission = relationship("Admission", back_populates="vital_signs")
    appointment = relationship("Appointment")
    recorded_by = relationship("User")


class AdmissionTransfer(Base):
    """NOUVEAU: trace chaque changement de service/chambre pendant une
    hospitalisation (ex: urgences -> chirurgie -> suivi post-operatoire)."""
    __tablename__ = "admission_transfers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    admission_id = Column(UUID(as_uuid=False), ForeignKey("admissions.id"), nullable=False)
    from_department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    to_department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    from_room_id = Column(UUID(as_uuid=False), ForeignKey("rooms.id"), nullable=True)
    to_room_id = Column(UUID(as_uuid=False), ForeignKey("rooms.id"), nullable=True)
    transferred_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    admission = relationship("Admission", back_populates="transfers")
    from_department = relationship("Department", foreign_keys=[from_department_id])
    to_department = relationship("Department", foreign_keys=[to_department_id])
    from_room = relationship("Room", foreign_keys=[from_room_id])
    to_room = relationship("Room", foreign_keys=[to_room_id])
    transferred_by = relationship("User", foreign_keys=[transferred_by_user_id])


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
    gender = Column(String(20), nullable=True)
    residence = Column(String(200), nullable=True)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment", back_populates="users")
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)
    staff_profile = relationship("StaffProfile", back_populates="user", uselist=False)


class PasswordResetToken(Base):
    """
    NOUVEAU (mot de passe oublie - lacune de securite identifiee lors d'un
    audit complet: "changer son mot de passe" existait deja une fois
    connecte, mais aucun moyen de le RECUPERER si oublie). Le token brut
    n'est jamais stocke, seul son hash - meme principe qu'un mot de passe:
    si la base fuite, les tokens de reinitialisation ne sont pas
    directement exploitables.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), nullable=False, index=True)  # sha256 hexdigest
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class StaffProfile(Base):
    """
    NOUVEAU (gestion interne complete, demande M. Faustin) - informations
    RH d'un membre du personnel (poste, departement, embauche...). Separe
    de User pour ne pas alourdir les comptes patient/medecin qui n'en ont
    pas besoin. Un seul StaffProfile par User (relation 1-1).
    """
    __tablename__ = "staff_profiles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, unique=True)
    department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    position_title = Column(String(150), nullable=True)     # ex: "Infirmiere en chef", "Aide-soignant"
    hire_date = Column(Date, nullable=True)
    contract_type = Column(String(50), nullable=True)       # CDI, CDD, stage...
    license_number = Column(String(100), nullable=True)     # numero d'ordre/diplome si applicable
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="staff_profile")
    department = relationship("Department")


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
    order_items = relationship("PharmacyOrderItem", back_populates="medication")


class PharmacyReservation(Base):
    """
    Commande patient via le portail web (pharmacie en ligne).

    RESTRUCTURATION (panier multi-articles): cette table ne porte plus les
    champs medication_id/quantity/confirmed_quantity/confirmed_unit_price -
    ils vivent desormais sur PharmacyOrderItem (une ligne par medicament).
    Cette table ne garde que les champs au niveau de la COMMANDE ENTIERE
    (livraison, statut, note du pharmacien...).
    """
    __tablename__ = "pharmacy_reservations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    delivery_mode = Column(Enum(DeliveryMode), default=DeliveryMode.PICKUP)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.PENDING)
    estimated_ready_at = Column(DateTime, nullable=True)
    pharmacist_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # NOUVEAU (lien ordonnance -> pharmacie): reference optionnelle vers
    # l'ordonnance d'origine, pour que le pharmacien puisse la consulter
    # lors de sa verification.
    prescription_document_id = Column(UUID(as_uuid=False), ForeignKey("medical_documents.id"), nullable=True)
    # NOUVEAU (demande M. Faustin): paiement en ligne obligatoire avant
    # preparation UNIQUEMENT si livraison (pas si retrait sur place -
    # le patient paie alors directement a la pharmacie). ATTENTION
    # HONNETE: aucune vraie passerelle de paiement (Mobile Money, carte)
    # n'est connectee ici - is_paid est une AUTO-DECLARATION du patient,
    # pas un encaissement reellement verifie. Pret a etre branche sur un
    # vrai prestataire de paiement plus tard (voir pharmacy.py::pay_reservation).
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime, nullable=True)

    items = relationship("PharmacyOrderItem", back_populates="reservation", cascade="all, delete-orphan")
    prescription_document = relationship("MedicalDocument")


class PharmacyOrderItem(Base):
    """
    NOUVEAU - une ligne de commande (un medicament + une quantite) au sein
    d'une PharmacyReservation. Permet a une commande de contenir plusieurs
    medicaments differents (panier), la ou avant une commande = un seul
    medicament.
    """
    __tablename__ = "pharmacy_order_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    reservation_id = Column(UUID(as_uuid=False), ForeignKey("pharmacy_reservations.id"), nullable=False)
    medication_id = Column(UUID(as_uuid=False), ForeignKey("pharmacy_stock.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    confirmed_quantity = Column(Integer, nullable=True)
    confirmed_unit_price = Column(Float, nullable=True)

    reservation = relationship("PharmacyReservation", back_populates="items")
    medication = relationship("PharmacyStock", back_populates="order_items")


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
    # NOUVEAU (hospitalisation, demande confirmee par M. Faustin):
    DAILY_PROGRESS_NOTE = "daily_progress_note"   # tournee medicale quotidienne
    NURSING_NOTE = "nursing_note"                  # note de soins infirmiers


class MedicalDocument(Base):
    """
    Un element du dossier de sante - rattache soit a un rendez-vous reel
    (consultation externe), soit a une hospitalisation (Admission) pour les
    notes de tournee/soins produites pendant un sejour. Exactement un des
    deux (appointment_id, admission_id) doit etre renseigne - valide cote
    application (pas de contrainte CHECK en base pour rester compatible
    SQLite/Postgres), jamais les deux ni aucun des deux. Tracabilite
    complete conservee dans tous les cas: quel medecin/infirmier, quel
    etablissement, quel rendez-vous OU quelle hospitalisation, a produit ce
    document.

    ATTENTION MIGRATION: appointment_id devient nullable ici (il etait
    obligatoire avant) - necessite un ALTER COLUMN en production, voir
    script de migration fourni separement.
    """
    __tablename__ = "medical_documents"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    appointment_id = Column(UUID(as_uuid=False), ForeignKey("appointments.id"), nullable=True)
    admission_id = Column(UUID(as_uuid=False), ForeignKey("admissions.id"), nullable=True)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=True)
    author_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)  # NOUVEAU: auteur reel (peut etre un infirmier, pas seulement un medecin)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    document_type = Column(Enum(DocumentType), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    appointment = relationship("Appointment")
    admission = relationship("Admission")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
    author = relationship("User")
    establishment = relationship("Establishment")
    prescription_items = relationship("PrescriptionItem", back_populates="document", cascade="all, delete-orphan")


class PrescriptionItem(Base):
    """
    NOUVEAU (lien ordonnance -> pharmacie, lacune identifiee lors d'un
    audit complet: une ordonnance etait ecrite en texte libre, totalement
    deconnectee de la pharmacie - le patient devait tout retaper de
    memoire). Une ligne structuree de medicament au sein d'une ordonnance
    (document_type=PRESCRIPTION). Le nom du medicament reste du texte
    libre (une ordonnance ne connait pas a l'avance quelle pharmacie sera
    choisie, ni son catalogue exact) - le rapprochement avec le stock reel
    d'une pharmacie se fait au moment de la commande (voir
    pharmacy.py::match_prescription).
    """
    __tablename__ = "prescription_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_id = Column(UUID(as_uuid=False), ForeignKey("medical_documents.id"), nullable=False)
    medication_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    dosage_instructions = Column(String(300), nullable=True)

    document = relationship("MedicalDocument", back_populates="prescription_items")


class ClinicalFlagType(str, enum.Enum):
    ALLERGY = "allergy"
    ANTECEDENT = "antecedent"
    OTHER = "other"


class ClinicalFlag(Base):
    """
    NOUVEAU (demande M. Faustin: "elements cliniques" visibles sur la
    fiche patient du medecin, comme sur la maquette de reference -
    allergies, antecedents, etc, sous forme de courtes etiquettes
    ajoutables/retirables). Rattache au PATIENT (pas a un rendez-vous
    precis) car une allergie ou un antecedent reste vrai dans le temps,
    quel que soit l'etablissement consulte ensuite.
    """
    __tablename__ = "clinical_flags"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    flag_type = Column(Enum(ClinicalFlagType), nullable=False, default=ClinicalFlagType.OTHER)
    label = Column(String(200), nullable=False)
    created_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    created_by = relationship("User")


class PatientRecordShare(Base):
    """
    NOUVEAU - permet a un medecin d'envoyer le dossier d'UN DE SES PATIENTS
    (verifie: au moins un rendez-vous termine ensemble) a un confrere, qui
    peut alors CONSULTER (lecture seule) l'historique de ce patient avec le
    medecin emetteur. Le medecin destinataire ne peut PAS ajouter de
    documents via ce partage - seul le medecin traitant (avec un rendez-vous
    reel) peut completer le dossier, conformement au principe de tracabilite
    deja en place (voir MedicalDocument).
    """
    __tablename__ = "patient_record_shares"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    from_doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    to_doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    from_doctor = relationship("Doctor", foreign_keys=[from_doctor_id])
    to_doctor = relationship("Doctor", foreign_keys=[to_doctor_id])


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
    sample_collected_at = Column(DateTime, nullable=True)
    results_validated_at = Column(DateTime, nullable=True)
    status = Column(Enum(LabTestStatus), default=LabTestStatus.REQUESTED)
    scheduled_sample_at = Column(DateTime, nullable=True)
    results_text = Column(Text, nullable=True)
    lab_technician_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    referred_by_establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=True)
    referred_by_doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=True)

    establishment = relationship("Establishment", foreign_keys=[establishment_id])
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

class Dependent(Base):
    """Module 'Mes proches' - purement informatif pour l'instant, pas encore lie a la prise de RDV."""
    __tablename__ = "dependents"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    full_name = Column(String(200), nullable=False)
    relation_type = Column(String(50), nullable=False)
    date_of_birth = Column(Date, nullable=True)

    patient = relationship("Patient")

class OpeningHours(Base):
    """Horaires generaux de l'etablissement - distinct des disponibilites par medecin."""
    __tablename__ = "opening_hours"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)

    establishment = relationship("Establishment")

class Invoice(Base):
    """
    NOUVEAU (facturation reelle, chantier prioritaire du cahier des
    charges) - remplace le simple 'revenu estime' (calcul) par de vraies
    factures numerotees, avec suivi des encaissements. Statut en texte
    simple (meme principe que Room/Admission: pas d'Enum Postgres, pour
    eviter tout risque de ALTER TYPE plus tard). Valeurs actuelles:
    "issued", "partially_paid", "paid", "cancelled".
    """
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    issued_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    invoice_number = Column(String(50), nullable=False)  # ex: "FAC-2026-0001", unique par etablissement
    status = Column(String(20), nullable=False, default="issued")
    total_amount = Column(Float, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    issued_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    # Reference libre vers l'origine (rendez-vous, hospitalisation...) -
    # jamais une contrainte stricte, car une facture peut regrouper
    # plusieurs origines (ex: consultation + pharmacie sur la meme visite).
    appointment_id = Column(UUID(as_uuid=False), ForeignKey("appointments.id"), nullable=True)
    admission_id = Column(UUID(as_uuid=False), ForeignKey("admissions.id"), nullable=True)

    establishment = relationship("Establishment")
    patient = relationship("Patient")
    issued_by = relationship("User")
    appointment = relationship("Appointment")
    admission = relationship("Admission")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", order_by="Payment.paid_at.desc()")


class InvoiceLineItem(Base):
    """NOUVEAU: une ligne de facture (ex: 'Consultation Dr X', 'Chambre 12
    - 3 nuits', 'Paracetamol x10')."""
    __tablename__ = "invoice_line_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    invoice_id = Column(UUID(as_uuid=False), ForeignKey("invoices.id"), nullable=False)
    description = Column(String(300), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="line_items")


class Payment(Base):
    """NOUVEAU: un encaissement reel sur une facture. Plusieurs paiements
    possibles par facture (paiement partiel, puis solde). payment_method en
    texte simple: "cash", "mobile_money", "card"."""
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    invoice_id = Column(UUID(as_uuid=False), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), nullable=False)
    reference = Column(String(100), nullable=True)  # ex: reference de transaction Mobile Money
    recorded_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="payments")
    recorded_by = relationship("User")


class Notification(Base):
    """
    NOUVEAU (gestion interne complete, demande M. Faustin) - centre de
    notifications internes REEL. Corrige une lacune identifiee dans l'audit:
    PharmacyStock.alert_threshold existait deja mais rien ne se declenchait
    reellement dessus. Ferme aussi cette meme lacune pour InventoryItem
    (stock general). Point d'extension pret pour brancher un vrai
    fournisseur SMS plus tard (voir services/notifications.py) sans tout
    reconstruire.
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)  # NULL = notification etablissement (visible par tous les admins)
    notification_type = Column(String(30), nullable=False, default="info")  # "stock_alert", "info"...
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment")
    user = relationship("User")


class InventoryItem(Base):
    """
    NOUVEAU (gestion interne complete, demande M. Faustin) - stock general
    non-pharmaceutique (materiel medical, consommables...), distinct de
    PharmacyStock qui reste reserve aux medicaments vendus en pharmacie.
    """
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)  # ex: "Consommables", "Materiel medical"
    quantity = Column(Integer, nullable=False, default=0)
    unit = Column(String(30), nullable=True)  # ex: "unites", "boites", "litres"
    alert_threshold = Column(Integer, nullable=False, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment")


class Shift(Base):
    """
    NOUVEAU (gestion interne complete, demande M. Faustin) - planning de
    garde/roulement pour TOUT le personnel (pas seulement les medecins,
    qui ont deja DoctorAvailability pour leurs creneaux de consultation).
    """
    __tablename__ = "shifts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    shift_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    notes = Column(String(300), nullable=True)
    created_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    establishment = relationship("Establishment")
    user = relationship("User", foreign_keys=[user_id])
    department = relationship("Department")
    created_by = relationship("User", foreign_keys=[created_by_user_id])


class LeaveRequest(Base):
    """NOUVEAU: demande de conge d'un membre du personnel, validee par le
    Responsable RH ou l'admin d'etablissement. Statut en texte simple
    (meme principe que Room/Admission/Invoice): "pending", "approved",
    "rejected"."""
    __tablename__ = "leave_requests"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    reviewed_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    establishment = relationship("Establishment")
    user = relationship("User", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_user_id])


class Service(Base):
    """Catalogue des services/actes de l'etablissement (distinct du prix de consultation par medecin)."""
    __tablename__ = "services"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    name = Column(String(200), nullable=False)
    price = Column(Float, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)

    establishment = relationship("Establishment")


class Room(Base):
    """Salles/ressources internes - usage interne uniquement, pas expose publiquement."""
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)  # NOUVEAU (hospitalisation)
    name = Column(String(200), nullable=False)
    room_type = Column(String(100), nullable=True)
    capacity = Column(Integer, nullable=True)

    establishment = relationship("Establishment")
    department = relationship("Department")


class PlatformSetting(Base):
    """Parametres generaux (cle/valeur) - Super Admin uniquement."""
    __tablename__ = "platform_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)


class ReferenceValue(Base):
    """Valeurs de reference labo (ex: Glycemie 0.70-1.10 g/L)."""
    __tablename__ = "reference_values"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    test_name = Column(String(200), nullable=False)
    unit = Column(String(50), nullable=True)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    establishment = relationship("Establishment")


class Equipment(Base):
    """
    Inventaire des equipements. Utilise a l'origine pour le laboratoire
    (voir lab_catalog.py, endpoints inchanges), etendu ici (gestion interne
    complete, demande M. Faustin) pour couvrir aussi l'equipement medical
    general (hors labo) avec suivi de maintenance preventive. Les nouveaux
    champs sont nullable: aucun impact sur les equipements labo existants.
    """
    __tablename__ = "equipment"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)  # ex: "Imagerie", "Bloc operatoire"
    status = Column(String(50), nullable=False, default="fonctionnel")
    notes = Column(Text, nullable=True)
    last_maintenance_date = Column(Date, nullable=True)
    next_maintenance_date = Column(Date, nullable=True)

    establishment = relationship("Establishment")
    department = relationship("Department")


class Supplier(Base):
    """NOUVEAU (gestion interne complete, demande M. Faustin) - fournisseur
    pour le reapprovisionnement du stock general."""
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    name = Column(String(200), nullable=False)
    contact_phone = Column(String(30), nullable=True)
    contact_email = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    establishment = relationship("Establishment")


class PurchaseOrder(Base):
    """NOUVEAU: bon de commande passe a un fournisseur, optionnellement lie
    a un article du stock general (InventoryItem) - a la reception, la
    quantite commandee est ajoutee automatiquement au stock."""
    __tablename__ = "purchase_orders"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    establishment_id = Column(UUID(as_uuid=False), ForeignKey("establishments.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=False), ForeignKey("suppliers.id"), nullable=False)
    inventory_item_id = Column(UUID(as_uuid=False), ForeignKey("inventory_items.id"), nullable=True)
    description = Column(String(300), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="pending")  # pending, received, cancelled
    ordered_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    ordered_at = Column(DateTime, default=datetime.utcnow)
    received_at = Column(DateTime, nullable=True)

    establishment = relationship("Establishment")
    supplier = relationship("Supplier")
    inventory_item = relationship("InventoryItem")
    ordered_by = relationship("User")

class SupportMessage(Base):
    """Messagerie support plateforme - patient ou staff <-> Super Admin."""
    __tablename__ = "support_messages"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(20), nullable=False)  # "user" ou "support"
    sender_name = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
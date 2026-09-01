"""
Schemas Pydantic - validation stricte de toutes les entrees utilisateur.
Aucune donnee n'atteint la base de donnees sans passer par un de ces schemas.
"""
from datetime import datetime, date, time
from typing import Optional
from app.models import DocumentType
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import UserRole, EstablishmentType, SubscriptionStatus, AppointmentStatus, ReservationStatus, DeliveryMode,DocumentType,LabTestStatus,MessageSenderRole


# ---------- AUTH ----------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    establishment_id: Optional[str] = None


class WalkInPatientCreate(BaseModel):
    """NOUVEAU (demande M. Faustin): le personnel d'accueil cree un patient
    qui se presente physiquement, sans passer par l'auto-inscription. Email
    optionnel - contrairement a l'inscription publique (PatientRegisterRequest),
    qui l'exige."""
    full_name: str = Field(min_length=2, max_length=200)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(default=None, max_length=20)
    residence: Optional[str] = Field(default=None, max_length=200)


class WalkInPatientOut(BaseModel):
    id: str
    dossier_number: str
    full_name: str
    phone: Optional[str] = None
    has_real_email: bool
    """False si aucun email n'a ete fourni: le compte a recu un email de
    substitution et ne peut pas encore etre utilise pour se connecter -
    le patient devra completer son inscription plus tard avec un vrai email."""


class PatientRegisterRequest(BaseModel):
    """Inscription publique - reservee au role patient. Les autres comptes
    sont crees par un admin (establishment_admin ou super_admin), jamais
    par inscription publique, pour eviter toute elevation de privilege."""
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=200)
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    residence: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        return v


# ---------- ETABLISSEMENTS (super admin) ----------

class EstablishmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    type: EstablishmentType
    city: str = Field(min_length=2, max_length=100)
    address: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)
    admin_full_name: str


class EstablishmentOut(BaseModel):
    id: str
    name: str
    type: EstablishmentType
    city: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    subscription_status: SubscriptionStatus
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EstablishmentSearchResult(BaseModel):
    """NOUVEAU (parcours Consultation etablissement-first): resultat de
    recherche public d'un etablissement par specialite, avec distance
    calculee si une ville de reference est fournie."""
    id: str
    name: str
    type: EstablishmentType
    city: str
    address: Optional[str] = None
    distance_km: Optional[float] = None
    doctor_count: int

    model_config = {"from_attributes": True}


class PharmacySearchResult(BaseModel):
    """NOUVEAU (pharmacie-first): resultat de recherche public d'une
    pharmacie, avec distance calculee si une ville de reference est fournie."""
    id: str
    name: str
    city: str
    address: Optional[str] = None
    distance_km: Optional[float] = None

    model_config = {"from_attributes": True}


class EstablishmentStatusUpdate(BaseModel):
    is_active: bool
    subscription_status: Optional[SubscriptionStatus] = None

class EstablishmentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[EstablishmentType] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ---------- MEDECINS ----------

class DoctorAvailabilityCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    slot_duration_minutes: int = Field(default=30, ge=5, le=240)

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: time, info):
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("L'heure de fin doit etre apres l'heure de debut")
        return v


class DoctorCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None
    specialty: str
    consultation_price: float = Field(ge=0)
    bio: Optional[str] = None


class DoctorOut(BaseModel):
    id: str
    full_name: str
    phone: Optional[str] = None
    specialty: str
    consultation_price: float
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    establishment_id: str
    is_active: bool
    average_rating: Optional[float] = None
    review_count: int = 0

    model_config = {"from_attributes": True}

class DoctorDetailOut(DoctorOut):
    establishment_name: str
    establishment_city: str
    establishment_address: Optional[str] = None

class DoctorAvailabilityOut(BaseModel):
    id: str
    day_of_week: int
    start_time: time
    end_time: time
    slot_duration_minutes: int

    model_config = {"from_attributes": True}


class DoctorAbsenceCreate(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date, info):
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("La date de fin doit etre apres la date de debut")
        return v


# ---------- RENDEZ-VOUS ----------

class AppointmentCreate(BaseModel):
    doctor_id: str
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=5, le=240)
    notes: Optional[str] = None

    @field_validator("scheduled_at")
    @classmethod
    def must_be_future(cls, v: datetime) -> datetime:
        if v < datetime.utcnow():
            raise ValueError("Impossible de prendre un rendez-vous dans le passe")
        return v


class AppointmentOut(BaseModel):
    id: str
    establishment_id: str
    doctor_id: str
    patient_id: str
    patient_name: str
    scheduled_at: datetime
    duration_minutes: int
    status: AppointmentStatus
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class AppointmentSearchRequest(BaseModel):
    """Requete de recherche/prise de RDV cote patient (section 6)."""
    specialty: str
    city: Optional[str] = None
    establishment_id: Optional[str] = None
    preferred_date: date
    preferred_time: Optional[time] = None
    doctor_id: Optional[str] = None


class SuggestionSlot(BaseModel):
    doctor_id: str
    doctor_name: str
    establishment_id: str
    establishment_name: str
    slot_start: datetime
    slot_end: datetime
    consultation_price: float
    average_rating: Optional[float] = None
    review_count: int = 0

class AppointmentSearchResponse(BaseModel):
    exact_match_available: bool
    suggestions: list[SuggestionSlot]


# ---------- PHARMACIE ----------

class StockItemCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=50)
    medication_name: str
    category: Optional[str] = None
    quantity: int = Field(ge=0)
    alert_threshold: int = Field(default=10, ge=0)
    unit_price: float = Field(ge=0)


class StockItemOut(BaseModel):
    id: str
    reference: str
    medication_name: str
    category: Optional[str] = None
    quantity: int
    alert_threshold: int
    unit_price: float
    establishment_id: str
    is_low_stock: bool

    model_config = {"from_attributes": True}


class ReservationItemCreate(BaseModel):
    """NOUVEAU: une ligne du panier (un medicament + une quantite)."""
    medication_id: str
    quantity: int = Field(ge=1)


class ReservationCreate(BaseModel):
    """
    RESTRUCTURE (panier multi-articles): une commande contient desormais
    une liste de lignes au lieu d'un seul medication_id/quantity.
    """
    items: list[ReservationItemCreate] = Field(min_length=1)
    delivery_mode: DeliveryMode = DeliveryMode.PICKUP
    # NOUVEAU (lien ordonnance -> pharmacie): reference optionnelle vers
    # l'ordonnance dont provient cette commande.
    prescription_document_id: Optional[str] = None


class ReservationItemOut(BaseModel):
    id: str
    medication_id: str
    medication_name: str
    medication_reference: str
    quantity: int
    confirmed_quantity: Optional[int] = None
    confirmed_unit_price: Optional[float] = None

    model_config = {"from_attributes": True}


class ReservationOut(BaseModel):
    id: str
    establishment_id: str
    patient_id: str
    items: list[ReservationItemOut]
    delivery_mode: DeliveryMode
    status: ReservationStatus
    estimated_ready_at: Optional[datetime] = None
    pharmacist_note: Optional[str] = None
    created_at: datetime
    total_amount: Optional[float] = None
    """Somme (confirmed_quantity * confirmed_unit_price) sur toutes les
    lignes - None tant que le pharmacien n'a pas encore tout verifie."""
    prescription_document_id: Optional[str] = None
    # NOUVEAU (demande M. Faustin): paiement en ligne, obligatoire avant
    # preparation UNIQUEMENT en cas de livraison (voir pharmacy.py).
    is_paid: bool = False
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PrescriptionMatchOut(BaseModel):
    """NOUVEAU (lien ordonnance -> pharmacie): pour un medicament prescrit,
    les articles correspondants trouves dans LE STOCK D'UNE PHARMACIE
    PRECISE (une ordonnance ne connait pas a l'avance quelle pharmacie sera
    choisie, le rapprochement se fait ici, au moment de la commande)."""
    prescribed_name: str
    prescribed_quantity: int
    dosage_instructions: Optional[str] = None
    matches: list[StockItemOut] = []


# ---------- TABLEAU DE BORD ----------

class EstablishmentStatsOut(BaseModel):
    total_appointments: int
    appointments_this_month: int
    total_doctors: int
    total_revenue_estimated: float
    low_stock_items: int
    appointments_trend_pct: Optional[float] = None


class GlobalStatsOut(BaseModel):
    total_establishments: int
    active_establishments: int
    suspended_establishments: int
    total_appointments: int
    total_revenue_estimated: float

class DoctorReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


class DoctorReviewOut(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    patient_name: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class ReservationStatusUpdate(BaseModel):
    status: ReservationStatus
    note: Optional[str] = Field(default=None, max_length=500)
    estimated_ready_at: Optional[datetime] = None


class ReservationHistoryOut(BaseModel):
    id: str
    status: ReservationStatus
    note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PrescriptionItemCreate(BaseModel):
    medication_name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1)
    dosage_instructions: Optional[str] = Field(default=None, max_length=300)


class PrescriptionItemOut(BaseModel):
    id: str
    medication_name: str
    quantity: int
    dosage_instructions: Optional[str] = None

    model_config = {"from_attributes": True}


class MedicalDocumentCreate(BaseModel):
    appointment_id: str
    document_type: DocumentType
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=1)
    # NOUVEAU (lien ordonnance -> pharmacie): liste structuree de
    # medicaments, en plus du texte libre - n'a de sens que pour
    # document_type=prescription mais accepte quel que soit le type, sans
    # validation forcee ici (souplesse).
    prescription_items: Optional[list[PrescriptionItemCreate]] = None


class ProgressNoteCreate(BaseModel):
    """NOUVEAU (hospitalisation): note de tournee, rattachee a l'admission
    via l'URL plutot qu'un appointment_id."""
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=1)


class MedicalDocumentOut(BaseModel):
    id: str
    appointment_id: Optional[str] = None
    admission_id: Optional[str] = None
    patient_id: str
    doctor_name: str
    establishment_name: str
    document_type: DocumentType
    title: str
    content: str
    created_at: datetime
    prescription_items: list[PrescriptionItemOut] = []

    model_config = {"from_attributes": True}


class VitalSignsCreate(BaseModel):
    weight_kg: Optional[float] = Field(default=None, ge=0, le=400)
    temperature_celsius: Optional[float] = Field(default=None, ge=30, le=45)
    blood_pressure: Optional[str] = Field(default=None, max_length=20)
    pulse_bpm: Optional[int] = Field(default=None, ge=0, le=300)
    respiratory_rate: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = Field(default=None, max_length=1000)


class VitalSignsOut(BaseModel):
    id: str
    recorded_by_name: str
    recorded_at: datetime
    weight_kg: Optional[float] = None
    temperature_celsius: Optional[float] = None
    blood_pressure: Optional[str] = None
    pulse_bpm: Optional[int] = None
    respiratory_rate: Optional[int] = None
    notes: Optional[str] = None


class AdmissionCreate(BaseModel):
    patient_id: str
    department_id: Optional[str] = None
    room_id: Optional[str] = None
    diagnosis: Optional[str] = Field(default=None, max_length=2000)
    expected_discharge_date: Optional[datetime] = None


class AdmissionTransferCreate(BaseModel):
    to_department_id: Optional[str] = None
    to_room_id: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=500)


class AdmissionDischarge(BaseModel):
    discharge_summary: str = Field(min_length=1, max_length=5000)


class AdmissionTransferOut(BaseModel):
    id: str
    from_department_name: Optional[str] = None
    to_department_name: Optional[str] = None
    from_room_name: Optional[str] = None
    to_room_name: Optional[str] = None
    transferred_by_name: str
    note: Optional[str] = None
    created_at: datetime


class AdmissionOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    dossier_number: str
    admitting_doctor_name: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    room_id: Optional[str] = None
    room_name: Optional[str] = None
    status: str
    diagnosis: Optional[str] = None
    admission_date: datetime
    expected_discharge_date: Optional[datetime] = None
    actual_discharge_date: Optional[datetime] = None
    discharge_summary: Optional[str] = None
    vital_signs: list[VitalSignsOut] = []
    transfers: list[AdmissionTransferOut] = []
    documents: list[MedicalDocumentOut] = []


class AdmissionSummaryOut(BaseModel):
    """Version allegee pour les listes (sans le detail complet)."""
    id: str
    patient_id: str
    patient_name: str
    dossier_number: str
    admitting_doctor_name: str
    department_name: Optional[str] = None
    room_name: Optional[str] = None
    status: str
    admission_date: datetime
    expected_discharge_date: Optional[datetime] = None


class InvoiceLineItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=300)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(ge=0)


class InvoiceLineItemOut(BaseModel):
    id: str
    description: str
    quantity: int
    unit_price: float
    line_total: float


class InvoiceCreate(BaseModel):
    patient_id: str
    line_items: list[InvoiceLineItemCreate] = Field(min_length=1)
    due_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    appointment_id: Optional[str] = None
    admission_id: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    payment_method: str = Field(min_length=2, max_length=30)  # "cash", "mobile_money", "card"
    reference: Optional[str] = Field(default=None, max_length=100)


class PaymentOut(BaseModel):
    id: str
    amount: float
    payment_method: str
    reference: Optional[str] = None
    recorded_by_name: str
    paid_at: datetime


class InvoiceOut(BaseModel):
    id: str
    invoice_number: str
    patient_id: str
    patient_name: str
    status: str
    total_amount: float
    amount_paid: float
    balance_due: float
    notes: Optional[str] = None
    issued_at: datetime
    due_date: Optional[datetime] = None
    line_items: list[InvoiceLineItemOut] = []
    payments: list[PaymentOut] = []


class InvoiceSummaryOut(BaseModel):
    id: str
    invoice_number: str
    patient_name: str
    status: str
    total_amount: float
    amount_paid: float
    balance_due: float
    issued_at: datetime


class DepartmentRevenueOut(BaseModel):
    """NOUVEAU (reporting avance): revenu REEL (encaisse) par departement,
    calcule a partir des vraies factures/paiements - plus une estimation.
    Les factures de consultation externe (non liees a une hospitalisation)
    tombent dans le seau 'Consultations / non attribue', faute de lien
    direct entre une consultation et un departement dans le modele actuel."""
    department_name: str
    total_invoiced: float
    total_collected: float


class BillingSummaryOut(BaseModel):
    """NOUVEAU: rapport financier reel (encaisse vs facture), remplace le
    simple revenu ESTIME du tableau de bord existant."""
    total_invoiced: float
    total_collected: float
    total_outstanding: float
    invoice_count: int
    unpaid_invoice_count: int


class NotificationOut(BaseModel):
    id: str
    notification_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    quantity: int = Field(default=0, ge=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    alert_threshold: int = Field(default=5, ge=0)


class InventoryItemUpdate(BaseModel):
    quantity: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, max_length=100)
    unit: Optional[str] = Field(default=None, max_length=30)
    alert_threshold: Optional[int] = Field(default=None, ge=0)


class InventoryItemOut(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    quantity: int
    unit: Optional[str] = None
    alert_threshold: int
    is_low_stock: bool

    model_config = {"from_attributes": True}


class ShiftCreate(BaseModel):
    user_id: str
    department_id: Optional[str] = None
    shift_date: date
    start_time: time
    end_time: time
    notes: Optional[str] = Field(default=None, max_length=300)


class ShiftOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    shift_date: date
    start_time: time
    end_time: time
    notes: Optional[str] = None


class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = Field(default=None, max_length=500)


class LeaveRequestReview(BaseModel):
    approve: bool
    review_note: Optional[str] = Field(default=None, max_length=300)


class LeaveRequestOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: str
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None
    created_at: datetime


class DoctorPatientOut(BaseModel):
    """NOUVEAU: une ligne de la liste 'Mes patients' d'un medecin - distinct
    du repertoire etablissement (PatientDirectoryOut), filtre a CE medecin."""
    id: str
    full_name: str
    dossier_number: str
    last_visit: Optional[datetime] = None
    visits_count: int


class DoctorPatientAppointmentOut(BaseModel):
    id: str
    scheduled_at: datetime


class DoctorPatientDetailOut(BaseModel):
    """NOUVEAU: fiche patient vue par un medecin - ses propres rendez-vous
    termines avec ce patient + les documents associes. can_add_document
    indique si CE medecin peut completer le dossier (patient traite
    personnellement) ou le consulte seulement via un partage recu d'un
    confrere (lecture seule)."""
    id: str
    full_name: str
    dossier_number: str
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    appointments: list[DoctorPatientAppointmentOut]
    documents: list[MedicalDocumentOut]
    can_add_document: bool
    viewed_via_share_from: Optional[str] = None


class PatientRecordShareCreate(BaseModel):
    to_doctor_id: str
    note: Optional[str] = Field(default=None, max_length=500)


class PatientRecordShareOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    from_doctor_id: str
    from_doctor_name: str
    to_doctor_id: str
    note: Optional[str] = None
    created_at: datetime


class LabOut(BaseModel):
    id: str
    name: str
    city: str
    address: Optional[str] = None


class LabTestRequestCreate(BaseModel):
    establishment_id: str
    test_name: str = Field(min_length=2, max_length=200)
    sample_type: Optional[str] = None
    scheduled_sample_at: Optional[datetime] = None


class LabTestRequestOut(BaseModel):
    id: str
    establishment_id: str
    establishment_name: str
    patient_id: str
    test_name: str
    sample_type: Optional[str] = None
    status: LabTestStatus
    scheduled_sample_at: Optional[datetime] = None
    sample_collected_at: Optional[datetime] = None
    results_text: Optional[str] = None
    lab_technician_note: Optional[str] = None
    created_at: datetime
    referred_by_establishment_name: Optional[str] = None
    referred_by_doctor_name: Optional[str] = None

    model_config = {"from_attributes": True}


class LabTestStatusUpdate(BaseModel):
    status: LabTestStatus
    results_text: Optional[str] = None
    lab_technician_note: Optional[str] = Field(default=None, max_length=500)

class MonthlyTrendPoint(BaseModel):
    year: int
    month: int
    label: str
    appointments_count: int
    revenue: float


class EstablishmentBreakdownPoint(BaseModel):
    establishment_id: str
    establishment_name: str
    appointments_count: int
    revenue: float


class GlobalTrendsOut(BaseModel):
    monthly: list[MonthlyTrendPoint]
    by_establishment: list[EstablishmentBreakdownPoint]

class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: str
    patient_id: str
    establishment_id: str
    sender_role: MessageSenderRole
    sender_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationSummaryOut(BaseModel):
    establishment_id: str
    establishment_name: str
    patient_id: str
    patient_name: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None

class UserProfileOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    gender: Optional[str] = None
    residence: Optional[str] = None
    role: UserRole
    establishment_id: Optional[str] = None


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    residence: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        return v

class StaffCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=200)
    phone: Optional[str] = None
    role: UserRole
    # NOUVEAU (dossier employe, gestion interne complete):
    department_id: Optional[str] = None
    position_title: Optional[str] = Field(default=None, max_length=150)
    hire_date: Optional[date] = None
    contract_type: Optional[str] = Field(default=None, max_length=50)
    license_number: Optional[str] = Field(default=None, max_length=100)


class StaffOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    position_title: Optional[str] = None
    hire_date: Optional[date] = None
    contract_type: Optional[str] = None
    license_number: Optional[str] = None


class StaffProfileUpdate(BaseModel):
    """NOUVEAU: mise a jour du dossier employe uniquement (pas de
    email/password/role, contrairement a StaffCreate qui sert a la
    creation du compte)."""
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    phone: Optional[str] = None
    department_id: Optional[str] = None
    position_title: Optional[str] = Field(default=None, max_length=150)
    hire_date: Optional[date] = None
    contract_type: Optional[str] = Field(default=None, max_length=50)
    license_number: Optional[str] = Field(default=None, max_length=100)


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    head_user_id: Optional[str] = None


class DepartmentOut(BaseModel):
    id: str
    name: str
    head_user_id: Optional[str] = None
    head_user_name: Optional[str] = None
    staff_count: int

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: str
    user_name: str
    establishment_name: Optional[str] = None
    action: str
    details: Optional[str] = None
    created_at: datetime   

class PatientDirectoryOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    dossier_number: str
    last_visit: Optional[datetime] = None


class DependentCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    relation_type: str = Field(min_length=2, max_length=50)
    date_of_birth: Optional[date] = None


class DependentOut(BaseModel):
    id: str
    full_name: str
    relation_type: str
    date_of_birth: Optional[date] = None

    model_config = {"from_attributes": True}


class UserDirectoryOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: UserRole
    establishment_name: Optional[str] = None
    is_active: bool
    created_at: datetime

class AppointmentReschedule(BaseModel):
    new_scheduled_at: datetime

    @field_validator("new_scheduled_at")
    @classmethod
    def must_be_future(cls, v: datetime) -> datetime:
        if v < datetime.utcnow():
            raise ValueError("Impossible de reporter a une date passee")
        return v


class OpeningHoursCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    open_time: time
    close_time: time

    @field_validator("close_time")
    @classmethod
    def close_after_open(cls, v: time, info):
        open_t = info.data.get("open_time")
        if open_t and v <= open_t:
            raise ValueError("L'heure de fermeture doit etre apres l'heure d'ouverture")
        return v


class OpeningHoursOut(BaseModel):
    id: str
    day_of_week: int
    open_time: time
    close_time: time

    model_config = {"from_attributes": True}

class LabTestItemInput(BaseModel):
    test_name: str = Field(min_length=2, max_length=200)
    sample_type: Optional[str] = None


class LabTestRegisterByStaff(BaseModel):
    """
    ELARGI (demande M. Faustin): un patient present sur place peut
    commander PLUSIEURS analyses a la fois (ex: glycemie + cholesterol +
    creatinine) - avant, il fallait repeter tout le formulaire, en
    reselectionnant le patient, pour chaque analyse individuellement.
    """
    patient_id: str
    tests: list[LabTestItemInput] = Field(min_length=1)


class LabStatsOut(BaseModel):
    total_tests: int
    delivered_count: int
    pending_count: int
    to_validate_count: int
    completion_rate_pct: Optional[float] = None
    average_turnaround_days: Optional[float] = None


class GlobalAppointmentOut(BaseModel):
    id: str
    patient_name: str
    doctor_name: str
    establishment_name: str
    scheduled_at: datetime
    status: AppointmentStatus


class GlobalOrderOut(BaseModel):
    id: str
    patient_name: str
    medication_name: str
    establishment_name: str
    quantity: int
    status: ReservationStatus
    created_at: datetime


class GlobalDoctorOut(BaseModel):
    id: str
    full_name: str
    specialty: str
    establishment_name: str
    is_active: bool


class GlobalEstablishmentSummaryOut(BaseModel):
    id: str
    name: str
    city: str
    is_active: bool
    subscription_status: SubscriptionStatus
    admin_email: Optional[str] = None

class ServiceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    price: float = Field(ge=0)
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = None


class ServiceOut(BaseModel):
    id: str
    name: str
    price: float
    duration_minutes: Optional[int] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    room_type: Optional[str] = None
    capacity: Optional[int] = Field(default=None, ge=1)
    department_id: Optional[str] = None


class RoomOut(BaseModel):
    id: str
    name: str
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    # NOUVEAU (hospitalisation): occupation calculee en temps reel a partir
    # des admissions actives - jamais stockee, pour eviter tout risque de
    # desynchronisation entre ce champ et la realite.
    is_occupied: bool = False
    current_patient_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PlatformSettingsOut(BaseModel):
    platform_name: str
    support_email: Optional[str] = None
    support_phone: Optional[str] = None


class PlatformSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None


class ReferenceValueCreate(BaseModel):
    test_name: str = Field(min_length=2, max_length=200)
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    notes: Optional[str] = None


class ReferenceValueOut(BaseModel):
    id: str
    test_name: str
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class EquipmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    status: str = Field(default="fonctionnel")
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = {"fonctionnel", "maintenance", "hors_service"}
        if v not in allowed:
            raise ValueError(f"Statut invalide, doit etre parmi: {', '.join(allowed)}")
        return v


class EquipmentOut(BaseModel):
    id: str
    name: str
    status: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}

class GeneralEquipmentCreate(BaseModel):
    """NOUVEAU (gestion interne complete): equipement medical general (hors
    laboratoire), avec suivi de maintenance preventive."""
    name: str = Field(min_length=2, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    department_id: Optional[str] = None
    status: str = Field(default="fonctionnel")
    notes: Optional[str] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = {"fonctionnel", "maintenance", "hors_service"}
        if v not in allowed:
            raise ValueError(f"Statut invalide, doit etre parmi: {', '.join(allowed)}")
        return v


class GeneralEquipmentOut(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    maintenance_due: bool


class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    contact_phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    notes: Optional[str] = None


class SupplierOut(BaseModel):
    id: str
    name: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    inventory_item_id: Optional[str] = None
    description: str = Field(min_length=2, max_length=300)
    quantity: int = Field(ge=1)


class PurchaseOrderOut(BaseModel):
    id: str
    supplier_id: str
    supplier_name: str
    inventory_item_id: Optional[str] = None
    inventory_item_name: Optional[str] = None
    description: str
    quantity: int
    status: str
    ordered_by_name: str
    ordered_at: datetime
    received_at: Optional[datetime] = None


class PendingOverviewOut(BaseModel):
    pending_appointments: int
    pending_orders: int
    cancelled_appointments: int
    low_stock_items: int
    pending_lab_tests: int


class PatientDetailOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    dossier_number: str
    appointments: list[GlobalAppointmentOut]
    orders_count: int
    lab_tests_count: int

class PharmacyStatsOut(BaseModel):
    total_orders: int
    orders_this_month: int
    pending_orders: int
    low_stock_items: int

class SupportMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class SupportMessageOut(BaseModel):
    id: str
    user_id: str
    sender_role: str
    sender_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SupportThreadSummaryOut(BaseModel):
    user_id: str
    user_name: str
    user_role: UserRole
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None

class LabReferralCreate(BaseModel):
    appointment_id: str
    lab_establishment_id: str
    test_name: str = Field(min_length=2, max_length=200)
    sample_type: Optional[str] = None

class ReservationItemReview(BaseModel):
    """NOUVEAU: verification d'une ligne precise (par son id de ligne)."""
    item_id: str
    confirmed_quantity: int = Field(ge=0)
    confirmed_unit_price: float = Field(ge=0)


class ReservationReview(BaseModel):
    """
    RESTRUCTURE (panier multi-articles): le pharmacien verifie chaque
    ligne separement (une ligne peut etre en rupture alors qu'une autre
    est disponible), plus une note globale pour la commande entiere.
    """
    items: list[ReservationItemReview] = Field(min_length=1)
    note: Optional[str] = Field(default=None, max_length=500)
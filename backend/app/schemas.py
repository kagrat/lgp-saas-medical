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


class ReservationCreate(BaseModel):
    medication_id: str
    quantity: int = Field(ge=1)
    delivery_mode: DeliveryMode = DeliveryMode.PICKUP


class ReservationOut(BaseModel):
    id: str
    establishment_id: str
    patient_id: str
    medication_id: str
    medication_name: str
    medication_reference: str
    quantity: int
    delivery_mode: DeliveryMode
    status: ReservationStatus
    estimated_ready_at: Optional[datetime] = None
    pharmacist_note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


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


class MedicalDocumentCreate(BaseModel):
    appointment_id: str
    document_type: DocumentType
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=1)


class MedicalDocumentOut(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    doctor_name: str
    establishment_name: str
    document_type: DocumentType
    title: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

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

class StaffCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=200)
    phone: Optional[str] = None
    role: UserRole


class StaffOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool


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

class LabTestRegisterByStaff(BaseModel):
    patient_id: str
    test_name: str = Field(min_length=2, max_length=200)
    sample_type: Optional[str] = None


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


class RoomOut(BaseModel):
    id: str
    name: str
    room_type: Optional[str] = None
    capacity: Optional[int] = None

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
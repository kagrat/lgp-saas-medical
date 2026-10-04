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


class LoginResponse(BaseModel):
    """NOUVEAU (audit de securite complet): reponse de connexion qui peut
    soit contenir un vrai jeton (2FA desactivee ou pas d'utilisateur a
    verifier), soit indiquer qu'un code de verification vient d'etre
    envoye par email (2FA activee)."""
    requires_2fa: bool = False
    token: Optional[TokenResponse] = None
    message: Optional[str] = None


class Verify2FARequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class TwoFactorToggle(BaseModel):
    enabled: bool


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


class CompleteRegistrationRequest(BaseModel):
    """NOUVEAU (demande M. Faustin): permet au personnel d'accueil
    d'ajouter un VRAI email a un patient cree sans email au depart
    (WalkInPatientCreate) - une fois ceci fait, le patient peut utiliser
    "mot de passe oublie" pour choisir lui-meme son mot de passe et
    commencer a utiliser la plateforme."""
    email: EmailStr


class WalkInPatientOut(BaseModel):
    id: str
    dossier_number: str
    full_name: str
    phone: Optional[str] = None
    has_real_email: bool
    """False si aucun e-mail n'a été fourni: le compte a reçu un e-mail de
    substitution et ne peut pas encore être utilisé pour se connecter -
    le patient devra compléter son inscription plus tard avec un vrai e-mail."""


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
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


class EstablishmentLogoUpdate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: profil d'etablissement
    avec logo). logo_url attendu au format "data URL" base64
    (image/png;base64,... ou image/jpeg;base64,...) - taille limitee cote
    serveur pour eviter qu'une image demesuree alourdisse chaque reponse
    API qui inclut l'etablissement."""
    logo_url: str = Field(max_length=700_000)  # ~500 Ko d'image encodee en base64

    @field_validator("logo_url")
    @classmethod
    def valid_data_url(cls, v: str) -> str:
        if not v.startswith("data:image/"):
            raise ValueError("Le logo doit être une image valide (PNG ou JPEG)")
        return v


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
    # NOUVEAU (demande explicite de M. Faustin: "la ou la pharmacie est
    # ouverte, le patient le sait deja pendant la recherche"). Calcule
    # directement ici (pas d'appel separe par pharmacie) pour eviter de
    # multiplier les requetes reseau sur une liste de resultats.
    is_open_now: Optional[bool] = None
    today_hours: Optional[str] = None

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


class EstablishmentSelfUpdate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: "donner la main aux ETS
    pour modifier le nom de leur ETS"). Volontairement plus restreint que
    EstablishmentUpdate (reserve au super-admin) - PAS de "type"
    (classification hopital/clinique/pharmacie/labo, decision de
    plateforme), un etablissement ne modifie que ses propres informations
    d'identite courantes."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    city: Optional[str] = None
    address: Optional[str] = None


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
            raise ValueError("L'heure de fin doit être après l'heure de début")
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
            raise ValueError("La date de fin doit être après la date de début")
        return v


class DoctorAbsenceOut(BaseModel):
    """NOUVEAU: manquait avant - on pouvait creer une absence mais jamais
    la voir ni la supprimer, contrairement aux disponibilites qui avaient
    deja les 3 (ajouter/lister/retirer)."""
    id: str
    start_date: date
    end_date: date
    reason: Optional[str] = None

    model_config = {"from_attributes": True}


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
            raise ValueError("Impossible de prendre un rendez-vous dans le passé")
        return v


class AppointmentBookForPatient(BaseModel):
    """NOUVEAU (demande M. Faustin): meme parcours que le patient
    (specialite -> etablissement -> medecin -> creneau precis), mais pour
    la reception qui reserve POUR un patient present physiquement -
    necessite de preciser QUEL patient, contrairement a AppointmentCreate
    ou le patient est toujours current_user lui-meme."""
    patient_id: str
    doctor_id: str
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=5, le=240)
    notes: Optional[str] = None

    @field_validator("scheduled_at")
    @classmethod
    def must_be_future(cls, v: datetime) -> datetime:
        if v < datetime.utcnow():
            raise ValueError("Impossible de prendre un rendez-vous dans le passé")
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
    dossier_number: Optional[str] = None
    # NOUVEAU (demande explicite de M. Faustin: "faut que les RDV
    # affichent les informations avec le medecin aupres de qui le RDV
    # est pris" - la liste des RDV du portail etablissement n'affichait
    # AUCUNE information, ni patient ni medecin, un bug reel confirme par
    # capture).
    doctor_name: Optional[str] = None

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


class AvailableSlotsResponse(BaseModel):
    """
    NOUVEAU (demande M. Faustin: "aucune disponibilite ne s'affiche" -
    apres verification approfondie, le moteur de calcul fonctionne
    correctement dans tous les tests, mais l'ancienne reponse (une simple
    liste vide) ne distinguait pas deux situations tres differentes:
    - le medecin n'a AUCUN horaire hebdomadaire configure du tout
      (has_availability_configured=False) - il faut d'abord renseigner
      "Ma disponibilite" avant que des rendez-vous soient possibles,
    - le medecin a des horaires configures mais ce jour precis est
      complet ou tombe un jour ou il ne travaille pas
      (has_availability_configured=True, slots=[]).
    Cette distinction evite de confondre un oubli de configuration avec
    un vrai "complet".
    """
    slots: list[SuggestionSlot]
    has_availability_configured: bool


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
    # NOUVEAU (demande explicite de M. Faustin: Inventaire, partie 1).
    unit_of_sale: Optional[str] = Field(default=None, max_length=100)
    dci: Optional[str] = Field(default=None, max_length=200)
    units_per_box: Optional[int] = Field(default=None, ge=1)
    form: Optional[str] = Field(default=None, max_length=100)
    dosage: Optional[str] = Field(default=None, max_length=100)
    manufacturer: Optional[str] = Field(default=None, max_length=200)


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
    unit_of_sale: Optional[str] = None
    dci: Optional[str] = None
    units_per_box: Optional[int] = None
    form: Optional[str] = None
    dosage: Optional[str] = None
    manufacturer: Optional[str] = None

    model_config = {"from_attributes": True}


class PharmacyBatchCreate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: Inventaire, partie 2 -
    enregistrement des lots recus pour un produit deja cree en partie 1)."""
    stock_item_id: str
    lot_number: str = Field(min_length=1, max_length=100)
    received_at: date
    quantity_received: int = Field(gt=0)
    expiration_date: date

    @field_validator("expiration_date")
    @classmethod
    def expiration_after_reception(cls, v: date, info):
        received_at = info.data.get("received_at")
        if received_at and v <= received_at:
            raise ValueError("La date d'expiration doit être postérieure à la date de réception")
        return v


class PharmacyBatchOut(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: Inventaire, partie 3 -
    consultation du stock). "status" alterne automatiquement entre
    disponible / expire_bientot / stock_faible."""
    id: str
    stock_item_id: str
    medication_name: str
    lot_number: str
    received_at: date
    quantity_received: int
    expiration_date: date
    unit_price: float
    status: str

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


class GuestReservationCreate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: "un patient qui n'a pas
    pris la plateforme mais veut payer les medicaments avec ordonnance" -
    juste uploader l'image de l'ordonnance). Aucune authentification
    requise - un compte "invite" est cree automatiquement en coulisses,
    sans mot de passe utilisable. Pas de liste d'articles a la creation
    (le patient n'a pas acces au catalogue) - le pharmacien les ajoute
    apres avoir lu l'ordonnance."""
    establishment_id: str
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=6, max_length=30)
    delivery_mode: DeliveryMode = DeliveryMode.PICKUP
    prescription_image: str = Field(max_length=8_000_000)

    @field_validator("prescription_image")
    @classmethod
    def valid_image(cls, v: str) -> str:
        if not v.startswith("data:image/"):
            raise ValueError("L'ordonnance doit être une image valide (PNG ou JPEG)")
        return v


class ReservationAddItem(BaseModel):
    """NOUVEAU (necessaire pour les commandes invite: le pharmacien lit
    l'ordonnance uploadee puis ajoute lui-meme les medicaments demandes,
    le patient invite n'ayant pas acces au catalogue pour les choisir
    lui-meme)."""
    medication_id: str
    quantity: int = Field(gt=0)


class ReservationItemOut(BaseModel):
    id: str
    medication_id: str
    medication_name: str
    medication_reference: str
    quantity: int
    confirmed_quantity: Optional[int] = None
    confirmed_unit_price: Optional[float] = None
    stock_status: Optional[str] = None
    # NOUVEAU (demande explicite de M. Faustin: "le prix des medicaments
    # vienne automatiquement dans la case medicament lors de la
    # confirmation de commande... vue que ces prix ont deja ete
    # specifies dans l'inventaire") - prix ACTUEL du catalogue, distinct
    # de confirmed_unit_price (la valeur que le pharmacien confirme
    # reellement, modifiable si besoin - un prix a pu changer entre la
    # demande du patient et la verification).
    catalog_unit_price: Optional[float] = None

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
    lignes - None tant que le pharmacien n'a pas encore tout vérifié."""
    prescription_document_id: Optional[str] = None
    # NOUVEAU (demande explicite de M. Faustin: liste des commandes
    # restructuree - numero de commande, nom du patient et numero de
    # telephone visibles directement, sans avoir a ouvrir chaque commande).
    order_number: str
    patient_name: str
    patient_phone: Optional[str] = None
    # NOUVEAU (demande M. Faustin): paiement en ligne, obligatoire avant
    # preparation UNIQUEMENT en cas de livraison (voir pharmacy.py).
    is_paid: bool = False
    paid_at: Optional[datetime] = None
    # NOUVEAU (commande invite - sans compte, ordonnance uploadee).
    is_guest_order: bool = False
    guest_prescription_image: Optional[str] = None

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


class PrescriptionLabItemCreate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: le patient doit pouvoir
    utiliser une ordonnance pour commander ses analyses, exact miroir de
    PrescriptionItemCreate pour les medicaments)."""
    test_name: str = Field(min_length=1, max_length=200)
    sample_type: Optional[str] = Field(default=None, max_length=100)


class PrescriptionLabItemOut(BaseModel):
    id: str
    test_name: str
    sample_type: Optional[str] = None

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
    prescription_lab_items: Optional[list[PrescriptionLabItemCreate]] = None


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
    prescription_lab_items: list[PrescriptionLabItemOut] = []

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


class MedicationAdministrationCreate(BaseModel):
    """NOUVEAU (lacune identifiee lors d'un audit complet): l'infirmier
    trace chaque medicament reellement donne - pas seulement ce qui a ete
    prescrit sur le papier."""
    medication_name: str = Field(min_length=1, max_length=200)
    dosage: Optional[str] = Field(default=None, max_length=100)
    status: str = Field(default="given")
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in ("given", "held", "refused"):
            raise ValueError("Statut invalide - valeurs acceptées: given, held, refused")
        return v


class MedicationAdministrationOut(BaseModel):
    id: str
    medication_name: str
    dosage: Optional[str] = None
    administered_by_name: str
    administered_at: datetime
    status: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class AdmissionCreate(BaseModel):
    patient_id: str
    department_id: Optional[str] = None
    room_id: Optional[str] = None
    # CORRIGE (bug reel trouve lors d'une relecture rigoureuse: le
    # modele Admission avait deja bed_id, RoomOut calculait deja
    # l'occupation lit par lit, mais AdmissionCreate n'exposait jamais ce
    # champ - impossible de reellement choisir un lit malgre toute
    # l'infrastructure deja en place).
    bed_id: Optional[str] = None
    diagnosis: Optional[str] = Field(default=None, max_length=2000)
    expected_discharge_date: Optional[datetime] = None
    admitting_doctor_id: Optional[str] = None


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
    bed_id: Optional[str] = None
    bed_label: Optional[str] = None
    status: str
    diagnosis: Optional[str] = None
    admission_date: datetime
    expected_discharge_date: Optional[datetime] = None
    actual_discharge_date: Optional[datetime] = None
    discharge_summary: Optional[str] = None
    vital_signs: list[VitalSignsOut] = []
    transfers: list[AdmissionTransferOut] = []
    documents: list[MedicalDocumentOut] = []
    medication_administrations: list[MedicationAdministrationOut] = []


class AdmissionSummaryOut(BaseModel):
    """Version allegee pour les listes (sans le detail complet)."""
    id: str
    patient_id: str
    patient_name: str
    dossier_number: str
    admitting_doctor_name: str
    department_name: Optional[str] = None
    room_name: Optional[str] = None
    bed_label: Optional[str] = None
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


class ShiftSelfCreate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: "en attendant" que
    DRH/ETS gerent entierement la disponibilite des medecins, "ajouter
    l'option de programmation au niveau de mon planning pour permettre
    aux medecins de se programmer ses gardes"). Pas de user_id: toujours
    la garde de l'utilisateur CONNECTE, jamais celle d'un autre - solution
    temporaire, distincte de la creation par les RH (create_shift), qui
    reste la voie definitive prevue."""
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
    # NOUVEAU (demande explicite de M. Faustin: trace d'un transfert).
    # "transferred_out" = j'ai transfere ce patient, "transferred_in" = on
    # me l'a transfere. transfer_counterpart = nom de l'autre medecin.
    transfer_status: Optional[str] = None
    transfer_counterpart: Optional[str] = None
    transferred_at: Optional[datetime] = None


class DoctorPatientAppointmentOut(BaseModel):
    id: str
    scheduled_at: datetime


class ClinicalFlagCreate(BaseModel):
    flag_type: str = Field(default="other")
    label: str = Field(min_length=1, max_length=200)


class ClinicalFlagOut(BaseModel):
    id: str
    flag_type: str
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    appointments: list[DoctorPatientAppointmentOut]
    documents: list[MedicalDocumentOut]
    clinical_flags: list[ClinicalFlagOut] = []
    can_add_document: bool
    viewed_via_share_from: Optional[str] = None
    # NOUVEAU (demande explicite de M. Faustin: donner la main a
    # l'etablissement "lorsque le dossier n'est pas... pris en charge en
    # cours chez un medecin") - information, pas un blocage: signale si
    # un medecin est actuellement EN CONSULTATION avec ce patient.
    currently_with_doctor: Optional[str] = None
    # NOUVEAU (transfert de rendez-vous entre medecins): noms des medecins
    # impliques dans le dernier transfert de ce patient concernant le
    # medecin connecte, et possibilite reelle d'ecrire a ce patient. Le
    # fil de discussion appartient au medecin du rendez-vous le plus
    # recent: apres un transfert, c'est le medecin receveur qui peut
    # ecrire, pas l'emetteur - can_message evite a l'interface de proposer
    # un envoi voue a l'echec.
    transferred_to: Optional[str] = None
    transferred_from: Optional[str] = None
    can_message: bool = True


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
    # NOUVEAU (demande explicite de M. Faustin: le patient utilise une
    # ordonnance pour commander ses analyses lui-meme).
    source_document_id: Optional[str] = None


class LabTestRequestOut(BaseModel):
    id: str
    establishment_id: str
    establishment_name: str
    patient_id: str
    test_name: str
    sample_type: Optional[str] = None
    status: LabTestStatus
    priority: str = "routine"
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
    # NOUVEAU: avec QUI le patient converse dans cet etablissement (un
    # medecin, un autre membre du personnel, ou None = guichet d'une
    # pharmacie/laboratoire). Cote patient, une entree par interlocuteur.
    counterparty_user_id: Optional[str] = None
    counterparty_name: Optional[str] = None


class InternalMessageCreate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: "il faut que l'ets puisse
    envoyer des messages aux medecins") - messagerie interne, distincte du
    chat patient <-> etablissement."""
    content: str = Field(min_length=1, max_length=2000)


class InternalMessageOut(BaseModel):
    id: str
    from_user_id: str
    to_user_id: str
    sender_name: str
    content: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class InternalConversationSummaryOut(BaseModel):
    """Une ligne = un collegue avec qui une conversation interne existe."""
    other_user_id: str
    other_user_name: str
    other_user_role: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

class UserProfileOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    gender: Optional[str] = None
    residence: Optional[str] = None
    role: UserRole
    establishment_id: Optional[str] = None
    photo_url: Optional[str] = None
    two_factor_enabled: bool = False


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    residence: Optional[str] = None


class UserPhotoUpdate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: "il peut ajouter des
    photos a son profil") - meme approche et memes limites que le logo
    d'etablissement (EstablishmentLogoUpdate)."""
    photo_url: str = Field(max_length=700_000)

    @field_validator("photo_url")
    @classmethod
    def valid_data_url(cls, v: str) -> str:
        if not v.startswith("data:image/"):
            raise ValueError("La photo doit être une image valide (PNG ou JPEG)")
        return v


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

class EmergencyContactUpdate(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin): personne a contacter en
    cas d'urgence, avec un vrai numero de telephone - distinct de
    "Dependents" qui declare des membres de la famille, pas un contact
    d'urgence."""
    emergency_contact_name: Optional[str] = Field(default=None, max_length=200)
    emergency_contact_relation: Optional[str] = Field(default=None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(default=None, max_length=30)


class MyPatientProfileOut(BaseModel):
    id: str
    dossier_number: str
    date_of_birth: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

    model_config = {"from_attributes": True}


class PatientDirectoryOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    dossier_number: str
    last_visit: Optional[datetime] = None
    # NOUVEAU (demande explicite de M. Faustin): visible par le personnel
    # qui consulte la fiche du patient, pour pouvoir appeler en cas de
    # besoin reel.
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


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
            raise ValueError("Impossible de reporter à une date passée")
        return v


class AppointmentTransfer(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: "transferer un rendez-vous
    a un collegue") - reassigne un rendez-vous CONFIRME a un autre medecin
    du meme etablissement, au meme creneau horaire."""
    new_doctor_id: str


class OpeningHoursCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    open_time: time
    close_time: time

    @field_validator("close_time")
    @classmethod
    def close_after_open(cls, v: time, info):
        open_t = info.data.get("open_time")
        if open_t and v <= open_t:
            raise ValueError("L'heure de fermeture doit être après l'heure d'ouverture")
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
    # NOUVEAU (lacune identifiee lors d'un audit complet): priorite
    # decidee par le personnel medical (labo ou medecin), jamais par le
    # patient lui-meme - sinon n'importe qui pourrait se dire "urgent"
    # pour passer devant les autres, ce qui viderait la triage de son sens.
    priority: str = Field(default="routine")

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        if v not in ("routine", "urgent"):
            raise ValueError("Priorité invalide - valeurs acceptées: routine, urgent")
        return v


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


class BedOut(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: choisir la chambre ET le
    lit lors de l'hospitalisation) - occupation calculee en temps reel,
    jamais stockee, meme principe que pour la chambre."""
    id: str
    label: str
    is_occupied: bool = False
    current_patient_name: Optional[str] = None


class RoomOut(BaseModel):
    id: str
    name: str
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    # CORRIGE (bug reel identifie: is_occupied passait a True des qu'UN
    # SEUL lit etait pris, bloquant les autres lits libres de la meme
    # chambre - signifie desormais "TOUS les lits sont pris").
    is_occupied: bool = False
    current_patient_name: Optional[str] = None
    beds: list[BedOut] = []

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
            raise ValueError(f"Statut invalide, doit être parmi: {', '.join(allowed)}")
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
            raise ValueError(f"Statut invalide, doit être parmi: {', '.join(allowed)}")
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
    # NOUVEAU (demande explicite de M. Faustin: tableau de bord pharmacie
    # en tete de menu, avec 4 grands rectangles).
    deliveries_in_progress: int
    revenue_today: float


class PharmacyDailyRevenueOut(BaseModel):
    """NOUVEAU (demande explicite de M. Faustin: le rapport generique
    "revenu par departement" n'a aucun sens pour une pharmacie, qui n'a
    pas de departements medicaux - rapport propre a la pharmacie)."""
    date: date
    revenue: float


class PharmacyReportOut(BaseModel):
    daily_revenue: list[PharmacyDailyRevenueOut]
    expiring_batches: list[PharmacyBatchOut]


class PharmacyOrderSummaryOut(BaseModel):
    """NOUVEAU: raccourci des commandes en cours pour le tableau de bord -
    un nombre limite, pas la liste complete (deja disponible dans
    l'onglet Commandes)."""
    id: str
    order_number: str
    patient_name: str
    total_amount: Optional[float] = None
    status: str
    created_at: datetime


    """NOUVEAU: raccourci des commandes en cours pour le tableau de bord -
    un nombre limité, pas la liste complète (déjà disponible dans
    l'onglet Commandes)."""
    id: str
    patient_name: str
    total_amount: Optional[float] = None
    status: str
    created_at: datetime

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
    priority: str = Field(default="routine")

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        if v not in ("routine", "urgent"):
            raise ValueError("Priorité invalide - valeurs acceptées: routine, urgent")
        return v

class ReservationItemReview(BaseModel):
    """NOUVEAU: verification d'une ligne precise (par son id de ligne)."""
    item_id: str
    confirmed_quantity: int = Field(ge=0)
    confirmed_unit_price: float = Field(ge=0)
    # NOUVEAU (demande M. Faustin): motif structure, choisi dans une liste
    # deroulante par le pharmacien plutot que devine via confirmed_quantity.
    stock_status: str = Field(default="disponible")

    @field_validator("stock_status")
    @classmethod
    def valid_stock_status(cls, v: str) -> str:
        allowed = {"disponible", "disponible_partiel", "rupture_temporaire", "rupture_totale"}
        if v not in allowed:
            raise ValueError(f"Motif de stock invalide. Valeurs acceptées: {', '.join(sorted(allowed))}")
        return v


class ReservationReview(BaseModel):
    """
    RESTRUCTURE (panier multi-articles): le pharmacien verifie chaque
    ligne separement (une ligne peut etre en rupture alors qu'une autre
    est disponible), plus une note globale pour la commande entiere.
    """
    items: list[ReservationItemReview] = Field(min_length=1)
    note: Optional[str] = Field(default=None, max_length=500)
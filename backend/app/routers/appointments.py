"""
Module 3 - Gestion des rendez-vous + moteur de suggestion automatique.

NOUVEAU: chaque rendez-vous renvoie desormais le nom du patient
(patient_name) - jusqu'ici, la liste des RDV cote etablissement
n'affichait que la date et le statut, sans jamais dire de qui il
s'agissait. Corrige via une fonction commune reutilisee partout dans ce
fichier, pour garantir que ce champ est toujours rempli correctement.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, Doctor, Patient, User, UserRole, AppointmentStatus, AuditLog, VitalSigns, Establishment, DoctorAvailability
from app.schemas import (
    AppointmentCreate, AppointmentOut, AppointmentSearchRequest, AppointmentSearchResponse, AppointmentReschedule,
    VitalSignsCreate, VitalSignsOut, SuggestionSlot, AppointmentBookForPatient, AvailableSlotsResponse,
)
from app.deps import require_roles, get_current_user
from app.services.suggestion_engine import find_appointment_or_suggest, _free_slots_for_doctor, _rating_stats
from app.services.notifications import send_confirmation_email, send_sms

router = APIRouter(prefix="/appointments", tags=["rendez-vous"])


def _to_appointment_out(appointment: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=appointment.id,
        establishment_id=appointment.establishment_id,
        doctor_id=appointment.doctor_id,
        patient_id=appointment.patient_id,
        patient_name=appointment.patient.user.full_name if appointment.patient else "Inconnu",
        scheduled_at=appointment.scheduled_at,
        duration_minutes=appointment.duration_minutes,
        status=appointment.status,
        notes=appointment.notes,
    )


@router.post("/search", response_model=AppointmentSearchResponse)
def search_appointment_slots(payload: AppointmentSearchRequest, db: Session = Depends(get_db)):
    requested_doctor_id = payload.doctor_id

    if not requested_doctor_id and payload.establishment_id and payload.preferred_time:
        doctor = (
            db.query(Doctor)
            .filter(Doctor.establishment_id == payload.establishment_id, Doctor.specialty == payload.specialty)
            .first()
        )
        requested_doctor_id = doctor.id if doctor else None

    exact_match, suggestions = find_appointment_or_suggest(
        db=db,
        specialty=payload.specialty,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
        city=payload.city,
        establishment_id=payload.establishment_id,
        requested_doctor_id=requested_doctor_id,
    )
    return AppointmentSearchResponse(exact_match_available=exact_match, suggestions=suggestions)


@router.get("/available-slots", response_model=AvailableSlotsResponse)
def list_available_slots(doctor_id: str, target_date: str, db: Session = Depends(get_db)):
    """
    NOUVEAU (demande M. Faustin): contrairement a /search (qui suggere au
    plus 6 creneaux, classes par proximite d'une heure preferee, pour
    plusieurs medecins a la fois), cet endpoint retourne TOUS les creneaux
    libres d'UN SEUL medecin pour UNE SEULE journee - le systeme connait
    deja ses horaires de travail et la duree exacte d'une consultation
    (DoctorAvailability), donc peut afficher precisement ce qui reste
    disponible au fur et a mesure que des rendez-vous sont pris. Reutilise
    le meme moteur de calcul (_free_slots_for_doctor) que /search, deja
    fiable et teste - pas de nouvelle logique, juste sans la limite de 6.

    CORRIGE (demande M. Faustin, "aucune disponibilite ne s'affiche"):
    signale desormais explicitement si ce medecin n'a AUCUN horaire
    hebdomadaire configure du tout, plutot que de renvoyer une liste vide
    identique a "complet ce jour-la" - source de confusion reelle.
    """
    from datetime import datetime as dt
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")
    establishment = db.query(Establishment).filter(Establishment.id == doctor.establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etablissement introuvable")

    try:
        parsed_date = dt.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Date invalide (format attendu: AAAA-MM-JJ)")

    has_availability_configured = db.query(DoctorAvailability).filter(DoctorAvailability.doctor_id == doctor.id).first() is not None

    avg_rating, review_count = _rating_stats(db, doctor.id)
    free_slots = _free_slots_for_doctor(db, doctor, parsed_date, max_slots=200)

    slots = [
        SuggestionSlot(
            doctor_id=doctor.id, doctor_name=doctor.user.full_name,
            establishment_id=establishment.id, establishment_name=establishment.name,
            slot_start=start, slot_end=end, consultation_price=doctor.consultation_price,
            average_rating=avg_rating, review_count=review_count,
        )
        for start, end in free_slots
    ]
    return AvailableSlotsResponse(slots=slots, has_availability_configured=has_availability_configured)


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.PATIENT))):
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_at == payload.scheduled_at,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce creneau vient d'etre pris. Merci de choisir un autre creneau suggere.",
        )

    appointment = Appointment(
        id=str(uuid.uuid4()),
        establishment_id=doctor.establishment_id,
        doctor_id=doctor.id,
        patient_id=patient.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
    )
    db.add(appointment)
    db.add(AuditLog(user_id=current_user.id, establishment_id=doctor.establishment_id,
                     action="create_appointment", details=f"RDV cree pour patient {patient.dossier_number}"))
    db.commit()
    db.refresh(appointment)

    # NOUVEAU: confirmation reelle par email/SMS - ces fonctions existaient
    # deja mais n'etaient appelees NULLE PART dans tout le projet jusqu'ici
    # (lacune decouverte en verifiant, pas juste supposee). Best-effort:
    # une erreur d'envoi (SMTP/Twilio non configures, reseau...) ne doit
    # JAMAIS faire echouer la reservation elle-meme, deja validee en base.
    confirmation_text = (
        f"Rendez-vous confirme avec {doctor.user.full_name} "
        f"le {appointment.scheduled_at.strftime('%d/%m/%Y a %H:%M')}."
    )
    try:
        send_confirmation_email(current_user.email, "Rendez-vous confirme", confirmation_text)
    except Exception:
        pass
    if current_user.phone:
        try:
            send_sms(current_user.phone, confirmation_text)
        except Exception:
            pass

    return _to_appointment_out(appointment)


@router.post("/book-for-patient", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment_for_patient(payload: AppointmentBookForPatient, db: Session = Depends(get_db),
                                  current_user: User = Depends(require_roles(
                                      UserRole.RECEPTIONIST, UserRole.SECRETARY, UserRole.ESTABLISHMENT_ADMIN))):
    """
    NOUVEAU (demande M. Faustin): meme scenario que le patient qui choisit
    lui-meme son medecin avant de trouver un etablissement, mais cote
    reception - "de quoi souffre le patient" (specialite) determine vers
    quel medecin le rediriger, exactement comme /appointments (POST) mais
    pour un patient PRESENT PHYSIQUEMENT plutot que connecte lui-meme.
    """
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_at == payload.scheduled_at,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce creneau vient d'etre pris. Merci de choisir un autre creneau suggere.",
        )

    appointment = Appointment(
        id=str(uuid.uuid4()),
        establishment_id=doctor.establishment_id,
        doctor_id=doctor.id,
        patient_id=patient.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
    )
    db.add(appointment)
    db.add(AuditLog(user_id=current_user.id, establishment_id=doctor.establishment_id,
                     action="book_appointment_for_patient", details=f"RDV cree par le personnel pour patient {patient.dossier_number}"))
    db.commit()
    db.refresh(appointment)

    # NOUVEAU: la confirmation part au VRAI patient (pas au personnel qui
    # a fait la reservation) - meme logique best-effort que create_appointment.
    confirmation_text = (
        f"Rendez-vous confirme avec {doctor.user.full_name} "
        f"le {appointment.scheduled_at.strftime('%d/%m/%Y a %H:%M')}."
    )
    patient_user = patient.user
    try:
        send_confirmation_email(patient_user.email, "Rendez-vous confirme", confirmation_text)
    except Exception:
        pass
    if patient_user.phone:
        try:
            send_sms(patient_user.phone, confirmation_text)
        except Exception:
            pass

    return _to_appointment_out(appointment)
def my_appointments(db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    appointments = db.query(Appointment).filter(Appointment.patient_id == patient.id).order_by(Appointment.scheduled_at.desc()).all()
    return [_to_appointment_out(a) for a in appointments]


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")

    if current_user.role == UserRole.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or appointment.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    elif current_user.role in (UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR):
        if appointment.establishment_id != current_user.establishment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    appointment.status = AppointmentStatus.CANCELLED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="cancel_appointment", details=f"RDV {appointment.id} annule"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.post("/{appointment_id}/arrive", response_model=AppointmentOut)
def mark_arrived(appointment_id: str, db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(
                      UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR,
                      UserRole.NURSE, UserRole.RECEPTIONIST))):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seul un rendez-vous confirme peut etre marque arrive")

    appointment.status = AppointmentStatus.ARRIVED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="mark_arrived", details=f"RDV {appointment.id} marque arrive"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(appointment_id: str, payload: AppointmentReschedule, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    if appointment.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce rendez-vous ne peut plus etre reporte")

    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_at == payload.new_scheduled_at,
            Appointment.id != appointment.id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Le medecin a deja un rendez-vous a ce nouveau creneau")

    old_time = appointment.scheduled_at
    appointment.scheduled_at = payload.new_scheduled_at
    appointment.status = AppointmentStatus.CONFIRMED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="reschedule_appointment",
                     details=f"RDV {appointment.id} reporte de {old_time} a {payload.new_scheduled_at}"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.post("/{appointment_id}/complete", response_model=AppointmentOut)
def complete_appointment(appointment_id: str, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(
                              UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    if appointment.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seul un rendez-vous confirme ou arrive peut etre marque termine")

    appointment.status = AppointmentStatus.COMPLETED
    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="complete_appointment", details=f"RDV {appointment.id} marque termine"))
    db.commit()
    db.refresh(appointment)
    return _to_appointment_out(appointment)


@router.get("/establishment", response_model=list[AppointmentOut])
def establishment_appointments(include_completed: bool = False, db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR,
                                    # CORRIGE (meme categorie de bug que auth.py::STAFF_ROLES): ces 2
                                    # roles ajoutes en Phase A n'avaient jamais ete ajoutes ici -
                                    # l'infirmier et le receptionniste ne pouvaient meme pas VOIR
                                    # la liste des rendez-vous, encore moins prendre des constantes.
                                    UserRole.NURSE, UserRole.RECEPTIONIST))):
    query = db.query(Appointment).filter(Appointment.establishment_id == current_user.establishment_id)
    if current_user.role == UserRole.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doctor:
            query = query.filter(Appointment.doctor_id == doctor.id)
        # NOUVEAU (demande M. Faustin): une fois termine, un rendez-vous
        # quitte la liste "Mes rendez-vous" du medecin par defaut - le
        # patient et son historique se retrouvent desormais dans l'onglet
        # "Mes patients" (voir doctors.py::my_patients). L'admin/secretariat
        # continue de tout voir (utile pour le suivi/la facturation).
        if not include_completed:
            query = query.filter(Appointment.status != AppointmentStatus.COMPLETED)
    appointments = query.order_by(Appointment.scheduled_at.asc()).all()
    return [_to_appointment_out(a) for a in appointments]


@router.post("/{appointment_id}/vitals", response_model=VitalSignsOut, status_code=status.HTTP_201_CREATED)
def record_appointment_vitals(appointment_id: str, payload: VitalSignsCreate, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(
                                   UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.DOCTOR))):
    """
    NOUVEAU (demande M. Faustin, clarifiee en echange): les constantes
    (poids, temperature, tension) d'une simple consultation externe
    n'avaient jusqu'ici aucun endroit ou exister - seule l'hospitalisation
    en avait un (voir admissions.py::record_vitals). Ouvert a 3 roles a
    dessein: selon l'etablissement, c'est parfois l'infirmier(e), parfois
    le/la receptionniste (les deux fonctions sont parfois tenues par la
    meme personne dans une petite structure), et le medecin doit pouvoir
    les saisir lui-meme si personne ne l'a fait avant la consultation.
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    vitals = VitalSigns(
        id=str(uuid.uuid4()), appointment_id=appointment.id, recorded_by_user_id=current_user.id,
        weight_kg=payload.weight_kg, temperature_celsius=payload.temperature_celsius, blood_pressure=payload.blood_pressure,
        pulse_bpm=payload.pulse_bpm, respiratory_rate=payload.respiratory_rate, notes=payload.notes,
    )
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return VitalSignsOut(
        id=vitals.id, recorded_by_name=current_user.full_name, recorded_at=vitals.recorded_at,
        weight_kg=vitals.weight_kg, temperature_celsius=vitals.temperature_celsius, blood_pressure=vitals.blood_pressure,
        pulse_bpm=vitals.pulse_bpm, respiratory_rate=vitals.respiratory_rate, notes=vitals.notes,
    )


@router.get("/{appointment_id}/vitals", response_model=list[VitalSignsOut])
def list_appointment_vitals(appointment_id: str, db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles(
                                 UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.DOCTOR,
                                 UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY))):
    """Le medecin consulte ceci au moment de la consultation - les
    constantes prises avant qu'il ne recoive le patient."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    vitals_list = (
        db.query(VitalSigns)
        .filter(VitalSigns.appointment_id == appointment_id)
        .order_by(VitalSigns.recorded_at.desc())
        .all()
    )
    return [
        VitalSignsOut(
            id=v.id, recorded_by_name=v.recorded_by.full_name if v.recorded_by else "Inconnu",
            recorded_at=v.recorded_at, weight_kg=v.weight_kg, temperature_celsius=v.temperature_celsius,
            blood_pressure=v.blood_pressure, pulse_bpm=v.pulse_bpm, respiratory_rate=v.respiratory_rate, notes=v.notes,
        ) for v in vitals_list
    ]

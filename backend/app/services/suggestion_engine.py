"""
Moteur de suggestion automatique de rendez-vous (section 6 du cahier des charges).

Logique:
1. Le patient cherche (specialite, ville, date/heure preferees).
2. Verification disponibilite en temps reel.
3. Si un creneau exact a l'heure demandee existe dans la ville du patient -> match exact.
4. Sinon -> suggestions triees en deux temps:
   a. d'abord par DISTANCE reelle (km) entre la ville du patient et
      l'etablissement du medecin,
   b. puis par proximite avec l'heure demandee, a distance egale.
5. Le patient choisit et confirme en un clic.

Chaque suggestion inclut maintenant la note moyenne du medecin (module
Notes/avis) pour aider le patient a choisir entre plusieurs options proches.
"""
from datetime import datetime, timedelta, date, time
from typing import Optional

from sqlalchemy import func, or_
from app.specialties import specialty_variants
from sqlalchemy.orm import Session

from app.models import Doctor, DoctorAvailability, DoctorAbsence, Appointment, Establishment, AppointmentStatus, DoctorReview, Shift
from app.schemas import SuggestionSlot
from app.services.geo import haversine_km, resolve_city_coordinates

LOCAL_RADIUS_KM = 15.0


def _is_doctor_absent(db: Session, doctor_id: str, target_date: date) -> bool:
    absence = (
        db.query(DoctorAbsence)
        .filter(
            DoctorAbsence.doctor_id == doctor_id,
            DoctorAbsence.start_date <= target_date,
            DoctorAbsence.end_date >= target_date,
        )
        .first()
    )
    return absence is not None


def _free_slots_for_doctor(db: Session, doctor: Doctor, target_date: date, max_slots: int = 40) -> list[tuple[datetime, datetime]]:
    if _is_doctor_absent(db, doctor.id, target_date):
        return []

    # CORRIGE (racine du probleme repete plusieurs fois par M. Faustin
    # sans jamais etre visible: "la programmation [des gardes] doit
    # pouvoir se faire sur une periode de 1 mois pour permettre aux
    # patients de prendre des RDV selon la garde des medecins" - les
    # gardes (Shift) etaient entierement DECONNECTEES de ce calcul, qui
    # ne lisait QUE l'horaire hebdomadaire recurrent (DoctorAvailability).
    # Programmer une garde ne changeait donc RIEN a ce qu'un patient
    # pouvait reserver - exactement ce qu'il signalait. Priorite a la
    # garde du jour precis si elle existe, sinon repli sur l'horaire
    # hebdomadaire recurrent (compatibilite avec les medecins qui n'ont
    # pas encore adopte les gardes).
    doctor_shifts = (
        db.query(Shift)
        .filter(Shift.user_id == doctor.user_id, Shift.shift_date == target_date)
        .all()
    )

    default_slot_minutes = (
        db.query(DoctorAvailability.slot_duration_minutes)
        .filter(DoctorAvailability.doctor_id == doctor.id)
        .first()
    )
    slot_duration_minutes = default_slot_minutes[0] if default_slot_minutes else 30

    if doctor_shifts:
        windows = [(s.start_time, s.end_time, slot_duration_minutes) for s in doctor_shifts]
    else:
        day_of_week = target_date.weekday()
        availabilities = (
            db.query(DoctorAvailability)
            .filter(DoctorAvailability.doctor_id == doctor.id, DoctorAvailability.day_of_week == day_of_week)
            .all()
        )
        if not availabilities:
            return []
        windows = [(a.start_time, a.end_time, a.slot_duration_minutes) for a in availabilities]

    existing_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.scheduled_at >= datetime.combine(target_date, time.min),
            Appointment.scheduled_at < datetime.combine(target_date, time.max),
        )
        .all()
    )
    busy_ranges = [
        (a.scheduled_at, a.scheduled_at + timedelta(minutes=a.duration_minutes))
        for a in existing_appointments
    ]

    free_slots = []
    for win_start, win_end, win_slot_minutes in windows:
        cursor = datetime.combine(target_date, win_start)
        end_of_window = datetime.combine(target_date, win_end)
        step = timedelta(minutes=win_slot_minutes)

        while cursor + step <= end_of_window and len(free_slots) < max_slots:
            slot_end = cursor + step
            overlaps = any(cursor < busy_end and slot_end > busy_start for busy_start, busy_end in busy_ranges)
            if not overlaps and cursor > datetime.utcnow():
                free_slots.append((cursor, slot_end))
            cursor += step

    return free_slots


def _time_distance_minutes(slot_start: datetime, preferred_time: Optional[time]) -> int:
    if preferred_time is None:
        return int(slot_start.timestamp() // 60)
    slot_minutes = slot_start.hour * 60 + slot_start.minute
    preferred_minutes = preferred_time.hour * 60 + preferred_time.minute
    return abs(slot_minutes - preferred_minutes)


def _rating_stats(db: Session, doctor_id: str) -> tuple[Optional[float], int]:
    avg_rating, count = (
        db.query(func.avg(DoctorReview.rating), func.count(DoctorReview.id))
        .filter(DoctorReview.doctor_id == doctor_id)
        .first()
    )
    return (round(avg_rating, 1) if avg_rating is not None else None), (count or 0)


def find_appointment_or_suggest(
    db: Session,
    specialty: str,
    preferred_date: date,
    preferred_time: Optional[time],
    city: Optional[str],
    establishment_id: Optional[str] = None,
    requested_doctor_id: Optional[str] = None,
    max_suggestions: int = 6,
) -> tuple[bool, list[SuggestionSlot]]:
    reference_coords = None
    if establishment_id:
        ref_establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
        if ref_establishment and ref_establishment.latitude is not None and ref_establishment.longitude is not None:
            reference_coords = (ref_establishment.latitude, ref_establishment.longitude)
    if reference_coords is None and city:
        reference_coords = resolve_city_coordinates(city)

    base_query = db.query(Doctor).join(Establishment).filter(
        or_(*[Doctor.specialty.ilike(v) for v in specialty_variants(specialty)]),
        Doctor.is_active == True,
        Establishment.is_active == True,
    )
    if requested_doctor_id:
        base_query = base_query.filter(Doctor.id == requested_doctor_id)

    candidates = base_query.all()

    slots: list[SuggestionSlot] = []
    distances: dict[str, Optional[float]] = {}

    for doctor in candidates:
        establishment = db.query(Establishment).filter(Establishment.id == doctor.establishment_id).first()
        if not establishment:
            continue

        distance_km = None
        if reference_coords and establishment.latitude is not None and establishment.longitude is not None:
            distance_km = haversine_km(
                reference_coords[0], reference_coords[1],
                establishment.latitude, establishment.longitude,
            )
        distances[doctor.id] = distance_km

        avg_rating, review_count = _rating_stats(db, doctor.id)

        for start, end in _free_slots_for_doctor(db, doctor, preferred_date):
            slots.append(SuggestionSlot(
                doctor_id=doctor.id, doctor_name=doctor.user.full_name,
                establishment_id=establishment.id, establishment_name=establishment.name,
                slot_start=start, slot_end=end, consultation_price=doctor.consultation_price,
                average_rating=avg_rating, review_count=review_count,
            ))

    exact_match_available = False
    if preferred_time is not None:
        for s in slots:
            if s.slot_start.time() != preferred_time:
                continue
            d = distances.get(s.doctor_id)
            if d is None or d <= LOCAL_RADIUS_KM:
                exact_match_available = True
                break

    def sort_key(s: SuggestionSlot):
        d = distances.get(s.doctor_id)
        distance_rank = d if d is not None else float("inf")
        return (distance_rank, _time_distance_minutes(s.slot_start, preferred_time), s.slot_start)

    slots.sort(key=sort_key)

    return exact_match_available, slots[:max_suggestions]

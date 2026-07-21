"""
Moteur de suggestion automatique de rendez-vous (section 6 du cahier des charges).

Logique:
1. Le patient cherche (specialite, ville, date/heure preferees).
2. Verification disponibilite en temps reel.
3. Si un creneau exact a l'heure demandee existe dans la ville du patient -> match exact.
4. Sinon -> suggestions triees en deux temps:
   a. d'abord par DISTANCE reelle (km) entre la ville du patient et
      l'etablissement du medecin (les etablissements les plus proches
      d'abord, pas seulement "meme ville" ou "n'importe quelle autre ville"),
   b. puis par proximite avec l'heure demandee, a distance egale.
5. Le patient choisit et confirme en un clic.

CORRECTIFS successifs (retours utilisateur):
- la comparaison de ville est insensible a la casse,
- les creneaux sont tries par proximite avec l'heure demandee (pas juste
  les premiers de la journee),
- les etablissements d'autres villes sont maintenant classes par distance
  reelle (km) plutot que dans un ordre arbitraire.

Hypothese: la distance est calculee a vol d'oiseau (haversine) entre la
position (approximative ou exacte) de la ville/etablissement du patient et
celle de chaque etablissement candidat. Voir app/services/geo.py pour le
detail et ses limites (positions de ville approximatives par defaut).
"""
from datetime import datetime, timedelta, date, time
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Doctor, DoctorAvailability, DoctorAbsence, Appointment, Establishment, AppointmentStatus
from app.schemas import SuggestionSlot
from app.services.geo import haversine_km, resolve_city_coordinates

# Rayon (km) en-deca duquel un etablissement est considere "dans la meme
# zone" que la ville recherchee - sert uniquement a decider du match exact
# (etape 3), pas a exclure des suggestions (toutes les distances sont
# proposees, juste triees de la plus proche a la plus eloignee).
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
    """Calcule TOUS les creneaux libres d'un medecin pour une date donnee (le tri se fait ensuite par l'appelant)."""
    if _is_doctor_absent(db, doctor.id, target_date):
        return []

    day_of_week = target_date.weekday()  # 0=lundi
    availabilities = (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.doctor_id == doctor.id, DoctorAvailability.day_of_week == day_of_week)
        .all()
    )
    if not availabilities:
        return []

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
    for avail in availabilities:
        cursor = datetime.combine(target_date, avail.start_time)
        end_of_window = datetime.combine(target_date, avail.end_time)
        step = timedelta(minutes=avail.slot_duration_minutes)

        while cursor + step <= end_of_window and len(free_slots) < max_slots:
            slot_end = cursor + step
            overlaps = any(cursor < busy_end and slot_end > busy_start for busy_start, busy_end in busy_ranges)
            if not overlaps and cursor > datetime.utcnow():
                free_slots.append((cursor, slot_end))
            cursor += step

    return free_slots


def _time_distance_minutes(slot_start: datetime, preferred_time: Optional[time]) -> int:
    """Distance en minutes entre un creneau et l'heure preferee (tri chronologique si aucune heure preferee)."""
    if preferred_time is None:
        return int(slot_start.timestamp() // 60)
    slot_minutes = slot_start.hour * 60 + slot_start.minute
    preferred_minutes = preferred_time.hour * 60 + preferred_time.minute
    return abs(slot_minutes - preferred_minutes)


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
    """
    Retourne (exact_match_available, suggestions), triees d'abord par
    distance geographique reelle (km) par rapport a la ville/etablissement
    du patient, puis par proximite avec l'heure demandee.
    """
    # Position de reference du patient: priorite a l'etablissement precis
    # s'il est fourni (flux de reservation direct), sinon la ville tapee.
    reference_coords = None
    if establishment_id:
        ref_establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
        if ref_establishment and ref_establishment.latitude is not None and ref_establishment.longitude is not None:
            reference_coords = (ref_establishment.latitude, ref_establishment.longitude)
    if reference_coords is None and city:
        reference_coords = resolve_city_coordinates(city)

    base_query = db.query(Doctor).join(Establishment).filter(
        Doctor.specialty.ilike(specialty),
        Doctor.is_active == True,
        Establishment.is_active == True,
    )
    if requested_doctor_id:
        base_query = base_query.filter(Doctor.id == requested_doctor_id)

    candidates = base_query.all()

    # Rassemble tous les creneaux avec, pour chacun, la distance reelle (km)
    # a la position de reference (None si l'un des deux points est inconnu -
    # dans ce cas la distance ne departagera pas le tri, seul le temps comptera).
    slots: list[SuggestionSlot] = []
    distances: dict[str, Optional[float]] = {}  # doctor_id -> distance_km

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

        for start, end in _free_slots_for_doctor(db, doctor, preferred_date):
            slots.append(SuggestionSlot(
                doctor_id=doctor.id, doctor_name=doctor.user.full_name,
                establishment_id=establishment.id, establishment_name=establishment.name,
                slot_start=start, slot_end=end, consultation_price=doctor.consultation_price,
            ))

    # Etape 3: creneau exact disponible a l'heure demandee, dans la zone locale
    # (meme ville / rayon proche) - c'est ca qui declenche une "confirmation
    # immediate" plutot qu'une simple suggestion.
    exact_match_available = False
    if preferred_time is not None:
        for s in slots:
            if s.slot_start.time() != preferred_time:
                continue
            d = distances.get(s.doctor_id)
            if d is None or d <= LOCAL_RADIUS_KM:
                exact_match_available = True
                break

    # Tri: distance croissante en priorite (None traite comme "distance
    # inconnue", place apres les distances connues mais sans favoriser ou
    # penaliser injustement), puis proximite avec l'heure demandee.
    def sort_key(s: SuggestionSlot):
        d = distances.get(s.doctor_id)
        distance_rank = d if d is not None else float("inf")
        return (distance_rank, _time_distance_minutes(s.slot_start, preferred_time), s.slot_start)

    slots.sort(key=sort_key)

    return exact_match_available, slots[:max_suggestions]

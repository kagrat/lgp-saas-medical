"""
Module 4 - Gestion des medecins + Notes/avis + page profil public (nouveau).
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Doctor, User, UserRole, DoctorAvailability, DoctorAbsence, Establishment,
    DoctorReview, Patient, Appointment, AppointmentStatus, MedicalDocument, PatientRecordShare, ClinicalFlag,
)
from app.schemas import (
    DoctorCreate, DoctorOut, DoctorAvailabilityCreate, DoctorAbsenceCreate, DoctorAbsenceOut,
    DoctorAvailabilityOut, DoctorReviewCreate, DoctorReviewOut, DoctorDetailOut,
    DoctorPatientOut, DoctorPatientDetailOut, DoctorPatientAppointmentOut,
    PatientRecordShareCreate, PatientRecordShareOut, MedicalDocumentOut,
    ClinicalFlagCreate, ClinicalFlagOut,
)
from app.deps import require_roles, get_current_user
from app.routers.notifications import create_dossier_share_notification
from app.security import hash_password
from app.routers.health_records import _to_document_out

router = APIRouter(prefix="/doctors", tags=["medecins"])


@router.get("/me", response_model=DoctorOut)
def get_my_doctor_profile(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    """
    NOUVEAU (demande M. Faustin: brancher les fonctionnalites deja
    construites cote serveur mais jamais utilisees). Le medecin a
    toujours eu le droit cote serveur de gerer sa PROPRE disponibilite
    et ses absences (meme regle que l'admin d'etablissement), mais son
    interface ne connaissait jamais son propre doctor_id pour appeler
    ces endpoints - seul l'admin y avait acces en pratique.
    """
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil medecin introuvable")
    avg_rating, review_count = _rating_stats(db, doctor.id)
    return DoctorOut(
        id=doctor.id, full_name=current_user.full_name, phone=current_user.phone,
        specialty=doctor.specialty, consultation_price=doctor.consultation_price,
        bio=doctor.bio, photo_url=doctor.photo_url, establishment_id=doctor.establishment_id,
        is_active=doctor.is_active, average_rating=avg_rating, review_count=review_count,
    )


def _rating_stats(db: Session, doctor_id: str) -> tuple[Optional[float], int]:
    avg_rating, count = (
        db.query(func.avg(DoctorReview.rating), func.count(DoctorReview.id))
        .filter(DoctorReview.doctor_id == doctor_id)
        .first()
    )
    return (round(avg_rating, 1) if avg_rating is not None else None), (count or 0)


def _to_doctor_out(db: Session, doctor: Doctor) -> DoctorOut:
    avg_rating, review_count = _rating_stats(db, doctor.id)
    return DoctorOut(
        id=doctor.id, full_name=doctor.user.full_name, phone=doctor.user.phone, specialty=doctor.specialty,
        consultation_price=doctor.consultation_price, bio=doctor.bio, photo_url=doctor.photo_url,
        establishment_id=doctor.establishment_id, is_active=doctor.is_active,
        average_rating=avg_rating, review_count=review_count,
    )


@router.post("", response_model=DoctorOut, status_code=status.HTTP_201_CREATED)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est deja utilise")

    user = User(
        id=str(uuid.uuid4()),
        establishment_id=current_user.establishment_id,
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.DOCTOR,
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        id=str(uuid.uuid4()),
        user_id=user.id,
        establishment_id=current_user.establishment_id,
        specialty=payload.specialty,
        consultation_price=payload.consultation_price,
        bio=payload.bio,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return _to_doctor_out(db, doctor)


@router.get("/search", response_model=list[DoctorOut])
def search_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    establishment_id: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Doctor).join(Establishment).filter(Doctor.is_active == True, Establishment.is_active == True)
    if specialty:
        query = query.filter(Doctor.specialty.ilike(f"%{specialty}%"))
    if city:
        query = query.filter(Establishment.city.ilike(f"%{city}%"))
    if establishment_id:
        query = query.filter(Doctor.establishment_id == establishment_id)
    if name:
        query = query.join(User, User.id == Doctor.user_id).filter(User.full_name.ilike(f"%{name}%"))

    return [_to_doctor_out(db, doctor) for doctor in query.limit(50).all()]


@router.get("/{doctor_id}/profile", response_model=DoctorDetailOut)
def doctor_public_profile(doctor_id: str, db: Session = Depends(get_db)):
    """NOUVEAU: fiche publique complete d'un medecin (page profil patient)."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    establishment = db.query(Establishment).filter(Establishment.id == doctor.establishment_id).first()
    avg_rating, review_count = _rating_stats(db, doctor.id)

    return DoctorDetailOut(
        id=doctor.id, full_name=doctor.user.full_name, phone=doctor.user.phone, specialty=doctor.specialty,
        consultation_price=doctor.consultation_price, bio=doctor.bio, photo_url=doctor.photo_url,
        establishment_id=doctor.establishment_id, is_active=doctor.is_active,
        average_rating=avg_rating, review_count=review_count,
        establishment_name=establishment.name if establishment else "Inconnu",
        establishment_city=establishment.city if establishment else "",
        establishment_address=establishment.address if establishment else None,
    )


@router.get("/establishment", response_model=list[DoctorOut])
def list_establishment_doctors(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY))):
    doctors = db.query(Doctor).filter(Doctor.establishment_id == current_user.establishment_id).all()
    return [_to_doctor_out(db, d) for d in doctors]


@router.post("/{doctor_id}/availabilities", status_code=status.HTTP_201_CREATED)
def add_availability(doctor_id: str, payload: DoctorAvailabilityCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    availability = DoctorAvailability(
        id=str(uuid.uuid4()), doctor_id=doctor.id,
        day_of_week=payload.day_of_week, start_time=payload.start_time,
        end_time=payload.end_time, slot_duration_minutes=payload.slot_duration_minutes,
    )
    db.add(availability)
    db.commit()
    return {"message": "Disponibilite ajoutee"}


@router.get("/{doctor_id}/availabilities", response_model=list[DoctorAvailabilityOut])
def list_availabilities(doctor_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    return (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.doctor_id == doctor.id)
        .order_by(DoctorAvailability.day_of_week, DoctorAvailability.start_time)
        .all()
    )


@router.delete("/{doctor_id}/availabilities/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(doctor_id: str, availability_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    availability = (
        db.query(DoctorAvailability)
        .filter(DoctorAvailability.id == availability_id, DoctorAvailability.doctor_id == doctor.id)
        .first()
    )
    if not availability:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disponibilite introuvable")
    db.delete(availability)
    db.commit()


@router.post("/{doctor_id}/absences", status_code=status.HTTP_201_CREATED)
def add_absence(doctor_id: str, payload: DoctorAbsenceCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    absence = DoctorAbsence(
        id=str(uuid.uuid4()), doctor_id=doctor.id,
        start_date=payload.start_date, end_date=payload.end_date, reason=payload.reason,
    )
    db.add(absence)
    db.commit()
    return {"message": "Absence enregistree"}


@router.get("/{doctor_id}/absences", response_model=list[DoctorAbsenceOut])
def list_absences(doctor_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    """NOUVEAU: manquait avant - on pouvait creer une absence mais jamais
    la revoir, contrairement aux disponibilites (meme regle d'acces,
    memes 3 actions: ajouter/lister/retirer)."""
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    absences = db.query(DoctorAbsence).filter(DoctorAbsence.doctor_id == doctor.id).order_by(DoctorAbsence.start_date.desc()).all()
    return absences


@router.delete("/{doctor_id}/absences/{absence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_absence(doctor_id: str, absence_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    doctor = _get_doctor_in_scope(db, doctor_id, current_user)
    absence = db.query(DoctorAbsence).filter(DoctorAbsence.id == absence_id, DoctorAbsence.doctor_id == doctor.id).first()
    if not absence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Absence introuvable")
    db.delete(absence)
    db.commit()


@router.post("/{doctor_id}/reviews", response_model=DoctorReviewOut, status_code=status.HTTP_201_CREATED)
def create_or_update_review(doctor_id: str, payload: DoctorReviewCreate, db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles(UserRole.PATIENT))):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    has_completed_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.patient_id == patient.id,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
        .first()
    )
    if not has_completed_appointment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu ne peux laisser un avis qu'apres un rendez-vous termine avec ce medecin.",
        )

    existing_review = (
        db.query(DoctorReview)
        .filter(DoctorReview.doctor_id == doctor_id, DoctorReview.patient_id == patient.id)
        .first()
    )
    if existing_review:
        existing_review.rating = payload.rating
        existing_review.comment = payload.comment
        db.commit()
        db.refresh(existing_review)
        review = existing_review
    else:
        review = DoctorReview(
            id=str(uuid.uuid4()), doctor_id=doctor_id, patient_id=patient.id,
            rating=payload.rating, comment=payload.comment,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    return DoctorReviewOut(
        id=review.id, doctor_id=review.doctor_id, patient_id=review.patient_id,
        patient_name=current_user.full_name, rating=review.rating,
        comment=review.comment, created_at=review.created_at,
    )


@router.get("/{doctor_id}/reviews", response_model=list[DoctorReviewOut])
def list_reviews(doctor_id: str, db: Session = Depends(get_db)):
    reviews = (
        db.query(DoctorReview)
        .filter(DoctorReview.doctor_id == doctor_id)
        .order_by(DoctorReview.created_at.desc())
        .all()
    )
    return [
        DoctorReviewOut(
            id=r.id, doctor_id=r.doctor_id, patient_id=r.patient_id,
            patient_name=r.patient.user.full_name, rating=r.rating,
            comment=r.comment, created_at=r.created_at,
        )
        for r in reviews
    ]


@router.get("/reviewable")
def list_reviewable_appointments(db: Session = Depends(get_db),
                                  current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []

    completed_doctor_ids = (
        db.query(Appointment.doctor_id)
        .filter(Appointment.patient_id == patient.id, Appointment.status == AppointmentStatus.COMPLETED)
        .distinct()
        .all()
    )
    results = []
    for (doctor_id,) in completed_doctor_ids:
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if not doctor:
            continue
        existing_review = (
            db.query(DoctorReview)
            .filter(DoctorReview.doctor_id == doctor_id, DoctorReview.patient_id == patient.id)
            .first()
        )
        results.append({
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.full_name,
            "specialty": doctor.specialty,
            "existing_rating": existing_review.rating if existing_review else None,
            "existing_comment": existing_review.comment if existing_review else None,
        })
    return results


def _get_doctor_in_scope(db: Session, doctor_id: str, current_user: User) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin introuvable")
    if doctor.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a ce medecin")
    return doctor


def _current_doctor(db: Session, current_user: User) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil medecin introuvable")
    return doctor


# ---------- MES PATIENTS (nouveau, demande M. Faustin) ----------
# Distinct du repertoire etablissement (patients.py::establishment_patient_directory,
# qui montre TOUS les patients de l'etablissement pour l'admin/secretariat):
# ici, uniquement les patients que CE medecin a personnellement consultes
# (rendez-vous termine), avec la possibilite de completer leur dossier.

@router.get("/me/patients", response_model=list[DoctorPatientOut])
def my_patients(search: Optional[str] = None, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    doctor = _current_doctor(db, current_user)

    completed = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id, Appointment.status == AppointmentStatus.COMPLETED)
        .all()
    )
    by_patient: dict[str, list[Appointment]] = {}
    for appt in completed:
        by_patient.setdefault(appt.patient_id, []).append(appt)

    results = []
    for patient_id, appts in by_patient.items():
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            continue
        if search and search.strip() and search.strip().lower() not in patient.user.full_name.lower():
            continue
        last_visit = max(a.scheduled_at for a in appts)
        results.append(DoctorPatientOut(
            id=patient.id, full_name=patient.user.full_name, dossier_number=patient.dossier_number,
            last_visit=last_visit, visits_count=len(appts),
        ))

    results.sort(key=lambda p: p.last_visit or datetime.min, reverse=True)
    return results


@router.get("/me/patients/{patient_id}", response_model=DoctorPatientDetailOut)
def my_patient_detail(patient_id: str, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    doctor = _current_doctor(db, current_user)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    own_appointments = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id, Appointment.patient_id == patient_id,
                Appointment.status == AppointmentStatus.COMPLETED)
        .order_by(Appointment.scheduled_at.desc())
        .all()
    )

    viewed_via_share_from = None
    if own_appointments:
        source_appointments = own_appointments
        can_add_document = True
    else:
        # Pas son propre patient: n'autorise la consultation que si un
        # confrere lui a explicitement partage ce dossier (lecture seule -
        # completer le dossier reste reserve au medecin traitant, voir
        # MedicalDocument et son principe de tracabilite par rendez-vous).
        share = (
            db.query(PatientRecordShare)
            .filter(PatientRecordShare.to_doctor_id == doctor.id, PatientRecordShare.patient_id == patient_id)
            .order_by(PatientRecordShare.created_at.desc())
            .first()
        )
        if not share:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ce patient ne fait pas partie de tes patients")
        source_appointments = (
            db.query(Appointment)
            .filter(Appointment.doctor_id == share.from_doctor_id, Appointment.patient_id == patient_id,
                    Appointment.status == AppointmentStatus.COMPLETED)
            .order_by(Appointment.scheduled_at.desc())
            .all()
        )
        can_add_document = False
        viewed_via_share_from = share.from_doctor.user.full_name

    appointment_ids = [a.id for a in source_appointments]
    documents = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.appointment_id.in_(appointment_ids))
        .order_by(MedicalDocument.created_at.desc())
        .all() if appointment_ids else []
    )

    # NOUVEAU (demande M. Faustin: elements cliniques). Visibles quel que
    # soit le mode d'acces (patient traite ou dossier partage) - seule
    # l'AJOUT/RETRAIT reste reserve au medecin traitant (can_add_document),
    # meme regle que pour les documents.
    clinical_flags = (
        db.query(ClinicalFlag)
        .filter(ClinicalFlag.patient_id == patient_id)
        .order_by(ClinicalFlag.created_at.desc())
        .all()
    )

    return DoctorPatientDetailOut(
        id=patient.id, full_name=patient.user.full_name, dossier_number=patient.dossier_number,
        phone=patient.user.phone, date_of_birth=patient.date_of_birth,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_relation=patient.emergency_contact_relation,
        emergency_contact_phone=patient.emergency_contact_phone,
        appointments=[DoctorPatientAppointmentOut(id=a.id, scheduled_at=a.scheduled_at) for a in source_appointments],
        documents=[_to_document_out(d) for d in documents],
        clinical_flags=[ClinicalFlagOut(id=f.id, flag_type=f.flag_type, label=f.label, created_at=f.created_at) for f in clinical_flags],
        can_add_document=can_add_document,
        viewed_via_share_from=viewed_via_share_from,
    )


@router.post("/patients/{patient_id}/clinical-flags", response_model=ClinicalFlagOut, status_code=status.HTTP_201_CREATED)
def add_clinical_flag(patient_id: str, payload: ClinicalFlagCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    """NOUVEAU (demande M. Faustin): reserve au medecin TRAITANT (meme
    regle que l'ajout de documents) - un confrere avec un dossier partage
    peut VOIR les elements cliniques mais pas en ajouter."""
    doctor = _current_doctor(db, current_user)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    has_treated = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.id, Appointment.patient_id == patient_id,
        Appointment.status == AppointmentStatus.COMPLETED,
    ).first()
    if not has_treated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ce patient ne fait pas partie de tes patients")

    flag = ClinicalFlag(
        id=str(uuid.uuid4()), patient_id=patient_id, flag_type=payload.flag_type,
        label=payload.label, created_by_user_id=current_user.id,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return ClinicalFlagOut(id=flag.id, flag_type=flag.flag_type, label=flag.label, created_at=flag.created_at)


@router.delete("/patients/{patient_id}/clinical-flags/{flag_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_clinical_flag(patient_id: str, flag_id: str, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    doctor = _current_doctor(db, current_user)
    has_treated = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.id, Appointment.patient_id == patient_id,
        Appointment.status == AppointmentStatus.COMPLETED,
    ).first()
    if not has_treated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ce patient ne fait pas partie de tes patients")

    flag = db.query(ClinicalFlag).filter(ClinicalFlag.id == flag_id, ClinicalFlag.patient_id == patient_id).first()
    if not flag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Element clinique introuvable")
    db.delete(flag)
    db.commit()


# ---------- ENVOYER LE DOSSIER A UN CONFRERE (nouveau, demande M. Faustin) ----------

@router.post("/me/patients/{patient_id}/share", response_model=PatientRecordShareOut, status_code=status.HTTP_201_CREATED)
def share_patient_record(patient_id: str, payload: PatientRecordShareCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    doctor = _current_doctor(db, current_user)

    is_own_patient = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id, Appointment.patient_id == patient_id,
                Appointment.status == AppointmentStatus.COMPLETED)
        .first()
    )
    if not is_own_patient:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu ne peux envoyer que le dossier de tes propres patients")

    to_doctor = db.query(Doctor).filter(Doctor.id == payload.to_doctor_id, Doctor.is_active == True).first()
    if not to_doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medecin destinataire introuvable")
    if to_doctor.id == doctor.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tu ne peux pas t'envoyer un dossier a toi-meme")

    share = PatientRecordShare(
        id=str(uuid.uuid4()), patient_id=patient_id, from_doctor_id=doctor.id,
        to_doctor_id=to_doctor.id, note=payload.note,
    )
    db.add(share)

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    # NOUVEAU (demande explicite de M. Faustin: "si un confrere lui envoi
    # un patient ou un dossier").
    create_dossier_share_notification(db, to_doctor.user_id, to_doctor.establishment_id, current_user.full_name, patient.user.full_name)
    db.commit()
    db.refresh(share)

    return PatientRecordShareOut(
        id=share.id, patient_id=share.patient_id, patient_name=patient.user.full_name,
        from_doctor_id=doctor.id, from_doctor_name=current_user.full_name,
        to_doctor_id=to_doctor.id, note=share.note, created_at=share.created_at,
    )


@router.get("/me/shared-with-me", response_model=list[PatientRecordShareOut])
def shares_received(db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.DOCTOR))):
    doctor = _current_doctor(db, current_user)
    shares = (
        db.query(PatientRecordShare)
        .filter(PatientRecordShare.to_doctor_id == doctor.id)
        .order_by(PatientRecordShare.created_at.desc())
        .all()
    )
    return [
        PatientRecordShareOut(
            id=s.id, patient_id=s.patient_id, patient_name=s.patient.user.full_name,
            from_doctor_id=s.from_doctor_id, from_doctor_name=s.from_doctor.user.full_name,
            to_doctor_id=s.to_doctor_id, note=s.note, created_at=s.created_at,
        )
        for s in shares
    ]

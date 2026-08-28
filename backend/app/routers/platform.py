"""
Module "Tables globales Super Admin" + "Apercu des demandes en attente"
+ "Fiche patient detaillee" (nouveau). Zero risque de schema: lecture
uniquement de tables deja existantes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Appointment, AppointmentStatus, PharmacyReservation, ReservationStatus, PharmacyStock,
    LabTestRequest, LabTestStatus, Doctor, Establishment, EstablishmentType, User, UserRole, Patient,
)
from app.schemas import (
    GlobalAppointmentOut, GlobalOrderOut, GlobalDoctorOut, GlobalEstablishmentSummaryOut,
    PendingOverviewOut, PatientDetailOut,
)
from app.deps import require_roles, require_establishment_types

router = APIRouter(prefix="/platform", tags=["super-admin-tables"])


@router.get("/appointments", response_model=list[GlobalAppointmentOut])
def all_appointments(limit: int = 200, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    limit = max(1, min(limit, 500))
    appointments = db.query(Appointment).order_by(Appointment.scheduled_at.desc()).limit(limit).all()
    return [
        GlobalAppointmentOut(
            id=a.id,
            patient_name=a.patient.user.full_name if a.patient else "Inconnu",
            doctor_name=a.doctor.user.full_name if a.doctor else "Inconnu",
            establishment_name=a.establishment.name if a.establishment else "Inconnu",
            scheduled_at=a.scheduled_at, status=a.status,
        )
        for a in appointments
    ]


@router.get("/orders", response_model=list[GlobalOrderOut])
def all_orders(limit: int = 200, db: Session = Depends(get_db),
               current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    limit = max(1, min(limit, 500))
    orders = db.query(PharmacyReservation).order_by(PharmacyReservation.created_at.desc()).limit(limit).all()
    return [
        GlobalOrderOut(
            id=o.id,
            patient_name=o.patient.user.full_name if o.patient else "Inconnu",
            medication_name=o.medication.medication_name if o.medication else "Inconnu",
            establishment_name=o.establishment.name if o.establishment else "Inconnu",
            quantity=o.quantity, status=o.status, created_at=o.created_at,
        )
        for o in orders
    ]


@router.get("/doctors", response_model=list[GlobalDoctorOut])
def all_doctors(db: Session = Depends(get_db),
                current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    doctors = db.query(Doctor).order_by(Doctor.specialty).all()
    return [
        GlobalDoctorOut(
            id=d.id, full_name=d.user.full_name, specialty=d.specialty,
            establishment_name=d.establishment.name if d.establishment else "Inconnu",
            is_active=d.is_active,
        )
        for d in doctors
    ]


@router.get("/pharmacies", response_model=list[GlobalEstablishmentSummaryOut])
def all_pharmacies(db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    return _establishment_summaries(db, EstablishmentType.PHARMACIE)


@router.get("/laboratories", response_model=list[GlobalEstablishmentSummaryOut])
def all_laboratories(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    return _establishment_summaries(db, EstablishmentType.LABORATOIRE)


def _establishment_summaries(db: Session, est_type: EstablishmentType) -> list[GlobalEstablishmentSummaryOut]:
    establishments = db.query(Establishment).filter(Establishment.type == est_type).order_by(Establishment.name).all()
    results = []
    for e in establishments:
        admin = db.query(User).filter(User.establishment_id == e.id, User.role == UserRole.ESTABLISHMENT_ADMIN).first()
        results.append(GlobalEstablishmentSummaryOut(
            id=e.id, name=e.name, city=e.city, is_active=e.is_active,
            subscription_status=e.subscription_status, admin_email=admin.email if admin else None,
        ))
    return results


@router.get("/pending-overview", response_model=PendingOverviewOut)
def pending_overview(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """NOUVEAU: apercu rapide de ce qui attend une action, a l'echelle de toute la plateforme."""
    pending_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.CONFIRMED).count()
    pending_orders = db.query(PharmacyReservation).filter(PharmacyReservation.status == ReservationStatus.PENDING).count()
    cancelled_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.CANCELLED).count()
    low_stock_items = db.query(PharmacyStock).filter(PharmacyStock.quantity <= PharmacyStock.alert_threshold).count()
    pending_lab_tests = db.query(LabTestRequest).filter(LabTestRequest.status == LabTestStatus.REQUESTED).count()

    return PendingOverviewOut(
        pending_appointments=pending_appointments,
        pending_orders=pending_orders,
        cancelled_appointments=cancelled_appointments,
        low_stock_items=low_stock_items,
        pending_lab_tests=pending_lab_tests,
    )


@router.get("/patients/{patient_id}/detail", response_model=PatientDetailOut,
            dependencies=[Depends(require_establishment_types(EstablishmentType.HOPITAL, EstablishmentType.CLINIQUE))])
def patient_detail(patient_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(
                        UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    """
    NOUVEAU: fiche detaillee d'un patient, limitee a ce qui concerne SON
    etablissement (isolation multi-tenant, meme principe que partout ailleurs).

    CORRIGE (gap decouvert en test): PHARMACIST et LAB_TECHNICIAN pouvaient
    avant voir ici l'historique COMPLET (rendez-vous medicaux + analyses de
    labo) d'un patient des lors qu'il avait ne serait-ce qu'une commande
    pharmacie chez eux - bien plus que necessaire a leur metier. Retire ces
    2 roles et ajoute la meme restriction de type d'etablissement
    (hopital/clinique uniquement) deja appliquee a l'annuaire patient dans
    patients.py.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    establishment_id = current_user.establishment_id

    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id, Appointment.establishment_id == establishment_id)
        .order_by(Appointment.scheduled_at.desc())
        .all()
    )
    orders = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.patient_id == patient_id, PharmacyReservation.establishment_id == establishment_id)
        .order_by(PharmacyReservation.created_at.desc())
        .all()
    )
    lab_tests = (
        db.query(LabTestRequest)
        .filter(LabTestRequest.patient_id == patient_id, LabTestRequest.establishment_id == establishment_id)
        .order_by(LabTestRequest.created_at.desc())
        .all()
    )

    if not appointments and not orders and not lab_tests:
        # Aucune relation avec cet etablissement -> pas d'acces (meme regle que la messagerie).
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucune relation avec ce patient")

    return PatientDetailOut(
        id=patient.id,
        full_name=patient.user.full_name,
        email=patient.user.email,
        phone=patient.user.phone,
        dossier_number=patient.dossier_number,
        appointments=[
            GlobalAppointmentOut(
                id=a.id, patient_name=patient.user.full_name,
                doctor_name=a.doctor.user.full_name if a.doctor else "Inconnu",
                establishment_name=a.establishment.name if a.establishment else "Inconnu",
                scheduled_at=a.scheduled_at, status=a.status,
            )
            for a in appointments
        ],
        orders_count=len(orders),
        lab_tests_count=len(lab_tests),
    )

"""
Module 6 - Tableau de bord (stats etablissement + stats globales super admin).
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    Establishment, Doctor, Appointment, PharmacyStock, User, UserRole, SubscriptionStatus, AppointmentStatus
)
from app.schemas import EstablishmentStatsOut, GlobalStatsOut
from app.deps import require_roles

router = APIRouter(prefix="/dashboard", tags=["tableau-de-bord"])


@router.get("/establishment", response_model=EstablishmentStatsOut)
def establishment_stats(db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    establishment_id = current_user.establishment_id
    now = datetime.utcnow()

    total_appointments = db.query(Appointment).filter(Appointment.establishment_id == establishment_id).count()
    appointments_this_month = (
        db.query(Appointment)
        .filter(
            Appointment.establishment_id == establishment_id,
            Appointment.scheduled_at >= now.replace(day=1, hour=0, minute=0, second=0),
        )
        .count()
    )
    total_doctors = db.query(Doctor).filter(Doctor.establishment_id == establishment_id, Doctor.is_active == True).count()

    revenue = (
        db.query(func.sum(Doctor.consultation_price))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .filter(Appointment.establishment_id == establishment_id, Appointment.status == AppointmentStatus.COMPLETED)
        .scalar()
    ) or 0

    low_stock_items = (
        db.query(PharmacyStock)
        .filter(PharmacyStock.establishment_id == establishment_id, PharmacyStock.quantity <= PharmacyStock.alert_threshold)
        .count()
    )

    return EstablishmentStatsOut(
        total_appointments=total_appointments,
        appointments_this_month=appointments_this_month,
        total_doctors=total_doctors,
        total_revenue_estimated=float(revenue),
        low_stock_items=low_stock_items,
    )


@router.get("/global", response_model=GlobalStatsOut)
def global_stats(db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    """Vision globale reservee au Super Admin (section 4, niveau 1)."""
    total_establishments = db.query(Establishment).count()
    active_establishments = db.query(Establishment).filter(Establishment.is_active == True).count()
    suspended_establishments = db.query(Establishment).filter(
        Establishment.subscription_status == SubscriptionStatus.SUSPENDED
    ).count()
    total_appointments = db.query(Appointment).count()

    revenue = (
        db.query(func.sum(Doctor.consultation_price))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .filter(Appointment.status == AppointmentStatus.COMPLETED)
        .scalar()
    ) or 0

    return GlobalStatsOut(
        total_establishments=total_establishments,
        active_establishments=active_establishments,
        suspended_establishments=suspended_establishments,
        total_appointments=total_appointments,
        total_revenue_estimated=float(revenue),
    )

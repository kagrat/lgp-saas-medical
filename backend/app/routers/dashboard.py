"""
Module 6 - Tableau de bord (stats etablissement + stats globales super admin
+ tendances/graphiques + indicateurs de variation mensuelle).
"""
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    Establishment, Doctor, Appointment, PharmacyStock, User, UserRole, SubscriptionStatus, AppointmentStatus
)
from app.schemas import (
    EstablishmentStatsOut, GlobalStatsOut, GlobalTrendsOut, MonthlyTrendPoint, EstablishmentBreakdownPoint
)
from app.deps import require_roles

router = APIRouter(prefix="/dashboard", tags=["tableau-de-bord"])

MONTH_NAMES_FR = ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"]


def _percent_change(current: float, previous: float) -> float | None:
    """Retourne le pourcentage de variation, ou None si impossible a calculer (pas de donnee du tout avant)."""
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


@router.get("/establishment", response_model=EstablishmentStatsOut)
def establishment_stats(db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    establishment_id = current_user.establishment_id
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_end = this_month_start - timedelta(seconds=1)
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_appointments = db.query(Appointment).filter(Appointment.establishment_id == establishment_id).count()
    appointments_this_month = (
        db.query(Appointment)
        .filter(Appointment.establishment_id == establishment_id, Appointment.scheduled_at >= this_month_start)
        .count()
    )
    appointments_last_month = (
        db.query(Appointment)
        .filter(
            Appointment.establishment_id == establishment_id,
            Appointment.scheduled_at >= last_month_start, Appointment.scheduled_at < this_month_start,
        )
        .count()
    )
    appointments_trend_pct = _percent_change(appointments_this_month, appointments_last_month)

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
        appointments_trend_pct=appointments_trend_pct,
        total_doctors=total_doctors,
        total_revenue_estimated=float(revenue),
        low_stock_items=low_stock_items,
    )


@router.get("/global", response_model=GlobalStatsOut)
def global_stats(db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
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


@router.get("/global/trends", response_model=GlobalTrendsOut)
def global_trends(months: int = 6, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    months = max(1, min(months, 24))
    cutoff = datetime.utcnow() - timedelta(days=31 * months)

    rows = (
        db.query(Appointment.scheduled_at, Doctor.consultation_price, Appointment.establishment_id, Establishment.name)
        .join(Doctor, Appointment.doctor_id == Doctor.id)
        .join(Establishment, Appointment.establishment_id == Establishment.id)
        .filter(Appointment.status == AppointmentStatus.COMPLETED, Appointment.scheduled_at >= cutoff)
        .all()
    )

    monthly = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    by_establishment = defaultdict(lambda: {"name": "", "count": 0, "revenue": 0.0})

    for scheduled_at, price, est_id, est_name in rows:
        key = (scheduled_at.year, scheduled_at.month)
        monthly[key]["count"] += 1
        monthly[key]["revenue"] += price or 0

        by_establishment[est_id]["name"] = est_name
        by_establishment[est_id]["count"] += 1
        by_establishment[est_id]["revenue"] += price or 0

    keys_in_order = []
    cursor = datetime.utcnow().replace(day=1)
    for _ in range(months):
        keys_in_order.append((cursor.year, cursor.month))
        if cursor.month == 1:
            cursor = cursor.replace(year=cursor.year - 1, month=12)
        else:
            cursor = cursor.replace(month=cursor.month - 1)
    keys_in_order.reverse()

    monthly_points = [
        MonthlyTrendPoint(
            year=y, month=m, label=f"{MONTH_NAMES_FR[m - 1]} {y}",
            appointments_count=monthly.get((y, m), {"count": 0})["count"],
            revenue=monthly.get((y, m), {"revenue": 0.0})["revenue"],
        )
        for (y, m) in keys_in_order
    ]

    establishment_points = sorted(
        [
            EstablishmentBreakdownPoint(
                establishment_id=eid, establishment_name=d["name"],
                appointments_count=d["count"], revenue=d["revenue"],
            )
            for eid, d in by_establishment.items()
        ],
        key=lambda p: p.revenue, reverse=True,
    )[:10]

    return GlobalTrendsOut(monthly=monthly_points, by_establishment=establishment_points)

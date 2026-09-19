"""
Module Planning et conges (nouveau, gestion interne complete, demande M.
Faustin) - roulement/garde pour TOUT le personnel (pas seulement les
medecins, qui ont deja leurs propres creneaux de consultation via
DoctorAvailability) + demandes de conges validees par le RH/admin.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Shift, LeaveRequest, Department, User, UserRole
from app.schemas import ShiftCreate, ShiftOut, LeaveRequestCreate, LeaveRequestReview, LeaveRequestOut, ShiftSelfCreate
from app.deps import require_roles, get_current_user

router = APIRouter(prefix="/scheduling", tags=["planning"])

MANAGEMENT_ROLES = (UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER)
# Tout le personnel salarie peut avoir un planning/demander un conge -
# n'inclut pas PATIENT ni SUPER_ADMIN.
ALL_STAFF_ROLES = (
    UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR, UserRole.SECRETARY, UserRole.PHARMACIST,
    UserRole.LAB_TECHNICIAN, UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.HR_MANAGER,
)


def _to_shift_out(shift: Shift) -> ShiftOut:
    return ShiftOut(
        id=shift.id, user_id=shift.user_id, user_name=shift.user.full_name,
        department_id=shift.department_id, department_name=shift.department.name if shift.department else None,
        shift_date=shift.shift_date, start_time=shift.start_time, end_time=shift.end_time, notes=shift.notes,
    )


def _to_leave_out(leave: LeaveRequest) -> LeaveRequestOut:
    return LeaveRequestOut(
        id=leave.id, user_id=leave.user_id, user_name=leave.user.full_name,
        start_date=leave.start_date, end_date=leave.end_date, reason=leave.reason, status=leave.status,
        reviewed_by_name=leave.reviewed_by.full_name if leave.reviewed_by else None,
        reviewed_at=leave.reviewed_at, review_note=leave.review_note, created_at=leave.created_at,
    )


# ---------- PLANNING (shifts) ----------

@router.post("/shifts", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
def create_shift(payload: ShiftCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    target_user = db.query(User).filter(
        User.id == payload.user_id, User.establishment_id == current_user.establishment_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre du personnel introuvable")
    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departement introuvable")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="L'heure de fin doit etre apres l'heure de debut")

    shift = Shift(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id, user_id=payload.user_id,
        department_id=payload.department_id, shift_date=payload.shift_date,
        start_time=payload.start_time, end_time=payload.end_time, notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return _to_shift_out(shift)


@router.post("/shifts/mine", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
def create_my_shift(payload: ShiftSelfCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """
    NOUVEAU (demande explicite de M. Faustin: "en attendant" que
    DRH/etablissement programment entierement la disponibilite des
    medecins, chaque utilisateur peut temporairement programmer SES
    PROPRES gardes depuis "Mon planning"). Toujours pour SOI-MEME - on ne
    peut jamais programmer la garde de quelqu'un d'autre par cette voie.
    Aucune limite de date: une garde peut etre programmee des mois a
    l'avance (repond a "la programmation doit pouvoir se faire sur une
    periode de 1 mois").
    """
    if not current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Compte non rattache a un etablissement")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="L'heure de fin doit etre apres l'heure de debut")

    shift = Shift(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id, user_id=current_user.id,
        shift_date=payload.shift_date, start_time=payload.start_time, end_time=payload.end_time,
        notes=payload.notes, created_by_user_id=current_user.id,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return _to_shift_out(shift)


@router.get("/shifts/establishment", response_model=list[ShiftOut])
def list_establishment_shifts(start_date: str = None, end_date: str = None, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    """Tout le personnel peut consulter le planning de l'etablissement
    (visibilite partagee), seuls RH/admin peuvent le modifier (voir
    create_shift/delete_shift)."""
    query = db.query(Shift).filter(Shift.establishment_id == current_user.establishment_id)
    if start_date:
        query = query.filter(Shift.shift_date >= start_date)
    if end_date:
        query = query.filter(Shift.shift_date <= end_date)
    shifts = query.order_by(Shift.shift_date, Shift.start_time).all()
    return [_to_shift_out(s) for s in shifts]


@router.get("/shifts/mine", response_model=list[ShiftOut])
def my_shifts(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    shifts = (
        db.query(Shift)
        .filter(Shift.user_id == current_user.id)
        .order_by(Shift.shift_date, Shift.start_time)
        .all()
    )
    return [_to_shift_out(s) for s in shifts]


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift(shift_id: str, db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    shift = db.query(Shift).filter(
        Shift.id == shift_id, Shift.establishment_id == current_user.establishment_id
    ).first()
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creneau introuvable")
    db.delete(shift)
    db.commit()


# ---------- CONGES (leave requests) ----------

@router.post("/leave-requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def request_leave(payload: LeaveRequestCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La date de fin doit etre apres la date de debut")

    leave = LeaveRequest(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id, user_id=current_user.id,
        start_date=payload.start_date, end_date=payload.end_date, reason=payload.reason, status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return _to_leave_out(leave)


@router.get("/leave-requests/mine", response_model=list[LeaveRequestOut])
def my_leave_requests(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    leaves = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.user_id == current_user.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
    return [_to_leave_out(l) for l in leaves]


@router.get("/leave-requests/establishment", response_model=list[LeaveRequestOut])
def establishment_leave_requests(leave_status: str = None, db: Session = Depends(get_db),
                                  current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    query = db.query(LeaveRequest).filter(LeaveRequest.establishment_id == current_user.establishment_id)
    if leave_status:
        query = query.filter(LeaveRequest.status == leave_status)
    leaves = query.order_by(LeaveRequest.created_at.desc()).all()
    return [_to_leave_out(l) for l in leaves]


@router.patch("/leave-requests/{leave_id}/review", response_model=LeaveRequestOut)
def review_leave_request(leave_id: str, payload: LeaveRequestReview, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(*MANAGEMENT_ROLES))):
    leave = db.query(LeaveRequest).filter(
        LeaveRequest.id == leave_id, LeaveRequest.establishment_id == current_user.establishment_id
    ).first()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
    if leave.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette demande a deja ete traitee")

    leave.status = "approved" if payload.approve else "rejected"
    leave.reviewed_by_user_id = current_user.id
    leave.reviewed_at = datetime.utcnow()
    leave.review_note = payload.review_note
    db.commit()
    db.refresh(leave)
    return _to_leave_out(leave)

"""
Gestion des etablissements + gestion du personnel (nouveau).

Regle de securite: un establishment_admin ne peut creer que des comptes
staff (secretaire/pharmacien/technicien labo) - jamais un autre admin
d'etablissement, ni un super admin. C'est le meme principe que pour la
creation de medecins (deja en place): pas d'auto-elevation de privilege.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from app.specialties import specialty_variants
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Establishment, Doctor, User, UserRole, AuditLog, Department, StaffProfile
from app.schemas import (
    EstablishmentCreate, EstablishmentOut, EstablishmentSearchResult,
    EstablishmentStatusUpdate, EstablishmentUpdate, StaffCreate, StaffOut, StaffProfileUpdate,
    DepartmentCreate, DepartmentUpdate, DepartmentOut, EstablishmentLogoUpdate, EstablishmentSelfUpdate,
)
from app.deps import require_roles, get_current_user
from app.security import hash_password
from app.services.geo import resolve_city_coordinates, haversine_km

router = APIRouter(prefix="/establishments", tags=["etablissements"])

# NOUVEAU: roles supplementaires geres par l'admin d'etablissement (gestion
# interne complete, demande M. Faustin) - infirmier, receptionniste,
# comptable, responsable RH s'ajoutent au trio existant.
ALLOWED_STAFF_ROLES = {
    UserRole.SECRETARY, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN,
    UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.HR_MANAGER,
}


@router.post("", response_model=EstablishmentOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def create_establishment(payload: EstablishmentCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    existing_admin = db.query(User).filter(User.email == payload.admin_email.lower()).first()
    if existing_admin:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet e-mail admin est déjà utilisé")

    latitude, longitude = payload.latitude, payload.longitude
    if latitude is None or longitude is None:
        approx = resolve_city_coordinates(payload.city)
        if approx:
            latitude, longitude = approx

    establishment = Establishment(
        id=str(uuid.uuid4()),
        name=payload.name,
        type=payload.type,
        city=payload.city,
        address=payload.address,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(establishment)
    db.flush()

    admin_user = User(
        id=str(uuid.uuid4()),
        establishment_id=establishment.id,
        email=payload.admin_email.lower(),
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.admin_full_name,
        role=UserRole.ESTABLISHMENT_ADMIN,
    )
    db.add(admin_user)
    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id,
                     action="create_establishment", details=f"Création de {establishment.name}"))
    db.commit()
    db.refresh(establishment)
    return establishment


@router.get("", response_model=list[EstablishmentOut],
            dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def list_establishments(db: Session = Depends(get_db)):
    return db.query(Establishment).order_by(Establishment.created_at.desc()).all()


@router.get("/me", response_model=EstablishmentOut)
def my_establishment(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte non rattaché à un établissement")
    establishment = db.query(Establishment).filter(Establishment.id == current_user.establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable")
    return establishment


@router.patch("/me/logo", response_model=EstablishmentOut)
def update_establishment_logo(payload: EstablishmentLogoUpdate, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    """
    NOUVEAU (demande explicite de M. Faustin: profil d'etablissement avec
    logo). Reserve a l'admin - une decision d'image de marque, pas a
    changer par n'importe quel membre du personnel.
    """
    establishment = db.query(Establishment).filter(Establishment.id == current_user.establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable")
    establishment.logo_url = payload.logo_url
    db.commit()
    db.refresh(establishment)
    return establishment


@router.patch("/me", response_model=EstablishmentOut)
def update_my_establishment(payload: EstablishmentSelfUpdate, db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN))):
    """
    NOUVEAU (demande explicite de M. Faustin: "il faut donner la main aux
    ETS pour modifier le nom de leur ETS"). Volontairement restreint a
    nom/ville/adresse - jamais le "type" d'etablissement (classification
    de plateforme), qui reste reserve au super-admin via update_establishment.
    """
    establishment = db.query(Establishment).filter(Establishment.id == current_user.establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(establishment, field, value)

    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id,
                     action="update_establishment_self", details="Établissement modifié par son propre admin"))
    db.commit()
    db.refresh(establishment)
    return establishment


@router.get("/search", response_model=list[EstablishmentSearchResult])
def search_establishments(specialty: str, city: Optional[str] = None, db: Session = Depends(get_db)):
    """
    NOUVEAU - parcours "Consultation" etablissement-first (remplace l'ancien
    "Trouver medecin" ou le patient choisissait d'abord un creneau propose
    automatiquement). Ici le patient choisit d'abord une specialite, puis
    voit les etablissements qui ont au moins un medecin actif de cette
    specialite, tries par distance reelle (haversine) depuis sa ville.
    Public (pas d'auth requise), comme /doctors/search.
    """
    reference_coords = resolve_city_coordinates(city) if city else None

    rows = (
        db.query(Establishment, func.count(Doctor.id).label("doctor_count"))
        .join(Doctor, Doctor.establishment_id == Establishment.id)
        .filter(
            Establishment.is_active == True,
            Doctor.is_active == True,
            or_(*[Doctor.specialty.ilike(f"%{v}%") for v in specialty_variants(specialty)]),
        )
        .group_by(Establishment.id)
        .all()
    )

    results: list[EstablishmentSearchResult] = []
    for establishment, doctor_count in rows:
        distance_km = None
        if reference_coords and establishment.latitude is not None and establishment.longitude is not None:
            distance_km = haversine_km(
                reference_coords[0], reference_coords[1],
                establishment.latitude, establishment.longitude,
            )
        results.append(EstablishmentSearchResult(
            id=establishment.id, name=establishment.name, type=establishment.type,
            city=establishment.city, address=establishment.address,
            distance_km=round(distance_km, 1) if distance_km is not None else None,
            doctor_count=doctor_count,
        ))

    # Etablissements les plus proches d'abord; sans ville de reference (ou
    # sans coordonnees connues), on retombe sur un tri alphabetique stable.
    results.sort(key=lambda r: (r.distance_km if r.distance_km is not None else float("inf"), r.name))
    return results


@router.patch("/{establishment_id}", response_model=EstablishmentOut,
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def update_establishment(establishment_id: str, payload: EstablishmentUpdate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(establishment, field, value)

    if "city" in update_data and "latitude" not in update_data and "longitude" not in update_data:
        approx = resolve_city_coordinates(establishment.city)
        if approx:
            establishment.latitude, establishment.longitude = approx

    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id,
                     action="update_establishment", details=f"Modification de {establishment.name}"))
    db.commit()
    db.refresh(establishment)
    return establishment


@router.patch("/{establishment_id}/status", response_model=EstablishmentOut,
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def update_establishment_status(establishment_id: str, payload: EstablishmentStatusUpdate,
                                 db: Session = Depends(get_db),
                                 current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN))):
    establishment = db.query(Establishment).filter(Establishment.id == establishment_id).first()
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable")

    establishment.is_active = payload.is_active
    if payload.subscription_status:
        establishment.subscription_status = payload.subscription_status

    action = "suspend_establishment" if not payload.is_active else "reactivate_establishment"
    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment.id, action=action,
                     details=f"Statut mis à jour: is_active={payload.is_active}"))
    db.commit()
    db.refresh(establishment)
    return establishment


# ---------- GESTION DU PERSONNEL (nouveau) ----------

def _to_staff_out(db: Session, staff_user: User) -> StaffOut:
    profile = db.query(StaffProfile).filter(StaffProfile.user_id == staff_user.id).first()
    department_name = None
    if profile and profile.department_id:
        dept = db.query(Department).filter(Department.id == profile.department_id).first()
        department_name = dept.name if dept else None
    return StaffOut(
        id=staff_user.id, email=staff_user.email, full_name=staff_user.full_name,
        phone=staff_user.phone, role=staff_user.role, is_active=staff_user.is_active,
        department_id=profile.department_id if profile else None,
        department_name=department_name,
        position_title=profile.position_title if profile else None,
        hire_date=profile.hire_date if profile else None,
        contract_type=profile.contract_type if profile else None,
        license_number=profile.license_number if profile else None,
    )


@router.post("/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff_member(payload: StaffCreate, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    if payload.role not in ALLOWED_STAFF_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rôle invalide - utilise secretary, pharmacist, lab_technician, nurse, receptionist, accountant ou hr_manager",
        )

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet e-mail est déjà utilisé")

    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Département introuvable")

    staff_user = User(
        id=str(uuid.uuid4()),
        establishment_id=current_user.establishment_id,
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
    )
    db.add(staff_user)
    db.flush()

    # NOUVEAU: dossier employe (poste, departement, embauche...) - cree
    # meme si tous les champs sont vides, pour avoir systematiquement une
    # ligne StaffProfile a completer plus tard depuis l'onglet Equipe.
    profile = StaffProfile(
        id=str(uuid.uuid4()), user_id=staff_user.id, department_id=payload.department_id,
        position_title=payload.position_title, hire_date=payload.hire_date,
        contract_type=payload.contract_type, license_number=payload.license_number,
    )
    db.add(profile)

    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="create_staff", details=f"Compte {payload.role.value} créé: {payload.full_name}"))
    db.commit()
    db.refresh(staff_user)
    return _to_staff_out(db, staff_user)


@router.get("/staff", response_model=list[StaffOut])
def list_staff(db: Session = Depends(get_db),
               current_user: User = Depends(require_roles(*ALLOWED_STAFF_ROLES, UserRole.DOCTOR, UserRole.ESTABLISHMENT_ADMIN))):
    """
    CORRIGE (demande explicite de M. Faustin: verifier si un medecin peut
    ecrire a la reception ou a un confrere - reponse etait NON, seul
    admin/RH pouvaient consulter cet annuaire pour demarrer une
    conversation interne). La LECTURE est desormais ouverte a tout le
    personnel (annuaire des collegues, information non sensible) - les
    operations d'ECRITURE (creer, desactiver, modifier un profil staff)
    restent reservees a admin/RH via leurs propres controles separes,
    inchanges.
    """
    staff = (
        db.query(User)
        .filter(
            User.establishment_id == current_user.establishment_id,
            User.role.in_(list(ALLOWED_STAFF_ROLES) + [UserRole.DOCTOR]),
            User.id != current_user.id,
        )
        .order_by(User.full_name)
        .all()
    )
    return [_to_staff_out(db, s) for s in staff]


@router.patch("/staff/{staff_id}/deactivate", response_model=StaffOut)
def deactivate_staff(staff_id: str, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    staff_user = db.query(User).filter(
        User.id == staff_id, User.establishment_id == current_user.establishment_id, User.role.in_(list(ALLOWED_STAFF_ROLES))
    ).first()
    if not staff_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre du personnel introuvable")

    staff_user.is_active = not staff_user.is_active
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="toggle_staff_active", details=f"{staff_user.full_name}: is_active={staff_user.is_active}"))
    db.commit()
    db.refresh(staff_user)
    return _to_staff_out(db, staff_user)


@router.patch("/staff/{staff_id}/profile", response_model=StaffOut)
def update_staff_profile(staff_id: str, payload: StaffProfileUpdate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    """NOUVEAU: mise a jour du dossier employe (poste, departement,
    embauche, contrat, licence) apres la creation du compte."""
    staff_user = db.query(User).filter(
        User.id == staff_id, User.establishment_id == current_user.establishment_id, User.role.in_(list(ALLOWED_STAFF_ROLES))
    ).first()
    if not staff_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre du personnel introuvable")

    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id, Department.establishment_id == current_user.establishment_id
        ).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Département introuvable")

    profile = db.query(StaffProfile).filter(StaffProfile.user_id == staff_user.id).first()
    if not profile:
        profile = StaffProfile(id=str(uuid.uuid4()), user_id=staff_user.id)
        db.add(profile)

    profile.department_id = payload.department_id
    profile.position_title = payload.position_title
    profile.hire_date = payload.hire_date
    profile.contract_type = payload.contract_type
    profile.license_number = payload.license_number

    if payload.full_name:
        staff_user.full_name = payload.full_name
    if payload.phone:
        staff_user.phone = payload.phone

    db.commit()
    db.refresh(staff_user)
    return _to_staff_out(db, staff_user)


# ---------- DEPARTEMENTS (nouveau, gestion interne complete) ----------

@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    department = Department(id=str(uuid.uuid4()), establishment_id=current_user.establishment_id, name=payload.name)
    db.add(department)
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="create_department", details=f"Département créé: {payload.name}"))
    db.commit()
    db.refresh(department)
    return DepartmentOut(id=department.id, name=department.name, head_user_id=None, head_user_name=None, staff_count=0)


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte non rattaché à un établissement")
    departments = db.query(Department).filter(Department.establishment_id == current_user.establishment_id).order_by(Department.name).all()

    results = []
    for dept in departments:
        staff_count = db.query(StaffProfile).filter(StaffProfile.department_id == dept.id).count()
        head_name = dept.head_user.full_name if dept.head_user_id and dept.head_user else None
        results.append(DepartmentOut(
            id=dept.id, name=dept.name, head_user_id=dept.head_user_id,
            head_user_name=head_name, staff_count=staff_count,
        ))
    return results


@router.patch("/departments/{department_id}", response_model=DepartmentOut)
def update_department(department_id: str, payload: DepartmentUpdate, db: Session = Depends(get_db),
                       current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.HR_MANAGER))):
    dept = db.query(Department).filter(
        Department.id == department_id, Department.establishment_id == current_user.establishment_id
    ).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Département introuvable")

    if payload.head_user_id is not None:
        # NOUVEAU: "chef de service" - un membre du personnel (medecin ou
        # autre) designe comme responsable du departement. Pas un role a
        # part: un simple champ de supervision sur le departement, comme
        # decide dans le cahier des charges (evite de multiplier les roles
        # techniques pour une simple fonction de supervision).
        head = db.query(User).filter(User.id == payload.head_user_id, User.establishment_id == current_user.establishment_id).first()
        if not head:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable pour ce rôle de chef de service")
        dept.head_user_id = payload.head_user_id
    if payload.name:
        dept.name = payload.name

    db.commit()
    db.refresh(dept)
    staff_count = db.query(StaffProfile).filter(StaffProfile.department_id == dept.id).count()
    head_name = dept.head_user.full_name if dept.head_user_id and dept.head_user else None
    return DepartmentOut(id=dept.id, name=dept.name, head_user_id=dept.head_user_id, head_user_name=head_name, staff_count=staff_count)

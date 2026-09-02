"""
Module "Repertoire patients" + "Mes proches" (nouveau).

Principe d'isolation: un membre du staff ne voit que les patients ayant
une relation reelle avec SON etablissement (rendez-vous, commande
pharmacie, ou demande d'analyse) - meme regle que pour la messagerie.
"""
import uuid
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Patient, User, UserRole, Appointment, PharmacyReservation, LabTestRequest, Dependent, EstablishmentType, AuditLog,
)
from app.schemas import PatientDirectoryOut, DependentCreate, DependentOut, WalkInPatientCreate, WalkInPatientOut, CompleteRegistrationRequest
from app.deps import require_roles, require_establishment_types
from app.security import hash_password

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("/walk-in", response_model=WalkInPatientOut, status_code=status.HTTP_201_CREATED)
def create_walk_in_patient(payload: WalkInPatientCreate, db: Session = Depends(get_db),
                            current_user: User = Depends(require_roles(
                                UserRole.RECEPTIONIST, UserRole.SECRETARY, UserRole.ESTABLISHMENT_ADMIN))):
    """
    NOUVEAU (demande M. Faustin): permet au personnel d'accueil de creer un
    patient qui se presente PHYSIQUEMENT sans jamais etre passe par
    l'auto-inscription de la plateforme - contrairement a
    auth.py::register_patient qui exige un email et un mot de passe choisis
    par le patient lui-meme.

    Si aucun email n'est fourni (cas courant a l'accueil), un email de
    substitution reconnaissable est genere pour respecter la contrainte
    technique d'unicite du champ - AUCUNE migration necessaire, aucune
    nouvelle colonne. Ce compte ne peut pas encore etre utilise pour se
    connecter (mot de passe aleatoire jamais communique) - une prochaine
    evolution naturelle serait un parcours "completer mon inscription"
    permettant au patient d'ajouter son vrai email et choisir son mot de
    passe plus tard, une fois chez lui.
    """
    real_email_provided = bool(payload.email)

    if payload.email:
        existing = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Un compte existe deja avec cet email")
        email = payload.email.lower()
    else:
        # Domaine volontairement non-livrable et reconnaissable - jamais un
        # vrai email, ne risque jamais d'atteindre un destinataire reel.
        email = f"patient.{uuid.uuid4().hex[:10]}@sans-email.speedsante.local"

    # Mot de passe aleatoire, jamais communique a personne - ce compte sert
    # uniquement a exister dans le systeme (dossier, rendez-vous...) tant
    # que le patient n'a pas complete son inscription avec un vrai email.
    random_password = secrets.token_urlsafe(16)

    user = User(
        id=str(uuid.uuid4()), email=email, hashed_password=hash_password(random_password),
        full_name=payload.full_name, phone=payload.phone, role=UserRole.PATIENT,
        establishment_id=None, gender=payload.gender, residence=payload.residence,
    )
    db.add(user)
    db.flush()

    dossier_number = f"PAT-{uuid.uuid4().hex[:8].upper()}"
    patient = Patient(id=str(uuid.uuid4()), user_id=user.id, dossier_number=dossier_number, date_of_birth=payload.date_of_birth)
    db.add(patient)

    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="create_walk_in_patient", details=f"Patient cree en presentiel: {payload.full_name} ({dossier_number})"))
    db.commit()

    return WalkInPatientOut(
        id=patient.id, dossier_number=dossier_number, full_name=user.full_name,
        phone=user.phone, has_real_email=real_email_provided,
    )


@router.patch("/{patient_id}/email", response_model=WalkInPatientOut)
def complete_registration(patient_id: str, payload: CompleteRegistrationRequest, db: Session = Depends(get_db),
                           current_user: User = Depends(require_roles(
                               UserRole.RECEPTIONIST, UserRole.SECRETARY, UserRole.ESTABLISHMENT_ADMIN))):
    """
    NOUVEAU (demande M. Faustin): "completer mon inscription" - un patient
    cree en presentiel sans email (voir create_walk_in_patient) ne peut
    pas se connecter tant qu'il n'a pas de VRAI email. Une fois le
    personnel d'accueil l'ajoute ici, le patient peut utiliser "mot de
    passe oublie" pour choisir lui-meme son mot de passe et acceder a la
    plateforme - reutilise ce mecanisme deja construit et teste plutot
    que d'en batir un nouveau.

    Protection: refuse d'ecraser un VRAI email deja en place (evite
    qu'un membre du personnel change par erreur l'email d'un patient qui
    utilise deja normalement son compte).
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient introuvable")

    user = db.query(User).filter(User.id == patient.user_id).first()
    if not user.email.endswith("@sans-email.speedsante.local"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce patient a deja un vrai email enregistre - impossible de l'ecraser depuis cet ecran.",
        )

    new_email = payload.email.lower()
    existing = db.query(User).filter(User.email == new_email, User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Un compte existe deja avec cet email")

    user.email = new_email
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="complete_patient_registration", details=f"Email ajoute pour le patient {patient.dossier_number}"))
    db.commit()

    return WalkInPatientOut(id=patient.id, dossier_number=patient.dossier_number, full_name=user.full_name, phone=user.phone, has_real_email=True)


@router.get("/establishment", response_model=list[PatientDirectoryOut],
            dependencies=[Depends(require_establishment_types(EstablishmentType.HOPITAL, EstablishmentType.CLINIQUE))])
def establishment_patient_directory(search: Optional[str] = None, db: Session = Depends(get_db),
                                     current_user: User = Depends(require_roles(
                                         UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    """
    Reserve aux hopitaux/cliniques (require_establishment_types ci-dessus):
    une pharmacie ou un laboratoire ne gere pas de dossier patient au sens
    consultation - seuls des rendez-vous medicaux justifient cet annuaire.
    Avant ce correctif, un establishment_admin de pharmacie pouvait recuperer
    ici nom/email/telephone/numero de dossier de tous ses clients via la
    jointure PharmacyReservation, sans jamais passer par l'onglet frontend.
    """
    establishment_id = current_user.establishment_id

    patient_ids = set()
    for row in db.query(Appointment.patient_id).filter(Appointment.establishment_id == establishment_id).distinct():
        patient_ids.add(row[0])
    for row in db.query(PharmacyReservation.patient_id).filter(PharmacyReservation.establishment_id == establishment_id).distinct():
        patient_ids.add(row[0])
    for row in db.query(LabTestRequest.patient_id).filter(LabTestRequest.establishment_id == establishment_id).distinct():
        patient_ids.add(row[0])

    if not patient_ids:
        return []

    query = db.query(Patient).filter(Patient.id.in_(patient_ids))
    patients = query.all()

    results = []
    for patient in patients:
        if search and search.strip():
            if search.strip().lower() not in patient.user.full_name.lower():
                continue
        last_appointment = (
            db.query(Appointment)
            .filter(Appointment.patient_id == patient.id, Appointment.establishment_id == establishment_id)
            .order_by(Appointment.scheduled_at.desc())
            .first()
        )
        results.append(PatientDirectoryOut(
            id=patient.id, full_name=patient.user.full_name, email=patient.user.email,
            phone=patient.user.phone, dossier_number=patient.dossier_number,
            last_visit=last_appointment.scheduled_at if last_appointment else None,
        ))

    results.sort(key=lambda p: p.full_name)
    return results


# ---------- MES PROCHES (nouveau) ----------

@router.post("/dependents", response_model=DependentOut, status_code=status.HTTP_201_CREATED)
def add_dependent(payload: DependentCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    dependent = Dependent(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        full_name=payload.full_name,
        relation_type=payload.relation_type,
        date_of_birth=payload.date_of_birth,
    )
    db.add(dependent)
    db.commit()
    db.refresh(dependent)
    return dependent


@router.get("/dependents/mine", response_model=list[DependentOut])
def my_dependents(db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Dependent).filter(Dependent.patient_id == patient.id).order_by(Dependent.full_name).all()


@router.delete("/dependents/{dependent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependent(dependent_id: str, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    dependent = db.query(Dependent).filter(Dependent.id == dependent_id, Dependent.patient_id == patient.id).first()
    if not dependent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proche introuvable")
    db.delete(dependent)
    db.commit()

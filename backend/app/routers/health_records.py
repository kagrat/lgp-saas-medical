"""
Module "Dossier de sante structure" (nouveau).

Principe de conception, en accord avec l'isolation multi-tenant deja en
place ailleurs dans le projet (section 3 du cahier des charges: "chaque
etablissement ne voit que ses propres donnees"):

- Chaque document est OBLIGATOIREMENT rattache a un rendez-vous reel
  (appointment_id). Ca garantit une tracabilite complete: on sait toujours
  quel medecin, dans quel etablissement, a produit quel document, et pour
  quelle consultation. Impossible de creer un document "dans le vide".
- Un membre du staff (medecin/admin) ne voit que les documents crees dans
  SON etablissement, meme pour un patient qui a consulte ailleurs aussi -
  exactement comme il ne voit pas les rendez-vous des autres etablissements.
- Le PATIENT, lui, voit son dossier COMPLET, tous etablissements confondus
  - c'est son dossier de sante personnel, l'equivalent d'une carte Vitale:
  lui seul a une vue d'ensemble transversale.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MedicalDocument, Appointment, Patient, Doctor, User, UserRole, AuditLog, PrescriptionItem, PrescriptionLabItem
from app.schemas import MedicalDocumentCreate, MedicalDocumentOut, PrescriptionItemOut, PrescriptionLabItemOut
from app.deps import require_roles

router = APIRouter(prefix="/health-records", tags=["dossier-sante"])


def _to_document_out(doc: MedicalDocument) -> MedicalDocumentOut:
    author_name = "Inconnu"
    if doc.doctor:
        author_name = doc.doctor.user.full_name
    elif doc.author:
        author_name = doc.author.full_name
    return MedicalDocumentOut(
        id=doc.id,
        appointment_id=doc.appointment_id,
        admission_id=doc.admission_id,
        patient_id=doc.patient_id,
        doctor_name=author_name,
        establishment_name=doc.establishment.name if doc.establishment else "Inconnu",
        document_type=doc.document_type,
        title=doc.title,
        content=doc.content,
        created_at=doc.created_at,
        prescription_items=[
            PrescriptionItemOut(id=i.id, medication_name=i.medication_name, quantity=i.quantity, dosage_instructions=i.dosage_instructions)
            for i in doc.prescription_items
        ],
        prescription_lab_items=[
            PrescriptionLabItemOut(id=i.id, test_name=i.test_name, sample_type=i.sample_type)
            for i in doc.prescription_lab_items
        ],
    )


@router.post("", response_model=MedicalDocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(payload: MedicalDocumentCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.DOCTOR))):
    appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")
    if appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé à ce rendez-vous")

    # Un medecin ne peut documenter que ses propres consultations, pas
    # celles de ses collegues (l'admin etablissement, lui, le peut).
    if current_user.role == UserRole.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor or appointment.doctor_id != doctor.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu ne peux documenter que tes propres consultations")

    document = MedicalDocument(
        id=str(uuid.uuid4()),
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        establishment_id=appointment.establishment_id,
        document_type=payload.document_type,
        title=payload.title,
        content=payload.content,
    )
    db.add(document)
    db.flush()

    if payload.prescription_items:
        for item in payload.prescription_items:
            db.add(PrescriptionItem(
                id=str(uuid.uuid4()), document_id=document.id,
                medication_name=item.medication_name, quantity=item.quantity,
                dosage_instructions=item.dosage_instructions,
            ))

    if payload.prescription_lab_items:
        for item in payload.prescription_lab_items:
            db.add(PrescriptionLabItem(
                id=str(uuid.uuid4()), document_id=document.id,
                test_name=item.test_name, sample_type=item.sample_type,
            ))

    db.add(AuditLog(user_id=current_user.id, establishment_id=appointment.establishment_id,
                     action="create_medical_document", details=f"Document '{payload.title}' ajouté au dossier"))
    db.commit()
    db.refresh(document)
    return _to_document_out(document)


@router.get("/mine", response_model=list[MedicalDocumentOut])
def my_health_record(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """Dossier complet du patient, tous etablissements confondus."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    documents = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.patient_id == patient.id)
        .order_by(MedicalDocument.created_at.desc())
        .all()
    )
    return [_to_document_out(d) for d in documents]


@router.get("/appointment/{appointment_id}", response_model=list[MedicalDocumentOut])
def documents_for_appointment(appointment_id: str, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(
                                   UserRole.ESTABLISHMENT_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR))):
    """Documents lies a un rendez-vous precis - utilise dans l'onglet Rendez-vous cote etablissement."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment or appointment.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable")

    documents = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.appointment_id == appointment_id)
        .order_by(MedicalDocument.created_at.desc())
        .all()
    )
    return [_to_document_out(d) for d in documents]

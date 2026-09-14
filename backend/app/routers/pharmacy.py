"""
Module 5 - Pharmacie: stock, statistiques + NOUVEAU workflow de
verification pharmacien avant confirmation finale.

CHANGEMENT DE COMPORTEMENT IMPORTANT (demande M. Faustin): le stock
n'est plus decompte a la creation de la commande. Il n'est decompte
qu'a UN SEUL endroit dans tout le code: quand le patient confirme
definitivement la proposition du pharmacien (endpoint /confirm).
Le passage direct "en attente -> confirmee" via l'ancien endpoint
generique est desormais bloque, pour garantir qu'il n'existe aucun
autre chemin possible vers un double-decompte du stock.

Nouveau flux:
1. Patient commande -> PENDING (stock intact)
2. Pharmacien verifie (quantite/prix reels) -> AWAITING_CONFIRMATION
3. Patient confirme -> stock decompte ICI, CONFIRMED
   Patient refuse -> CANCELLED (stock toujours intact)
4. Suite du parcours (preparing/ready/...) via l'endpoint generique,
   qui refuse desormais PENDING/CONFIRMED/AWAITING_CONFIRMATION.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    PharmacyStock, PharmacyReservation, PharmacyOrderItem, PharmacyReservationStatusHistory,
    Patient, User, UserRole, ReservationStatus, EstablishmentType, Establishment, AuditLog,
    PrescriptionItem, MedicalDocument, DocumentType, DeliveryMode, PharmacyStockBatch, OpeningHours,
)
from app.schemas import (
    StockItemCreate, StockItemOut, ReservationCreate, ReservationOut, ReservationItemOut,
    ReservationStatusUpdate, ReservationHistoryOut, PharmacyStatsOut, ReservationReview,
    PharmacySearchResult, PrescriptionMatchOut, PharmacyOrderSummaryOut,
    PharmacyBatchCreate, PharmacyBatchOut, PharmacyReportOut, PharmacyDailyRevenueOut,
)
from app.deps import require_roles, require_establishment_types
from app.services.geo import resolve_city_coordinates, haversine_km
from app.routers.notifications import create_stock_alert

# Endpoints de gestion pharmacie (stock/commandes cote etablissement) reserves
# aux etablissements de type pharmacie - un hopital ou une clinique peut avoir
# un compte establishment_admin, mais ce n'est pas son metier (point souleve
# par M. Faustin: ne garder Pharmacie/Commandes que pour le type Pharmacie).
_PHARMACY_ONLY = Depends(require_establishment_types(EstablishmentType.PHARMACIE))

router = APIRouter(prefix="/pharmacy", tags=["pharmacie"])

# Statuts que l'ancien endpoint generique n'a plus le droit de definir -
# ils passent desormais obligatoirement par les endpoints dedies.
PROTECTED_STATUSES = {ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.AWAITING_CONFIRMATION}


def _to_stock_out(item: PharmacyStock) -> StockItemOut:
    return StockItemOut(
        id=item.id, reference=item.reference, medication_name=item.medication_name, category=item.category,
        quantity=item.quantity, alert_threshold=item.alert_threshold, unit_price=item.unit_price,
        establishment_id=item.establishment_id, is_low_stock=item.quantity <= item.alert_threshold,
        unit_of_sale=item.unit_of_sale, dci=item.dci, units_per_box=item.units_per_box,
        form=item.form, dosage=item.dosage, manufacturer=item.manufacturer,
    )


# NOUVEAU (demande explicite de M. Faustin: Inventaire, partie 3 - le
# statut doit "alterner automatiquement" - jamais saisi a la main, pour
# eviter qu'un statut affiche devienne faux avec le temps (ex: un lot
# marque "disponible" qui a en realite expire la semaine suivante, faute
# de mise a jour manuelle).
PHARMACY_EXPIRY_WARNING_DAYS = 60


def _to_batch_out(batch: PharmacyStockBatch, stock_item: PharmacyStock) -> PharmacyBatchOut:
    today = datetime.utcnow().date()
    days_to_expiry = (batch.expiration_date - today).days

    if days_to_expiry < 0:
        # Un lot deja expire n'est de toute facon plus vendable - on le
        # signale comme "expire_bientot" (etat le plus proche du danger
        # deja defini) plutot que d'introduire un 4e etat non demande.
        computed_status = "expire_bientot"
    elif days_to_expiry <= PHARMACY_EXPIRY_WARNING_DAYS:
        computed_status = "expire_bientot"
    elif stock_item.quantity <= stock_item.alert_threshold:
        computed_status = "stock_faible"
    else:
        computed_status = "disponible"

    return PharmacyBatchOut(
        id=batch.id, stock_item_id=stock_item.id, medication_name=stock_item.medication_name,
        lot_number=batch.lot_number, received_at=batch.received_at, quantity_received=batch.quantity_received,
        expiration_date=batch.expiration_date, unit_price=stock_item.unit_price, status=computed_status,
    )


def _to_reservation_out(reservation: PharmacyReservation, db: Session) -> ReservationOut:
    items = [
        ReservationItemOut(
            id=item.id, medication_id=item.medication_id,
            medication_name=item.medication.medication_name,
            medication_reference=item.medication.reference,
            quantity=item.quantity,
            confirmed_quantity=item.confirmed_quantity,
            confirmed_unit_price=item.confirmed_unit_price,
            stock_status=item.stock_status,
            catalog_unit_price=item.medication.unit_price,
        )
        for item in reservation.items
    ]
    total_amount = None
    if all(i.confirmed_quantity is not None and i.confirmed_unit_price is not None for i in items) and items:
        total_amount = sum(i.confirmed_quantity * i.confirmed_unit_price for i in items)

    # NOUVEAU (demande explicite de M. Faustin: liste des commandes
    # restructuree - nom du patient, telephone et un numero de commande
    # lisible, visibles directement sans ouvrir chaque commande).
    patient = db.query(Patient).filter(Patient.id == reservation.patient_id).first()

    return ReservationOut(
        id=reservation.id, establishment_id=reservation.establishment_id,
        patient_id=reservation.patient_id, items=items,
        delivery_mode=reservation.delivery_mode,
        status=reservation.status, estimated_ready_at=reservation.estimated_ready_at,
        pharmacist_note=reservation.pharmacist_note, created_at=reservation.created_at,
        total_amount=total_amount,
        prescription_document_id=reservation.prescription_document_id,
        order_number=f"CMD-{reservation.id[:8].upper()}",
        patient_name=patient.user.full_name if patient else "Inconnu",
        patient_phone=patient.user.phone if patient else None,
        is_paid=reservation.is_paid, paid_at=reservation.paid_at,
    )


@router.post("/stock", response_model=StockItemOut, status_code=status.HTTP_201_CREATED, dependencies=[_PHARMACY_ONLY])
def add_stock_item(payload: StockItemCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    existing_reference = (
        db.query(PharmacyStock)
        .filter(PharmacyStock.establishment_id == current_user.establishment_id, PharmacyStock.reference == payload.reference)
        .first()
    )
    if existing_reference:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette reference existe deja dans ton stock")

    item = PharmacyStock(
        id=str(uuid.uuid4()), establishment_id=current_user.establishment_id,
        reference=payload.reference, medication_name=payload.medication_name, category=payload.category,
        quantity=payload.quantity, alert_threshold=payload.alert_threshold, unit_price=payload.unit_price,
        unit_of_sale=payload.unit_of_sale, dci=payload.dci, units_per_box=payload.units_per_box,
        form=payload.form, dosage=payload.dosage, manufacturer=payload.manufacturer,
    )
    db.add(item)
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="create_pharmacy_product", details=f"Produit cree: {item.medication_name} ({item.reference})"))
    db.commit()
    db.refresh(item)
    return _to_stock_out(item)


@router.post("/stock/batches", response_model=PharmacyBatchOut, status_code=status.HTTP_201_CREATED, dependencies=[_PHARMACY_ONLY])
def add_stock_batch(payload: PharmacyBatchCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """
    NOUVEAU (demande explicite de M. Faustin: Inventaire, partie 2 -
    enregistrer un lot recu pour un produit deja cree en partie 1).

    SECURITE: verifie explicitement que le produit vise appartient bien a
    L'ETABLISSEMENT DE L'UTILISATEUR CONNECTE - sans ce controle, un
    pharmacien malveillant aurait pu injecter un lot (et donc modifier la
    quantite en stock) sur le produit d'un AUTRE etablissement, simplement
    en devinant/enumerant des identifiants.
    """
    stock_item = db.query(PharmacyStock).filter(
        PharmacyStock.id == payload.stock_item_id, PharmacyStock.establishment_id == current_user.establishment_id,
    ).first()
    if not stock_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit introuvable dans ton etablissement")

    batch = PharmacyStockBatch(
        id=str(uuid.uuid4()), stock_item_id=stock_item.id, lot_number=payload.lot_number,
        received_at=payload.received_at, quantity_received=payload.quantity_received,
        expiration_date=payload.expiration_date, created_by_user_id=current_user.id,
    )
    db.add(batch)
    # Synchronise la quantite agregee (source de verite pour la vente,
    # deja utilisee par tout le flux de commande existant) - le nouveau
    # lot recu s'ajoute au stock disponible.
    stock_item.quantity += payload.quantity_received
    db.add(AuditLog(user_id=current_user.id, establishment_id=current_user.establishment_id,
                     action="add_pharmacy_batch",
                     details=f"Lot {payload.lot_number} recu pour {stock_item.medication_name}: +{payload.quantity_received} unites"))
    db.commit()
    db.refresh(batch)

    return _to_batch_out(batch, stock_item)


@router.get("/stock/batches", response_model=list[PharmacyBatchOut], dependencies=[_PHARMACY_ONLY])
def list_stock_batches(db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """
    NOUVEAU (demande explicite de M. Faustin: Inventaire, partie 3 -
    consultation du stock: lot, expiration, nombre en stock, prix de
    vente, et etat calcule automatiquement).

    SECURITE: la jointure filtre explicitement sur l'etablissement de
    l'utilisateur connecte - sans cela, un pharmacien aurait pu voir les
    lots de N'IMPORTE QUEL AUTRE etablissement.
    """
    batches = (
        db.query(PharmacyStockBatch)
        .join(PharmacyStock, PharmacyStock.id == PharmacyStockBatch.stock_item_id)
        .filter(PharmacyStock.establishment_id == current_user.establishment_id)
        .order_by(PharmacyStockBatch.expiration_date.asc())
        .all()
    )
    return [_to_batch_out(b, b.stock_item) for b in batches]


@router.get("/stock", response_model=list[StockItemOut], dependencies=[_PHARMACY_ONLY])
def list_stock(db: Session = Depends(get_db),
               current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    items = db.query(PharmacyStock).filter(PharmacyStock.establishment_id == current_user.establishment_id).all()
    return [_to_stock_out(i) for i in items]


@router.get("/search", response_model=list[StockItemOut])
def search_medication(name: str, db: Session = Depends(get_db)):
    """ANCIEN comportement (recherche directe par medicament, toutes
    pharmacies confondues) - conserve pour compatibilite mais plus utilise
    par le nouveau parcours pharmacie-first (voir /pharmacies/search puis
    /stock/public ci-dessous)."""
    items = (
        db.query(PharmacyStock)
        .filter(
            (PharmacyStock.medication_name.ilike(f"%{name}%")) | (PharmacyStock.reference.ilike(f"%{name}%")),
            PharmacyStock.quantity > 0,
        )
        .limit(50)
        .all()
    )
    return [_to_stock_out(i) for i in items]


@router.get("/pharmacies/search", response_model=list[PharmacySearchResult])
def search_pharmacies(name: Optional[str] = None, city: Optional[str] = None, db: Session = Depends(get_db)):
    """
    NOUVEAU (parcours pharmacie-first, demande M. Faustin): le patient
    cherche d'abord une PHARMACIE (par ville et/ou nom), avant de choisir
    des medicaments - inverse de l'ancien comportement. Public, comme
    /doctors/search et /establishments/search.
    """
    reference_coords = resolve_city_coordinates(city) if city else None

    query = db.query(Establishment).filter(
        Establishment.type == EstablishmentType.PHARMACIE,
        Establishment.is_active == True,
    )
    if name:
        query = query.filter(Establishment.name.ilike(f"%{name}%"))

    establishments = query.limit(100).all()

    # NOUVEAU (demande explicite de M. Faustin: statut ouvert/ferme visible
    # directement pendant la recherche). Une seule requete groupee pour
    # toutes les pharmacies du jour, plutot qu'un appel par pharmacie.
    now = datetime.utcnow()
    today_weekday = now.weekday()
    now_time = now.time()
    establishment_ids = [e.id for e in establishments]
    todays_hours = (
        db.query(OpeningHours)
        .filter(OpeningHours.establishment_id.in_(establishment_ids), OpeningHours.day_of_week == today_weekday)
        .all()
        if establishment_ids else []
    )
    hours_by_establishment = {h.establishment_id: h for h in todays_hours}

    results: list[PharmacySearchResult] = []
    for establishment in establishments:
        distance_km = None
        if reference_coords and establishment.latitude is not None and establishment.longitude is not None:
            distance_km = haversine_km(
                reference_coords[0], reference_coords[1],
                establishment.latitude, establishment.longitude,
            )
        today_entry = hours_by_establishment.get(establishment.id)
        is_open_now = None
        today_hours_display = None
        if today_entry:
            today_hours_display = f"{today_entry.open_time.strftime('%H:%M')}-{today_entry.close_time.strftime('%H:%M')}"
            is_open_now = today_entry.open_time <= now_time <= today_entry.close_time
        results.append(PharmacySearchResult(
            id=establishment.id, name=establishment.name, city=establishment.city,
            address=establishment.address,
            distance_km=round(distance_km, 1) if distance_km is not None else None,
            is_open_now=is_open_now, today_hours=today_hours_display,
        ))

    results.sort(key=lambda r: (r.distance_km if r.distance_km is not None else float("inf"), r.name))
    return results


@router.get("/stock/public", response_model=list[StockItemOut])
def browse_pharmacy_stock(establishment_id: str, name: Optional[str] = None, db: Session = Depends(get_db)):
    """
    NOUVEAU (parcours pharmacie-first): une fois la pharmacie choisie, le
    patient parcourt/recherche SES medicaments en stock, pour en ajouter
    plusieurs a son panier. Public (pas d'auth), en lecture seule, filtre
    aux articles disponibles (quantity > 0) comme l'ancienne recherche.
    """
    query = db.query(PharmacyStock).filter(
        PharmacyStock.establishment_id == establishment_id,
        PharmacyStock.quantity > 0,
    )
    if name:
        query = query.filter(
            (PharmacyStock.medication_name.ilike(f"%{name}%")) | (PharmacyStock.reference.ilike(f"%{name}%"))
        )
    items = query.order_by(PharmacyStock.medication_name).limit(100).all()
    return [_to_stock_out(i) for i in items]


@router.get("/match-prescription", response_model=list[PrescriptionMatchOut])
def match_prescription(document_id: str, establishment_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """
    NOUVEAU (lien ordonnance -> pharmacie, lacune identifiee lors d'un
    audit complet): pour chaque medicament prescrit dans cette ordonnance,
    cherche les articles correspondants dans le stock de LA PHARMACIE
    CHOISIE par le patient. Le rapprochement se fait ici (pas a la creation
    de l'ordonnance) car le medecin ne sait pas a l'avance quelle pharmacie
    sera choisie ni son catalogue exact.
    """
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    document = db.query(MedicalDocument).filter(
        MedicalDocument.id == document_id, MedicalDocument.patient_id == patient.id,
        MedicalDocument.document_type == DocumentType.PRESCRIPTION,
    ).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    results: list[PrescriptionMatchOut] = []
    for item in document.prescription_items:
        matches = (
            db.query(PharmacyStock)
            .filter(
                PharmacyStock.establishment_id == establishment_id,
                PharmacyStock.quantity > 0,
                PharmacyStock.medication_name.ilike(f"%{item.medication_name}%"),
            )
            .limit(10)
            .all()
        )
        results.append(PrescriptionMatchOut(
            prescribed_name=item.medication_name, prescribed_quantity=item.quantity,
            dosage_instructions=item.dosage_instructions,
            matches=[_to_stock_out(m) for m in matches],
        ))
    return results


@router.get("/stats", response_model=PharmacyStatsOut, dependencies=[_PHARMACY_ONLY])
def pharmacy_stats(db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    establishment_id = current_user.establishment_id
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_orders = db.query(PharmacyReservation).filter(PharmacyReservation.establishment_id == establishment_id).count()
    orders_this_month = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == establishment_id, PharmacyReservation.created_at >= this_month_start)
        .count()
    )
    pending_orders = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == establishment_id, PharmacyReservation.status == ReservationStatus.PENDING)
        .count()
    )
    low_stock_items = (
        db.query(PharmacyStock)
        .filter(PharmacyStock.establishment_id == establishment_id, PharmacyStock.quantity <= PharmacyStock.alert_threshold)
        .count()
    )

    # NOUVEAU (demande explicite de M. Faustin: tableau de bord pharmacie
    # avec 4 grands rectangles - livraisons en cours + chiffre d'affaires
    # journalier, en plus de ce qui existait deja).
    deliveries_in_progress = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == establishment_id, PharmacyReservation.status == ReservationStatus.OUT_FOR_DELIVERY)
        .count()
    )
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    revenue_today = (
        db.query(func.coalesce(func.sum(PharmacyOrderItem.confirmed_quantity * PharmacyOrderItem.confirmed_unit_price), 0.0))
        .join(PharmacyReservation, PharmacyReservation.id == PharmacyOrderItem.reservation_id)
        .filter(
            PharmacyReservation.establishment_id == establishment_id,
            PharmacyReservation.status == ReservationStatus.DELIVERED,
            PharmacyReservation.created_at >= today_start,
        )
        .scalar() or 0.0
    )

    return PharmacyStatsOut(
        total_orders=total_orders,
        orders_this_month=orders_this_month,
        pending_orders=pending_orders,
        low_stock_items=low_stock_items,
        deliveries_in_progress=deliveries_in_progress,
        revenue_today=revenue_today,
    )


@router.get("/orders/summary", response_model=list[PharmacyOrderSummaryOut], dependencies=[_PHARMACY_ONLY])
def pharmacy_orders_summary(db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """
    NOUVEAU (demande explicite de M. Faustin: "en dessous de ces
    rectangles, on peut avoir une historique de vue globale sur les
    commandes en cours de traitement" - raccourci limite pour le tableau
    de bord, PAS la liste complete (deja disponible dans l'onglet
    Commandes, qui reste la reference detaillee).
    """
    orders = (
        db.query(PharmacyReservation)
        .filter(
            PharmacyReservation.establishment_id == current_user.establishment_id,
            PharmacyReservation.status.notin_([ReservationStatus.DELIVERED, ReservationStatus.CANCELLED]),
        )
        .order_by(PharmacyReservation.created_at.desc())
        .limit(8)
        .all()
    )
    results = []
    for o in orders:
        patient = db.query(Patient).filter(Patient.id == o.patient_id).first()
        items = db.query(PharmacyOrderItem).filter(PharmacyOrderItem.reservation_id == o.id).all()
        total = None
        if items and all(i.confirmed_quantity is not None and i.confirmed_unit_price is not None for i in items):
            total = sum(i.confirmed_quantity * i.confirmed_unit_price for i in items)
        results.append(PharmacyOrderSummaryOut(
            id=o.id, order_number=f"CMD-{o.id[:8].upper()}",
            patient_name=patient.user.full_name if patient else "Inconnu", total_amount=total,
            status=o.status, created_at=o.created_at,
        ))
    return results


@router.get("/reservations/mine", response_model=list[ReservationOut])
def my_reservations(db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.PATIENT))):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    reservations = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.patient_id == patient.id)
        .order_by(PharmacyReservation.created_at.desc())
        .all()
    )
    return [_to_reservation_out(r, db) for r in reservations]


@router.get("/reservations/establishment", response_model=list[ReservationOut], dependencies=[_PHARMACY_ONLY])
def establishment_reservations(db: Session = Depends(get_db),
                                current_user: User = Depends(require_roles(
                                    UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    reservations = (
        db.query(PharmacyReservation)
        .filter(PharmacyReservation.establishment_id == current_user.establishment_id)
        .order_by(PharmacyReservation.created_at.desc())
        .all()
    )
    return [_to_reservation_out(r, db) for r in reservations]


@router.get("/reservations/{reservation_id}/history", response_model=list[ReservationHistoryOut])
def reservation_history(reservation_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(
                             UserRole.PATIENT, UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")

    if current_user.role == UserRole.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or reservation.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    else:
        if reservation.establishment_id != current_user.establishment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    history = (
        db.query(PharmacyReservationStatusHistory)
        .filter(PharmacyReservationStatusHistory.reservation_id == reservation_id)
        .order_by(PharmacyReservationStatusHistory.created_at.asc())
        .all()
    )
    return [
        ReservationHistoryOut(id=h.id, status=h.status, note=h.note, created_at=h.created_at)
        for h in history
    ]


@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """
    RESTRUCTURE (panier multi-articles): la commande contient desormais
    plusieurs lignes. Ne decompte pas le stock ici (comme avant) - simple
    demande, verifiee et confirmee dans les etapes suivantes.
    """
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier patient introuvable")

    stock_items: dict[str, PharmacyStock] = {}
    for line in payload.items:
        stock_item = db.query(PharmacyStock).filter(PharmacyStock.id == line.medication_id).first()
        if not stock_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicament introuvable")
        if stock_item.quantity < line.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stock insuffisant pour {stock_item.medication_name}",
            )
        stock_items[line.medication_id] = stock_item

    # Toutes les lignes doivent venir de la MEME pharmacie (le panier se
    # construit depuis une seule pharmacie choisie au depart) - protection
    # cote serveur meme si le frontend ne devrait jamais permettre de
    # melanger deux etablissements dans un seul panier.
    establishment_ids = {s.establishment_id for s in stock_items.values()}
    if len(establishment_ids) > 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Une commande ne peut contenir que des medicaments d'une seule pharmacie",
        )
    establishment_id = establishment_ids.pop()

    # NOUVEAU (lien ordonnance -> pharmacie): si la commande provient d'une
    # ordonnance, verifie qu'elle appartient bien AU PATIENT qui commande
    # (pas a un autre patient) avant de l'associer.
    if payload.prescription_document_id:
        prescription_doc = db.query(MedicalDocument).filter(
            MedicalDocument.id == payload.prescription_document_id,
            MedicalDocument.patient_id == patient.id,
        ).first()
        if not prescription_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    reservation = PharmacyReservation(
        id=str(uuid.uuid4()), establishment_id=establishment_id,
        patient_id=patient.id, delivery_mode=payload.delivery_mode,
        status=ReservationStatus.PENDING,
        prescription_document_id=payload.prescription_document_id,
    )
    db.add(reservation)
    db.flush()

    details_parts = []
    for line in payload.items:
        stock_item = stock_items[line.medication_id]
        db.add(PharmacyOrderItem(
            id=str(uuid.uuid4()), reservation_id=reservation.id,
            medication_id=stock_item.id, quantity=line.quantity,
        ))
        details_parts.append(f"{line.quantity}x {stock_item.medication_name}")

    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=ReservationStatus.PENDING, note="Commande recue, en attente de verification", changed_by_user_id=current_user.id,
    ))
    db.add(AuditLog(user_id=current_user.id, establishment_id=establishment_id,
                     action="create_reservation", details="Demande: " + ", ".join(details_parts)))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.patch("/reservations/{reservation_id}/review", response_model=ReservationOut, dependencies=[_PHARMACY_ONLY])
def review_reservation(reservation_id: str, payload: ReservationReview, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """NOUVEAU: le pharmacien verifie disponibilite/prix LIGNE PAR LIGNE
    (une ligne peut etre en rupture alors qu'une autre est disponible) et
    transmet une proposition finale au patient."""
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or reservation.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seule une commande en attente peut etre verifiee")

    items_by_id = {item.id: item for item in reservation.items}
    reviewed_ids = {line.item_id for line in payload.items}
    if reviewed_ids != set(items_by_id.keys()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Toutes les lignes de la commande doivent etre verifiees (aucune omise, aucune inconnue)",
        )

    for line in payload.items:
        item = items_by_id[line.item_id]
        stock_item = db.query(PharmacyStock).filter(PharmacyStock.id == item.medication_id).first()
        if stock_item and line.confirmed_quantity > stock_item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Quantite proposee superieure au stock disponible pour {stock_item.medication_name}",
            )
        item.confirmed_quantity = line.confirmed_quantity
        item.confirmed_unit_price = line.confirmed_unit_price
        item.stock_status = line.stock_status

    reservation.pharmacist_note = payload.note
    reservation.status = ReservationStatus.AWAITING_CONFIRMATION

    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=ReservationStatus.AWAITING_CONFIRMATION, note=payload.note, changed_by_user_id=current_user.id,
    ))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.post("/reservations/{reservation_id}/confirm", response_model=ReservationOut)
def confirm_reservation(reservation_id: str, db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """
    NOUVEAU: le patient accepte la proposition du pharmacien. C'EST LE SEUL
    ENDROIT DE TOUT LE CODE ou le stock est decompte - garantit qu'il n'y a
    aucun risque de double-decompte via un autre chemin. Decompte
    desormais LIGNE PAR LIGNE (une ligne = un medicament).
    """
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or not patient or reservation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    if reservation.status != ReservationStatus.AWAITING_CONFIRMATION:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette commande n'attend pas de confirmation")

    # On verifie TOUT le stock d'abord, avant de decompter quoi que ce soit -
    # evite de decompter la moitie des lignes puis d'echouer sur la derniere.
    stock_items: dict[str, PharmacyStock] = {}
    for item in reservation.items:
        stock_item = db.query(PharmacyStock).filter(PharmacyStock.id == item.medication_id).first()
        if not stock_item or item.confirmed_quantity is None or stock_item.quantity < item.confirmed_quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stock insuffisant pour {stock_item.medication_name if stock_item else 'un article'}, contacte la pharmacie",
            )
        stock_items[item.id] = stock_item

    for item in reservation.items:
        stock_items[item.id].quantity -= item.confirmed_quantity
        item.quantity = item.confirmed_quantity
        # NOUVEAU: ferme la lacune identifiee dans l'audit du cahier des
        # charges - alert_threshold existait deja mais rien ne se
        # declenchait dessus. Alerte uniquement au moment ou le stock
        # FRANCHIT le seuil (evite le spam si deja bas avant cette commande).
        stock = stock_items[item.id]
        if stock.quantity <= stock.alert_threshold and (stock.quantity + item.confirmed_quantity) > stock.alert_threshold:
            create_stock_alert(db, reservation.establishment_id, stock.medication_name, stock.quantity, stock.alert_threshold)
    reservation.status = ReservationStatus.CONFIRMED

    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=ReservationStatus.CONFIRMED, note="Confirmee par le patient", changed_by_user_id=current_user.id,
    ))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.post("/reservations/{reservation_id}/pay", response_model=ReservationOut)
def pay_reservation(reservation_id: str, db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """
    NOUVEAU (demande M. Faustin): paiement en ligne d'une commande, requis
    UNIQUEMENT si livraison (le patient qui retire sur place paie
    directement a la pharmacie, pas ici). La pharmacie ne doit PAS pouvoir
    commencer la preparation d'une commande a livrer tant qu'elle n'est
    pas payee - ce verrou est applique ici ET cote pharmacien (voir
    update_reservation_status), pas seulement dans l'interface.

    ATTENTION HONNETE: aucune vraie passerelle de paiement (Mobile Money,
    carte bancaire) n'est branchee ici - cet endpoint enregistre une
    AUTO-DECLARATION du patient, pas un encaissement reellement verifie
    par un prestataire tiers. A completer le jour ou un vrai prestataire
    de paiement est choisi.
    """
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or not patient or reservation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    if reservation.delivery_mode != DeliveryMode.DELIVERY:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Le paiement en ligne n'est requis que pour une livraison")
    if reservation.status not in (ReservationStatus.CONFIRMED,):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette commande doit d'abord etre confirmee avant paiement")
    if reservation.is_paid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette commande est deja payee")

    reservation.is_paid = True
    reservation.paid_at = datetime.utcnow()
    db.add(AuditLog(user_id=current_user.id, establishment_id=reservation.establishment_id,
                     action="pay_pharmacy_order", details=f"Commande {reservation.id} declaree payee par le patient"))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.post("/reservations/{reservation_id}/reject", response_model=ReservationOut)
def reject_reservation(reservation_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """NOUVEAU: le patient refuse la proposition - aucun impact sur le stock, jamais touche."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or not patient or reservation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    if reservation.status != ReservationStatus.AWAITING_CONFIRMATION:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette commande n'attend pas de confirmation")

    reservation.status = ReservationStatus.CANCELLED
    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=ReservationStatus.CANCELLED, note="Refusee par le patient", changed_by_user_id=current_user.id,
    ))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.post("/reservations/{reservation_id}/mark-received", response_model=ReservationOut)
def mark_received(reservation_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(UserRole.PATIENT))):
    """NOUVEAU: le patient confirme avoir recu sa commande (retrait sur place
    une fois 'prete', ou livraison une fois 'en livraison')."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or not patient or reservation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    if reservation.status not in (ReservationStatus.READY, ReservationStatus.OUT_FOR_DELIVERY):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette commande n'est pas encore prete a etre recuperee ou livree",
        )

    reservation.status = ReservationStatus.DELIVERED
    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=ReservationStatus.DELIVERED, note="Reception confirmee par le patient", changed_by_user_id=current_user.id,
    ))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.patch("/reservations/{reservation_id}/status", response_model=ReservationOut, dependencies=[_PHARMACY_ONLY])
def update_reservation_status(reservation_id: str, payload: ReservationStatusUpdate, db: Session = Depends(get_db),
                               current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """
    Suite du parcours APRES confirmation (preparation, prete, livree...).
    Les statuts geres par les nouveaux endpoints dedies (/review, /confirm,
    /reject) sont desormais refuses ici, pour eviter tout chemin parallele
    vers un decompte de stock incorrect.
    """
    if payload.status in PROTECTED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce statut se gere via la verification pharmacien (bouton dedie), pas ici.",
        )

    reservation = db.query(PharmacyReservation).filter(PharmacyReservation.id == reservation_id).first()
    if not reservation or reservation.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation introuvable")
    if reservation.status not in (ReservationStatus.CONFIRMED, ReservationStatus.PREPARING, ReservationStatus.READY, ReservationStatus.OUT_FOR_DELIVERY):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette commande doit d'abord etre confirmee par le patient")

    # NOUVEAU (demande M. Faustin): verrou REEL, pas seulement une
    # indication cote interface - la pharmacie ne peut pas commencer a
    # preparer une commande a LIVRER tant qu'elle n'est pas payee. Aucune
    # restriction pour un retrait sur place (paiement direct a la pharmacie).
    if (
        reservation.delivery_mode == DeliveryMode.DELIVERY
        and not reservation.is_paid
        and payload.status in (ReservationStatus.PREPARING, ReservationStatus.READY, ReservationStatus.OUT_FOR_DELIVERY)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette commande a livrer doit d'abord etre payee par le patient avant preparation.",
        )

    reservation.status = payload.status
    if payload.estimated_ready_at is not None:
        reservation.estimated_ready_at = payload.estimated_ready_at
    if payload.note is not None:
        reservation.pharmacist_note = payload.note

    db.add(PharmacyReservationStatusHistory(
        id=str(uuid.uuid4()), reservation_id=reservation.id,
        status=payload.status, note=payload.note, changed_by_user_id=current_user.id,
    ))
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation, db)


@router.get("/reports", response_model=PharmacyReportOut, dependencies=[_PHARMACY_ONLY])
def pharmacy_reports(db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles(UserRole.ESTABLISHMENT_ADMIN, UserRole.PHARMACIST))):
    """
    NOUVEAU (demande explicite de M. Faustin: "au niveau de rapport, est-ce
    qu'on peut mettre autre chose la?"). Le rapport generique "revenu par
    departement" affiche jusqu'ici a une pharmacie n'avait aucun sens
    (pas de departements medicaux dans une pharmacie) - remplace ici par
    un rapport reellement utile: chiffre d'affaires des 30 derniers jours,
    et lots proches de la peremption (directement lie au nouveau systeme
    d'Inventaire).
    """
    establishment_id = current_user.establishment_id

    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).date()
    delivered_orders = (
        db.query(PharmacyReservation)
        .filter(
            PharmacyReservation.establishment_id == establishment_id,
            PharmacyReservation.status == ReservationStatus.DELIVERED,
            PharmacyReservation.created_at >= thirty_days_ago,
        )
        .all()
    )
    revenue_by_day: dict = {}
    for order in delivered_orders:
        items = db.query(PharmacyOrderItem).filter(PharmacyOrderItem.reservation_id == order.id).all()
        if items and all(i.confirmed_quantity is not None and i.confirmed_unit_price is not None for i in items):
            day = order.created_at.date()
            revenue_by_day[day] = revenue_by_day.get(day, 0.0) + sum(i.confirmed_quantity * i.confirmed_unit_price for i in items)

    daily_revenue = [
        PharmacyDailyRevenueOut(date=day, revenue=revenue)
        for day, revenue in sorted(revenue_by_day.items())
    ]

    expiring_batches = (
        db.query(PharmacyStockBatch)
        .join(PharmacyStock, PharmacyStock.id == PharmacyStockBatch.stock_item_id)
        .filter(
            PharmacyStock.establishment_id == establishment_id,
            PharmacyStockBatch.expiration_date <= (datetime.utcnow().date() + timedelta(days=PHARMACY_EXPIRY_WARNING_DAYS)),
        )
        .order_by(PharmacyStockBatch.expiration_date.asc())
        .all()
    )

    return PharmacyReportOut(
        daily_revenue=daily_revenue,
        expiring_batches=[_to_batch_out(b, b.stock_item) for b in expiring_batches],
    )

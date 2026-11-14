"""
Point d'entree de l'API backend SpeedSanté+ - Plateforme SaaS Medicale.

Lancement local: uvicorn app.main:app --reload
Voir README.md a la racine du projet pour l'installation complete, et
docs/EXPLOITATION.md pour l'exploitation (deploiement, sauvegardes, incidents).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, engine
from app.observability import RequestContextMiddleware, configure_logging
from app.schema_status import get_schema_status
from app.routers import auth, establishments, doctors, appointments, pharmacy, dashboard, health_records, lab, messages, audit, patients, users, opening_hours, platform, services, lab_catalog, support, admissions, billing, notifications, inventory, scheduling, equipment, suppliers
from app.routers import settings as settings_router

settings = get_settings()
# Journaux JSON en production (analysables); texte lisible en developpement.
configure_logging(settings.log_level, json_logs=settings.is_production)
logger = logging.getLogger("lgp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    fatal, warnings = settings.security_problems()
    for warning in warnings:
        logger.warning("Configuration: %s", warning)
    if fatal:
        for problem in fatal:
            logger.critical("Configuration refusee: %s", problem)
        raise RuntimeError("Configuration dangereuse refusee au demarrage: " + " | ".join(fatal))

    try:
        if settings.auto_create_tables:
            # Cree uniquement les tables MANQUANTES (ne modifie jamais une table existante).
            # Les changements de colonnes passent par les migrations (alembic/).
            Base.metadata.create_all(bind=engine)
    except Exception as exc:  # noqa: BLE001
        logger.critical("Base de donnees injoignable au demarrage (%s). Arret.", type(exc).__name__)
        raise

    if settings.run_migrations:
        from app.migrate import run_migrations
        run_migrations(engine)

    app.state.schema_status = get_schema_status(engine)
    if app.state.schema_status["state"] in ("behind", "unversioned"):
        logger.warning("Schema de la base: %s (voir docs/EXPLOITATION.md, section Migrations)", app.state.schema_status)
    logger.info("Application demarree (environnement=%s)", settings.environment)
    yield
    # Ferme proprement les connexions PostgreSQL a l'arret (inutile pour SQLite, utilise en tests).
    if engine.dialect.name != "sqlite":
        engine.dispose()


app = FastAPI(
    title="SpeedSanté+ - Plateforme SaaS Médicale",
    description="API multi-tenant: gestion hospitalière, rendez-vous, pharmacie.",
    version="1.1.0",
    lifespan=lifespan,
    # Documentation interactive desactivee en production par securite
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# Ordre: le DERNIER middleware ajoute est le plus exterieur. Le CORS doit etre a
# l'exterieur de RequestContextMiddleware pour que meme les reponses d'erreur
# (500, 503, 413) portent les en-tetes CORS: sans cela le navigateur affiche une
# erreur reseau opaque au lieu du vrai message.
app.add_middleware(
    RequestContextMiddleware,
    is_production=settings.is_production,
    max_request_bytes=settings.max_request_bytes,
)
# CORS: uniquement les origines explicitement listees dans .env (CORS_ORIGINS).
# PUT etait absent: la page "Parametres de la plateforme" (PUT /settings) etait
# bloquee par le navigateur. tests/test_cors.py verifie que TOUTES les methodes
# utilisees par les routes sont autorisees, pour que cet oubli ne puisse plus se reproduire.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Client-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,
)

app.include_router(auth.router)
app.include_router(establishments.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(pharmacy.router)
app.include_router(dashboard.router)
app.include_router(health_records.router)
app.include_router(lab.router)
app.include_router(messages.router)
app.include_router(audit.router)
app.include_router(patients.router)
app.include_router(users.router)
app.include_router(opening_hours.router)
app.include_router(platform.router)
app.include_router(services.router)
app.include_router(settings_router.router)
app.include_router(lab_catalog.router)
app.include_router(support.router)
app.include_router(admissions.router)
app.include_router(billing.router)
app.include_router(notifications.router)
app.include_router(inventory.router)
app.include_router(scheduling.router)
app.include_router(equipment.router)
app.include_router(suppliers.router)


@app.get("/health/live", include_in_schema=False)
def health_live():
    """Le processus repond. Ne depend de rien d'autre (ni base, ni reseau)."""
    return {"status": "ok"}


@app.get("/health", include_in_schema=False)
def health_check():
    """
    Etat REEL du service: interroge la base de donnees. Repond 503 si elle est
    injoignable (avant, ce point repondait "ok" meme base eteinte, donc la
    surveillance ne pouvait detecter aucune panne).
    "schema" indique si les migrations de la base sont a jour (information
    seulement: ne change jamais le code de reponse).
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        logger.error("Verification de sante: base injoignable (%s)", type(exc).__name__)
        return JSONResponse({"status": "unavailable", "database": "unreachable"}, status_code=503)
    schema = getattr(app.state, "schema_status", {"state": "unknown"})
    return {"status": "ok", "database": "ok", "schema": schema["state"]}

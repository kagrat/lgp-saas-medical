"""
Point d'entree de l'API backend LGP HOLDINGS - Plateforme SaaS Medicale.

Lancement local: uvicorn app.main:app --reload
Voir README.md a la racine du projet pour l'installation complete.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, establishments, doctors, appointments, pharmacy, dashboard, health_records, lab, messages, audit, patients, users, opening_hours, platform, services, settings, lab_catalog
settings = get_settings()

app = FastAPI(
    title="LGP HOLDINGS - Plateforme SaaS Medicale",
    description="API multi-tenant: gestion hospitaliere, rendez-vous, pharmacie.",
    version="1.0.0",
    # Documentation interactive desactivee en production par securite
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# CORS: uniquement les origines explicitement listees dans .env (CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Client-Type"],
)


@app.on_event("startup")
def on_startup():
    # En production: utiliser Alembic pour les migrations plutot que create_all.
    # create_all() est pratique pour demarrer vite en developpement/MVP.
    Base.metadata.create_all(bind=engine)


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
app.include_router(settings.router)
app.include_router(lab_catalog.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}

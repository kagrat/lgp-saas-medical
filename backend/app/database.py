import logging

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("lgp.database")

# Une requete SQL qui depasse cette duree est interrompue par PostgreSQL: une
# requete anormale (boucle, jointure geante) ne peut plus bloquer le serveur.
STATEMENT_TIMEOUT_MS = 30_000


def normalize_database_url(url: str) -> str:
    """
    Railway fournit souvent DATABASE_URL sous la forme "postgresql://..." (ou
    "postgres://..."). Seul le pilote pg8000 est installe: sans le prefixe
    "+pg8000", SQLAlchemy cherche un pilote absent et le serveur ne demarre pas.
    On accepte donc les deux ecritures.
    """
    parsed = make_url(url)
    if parsed.drivername in ("postgres", "postgresql"):
        parsed = parsed.set(drivername="postgresql+pg8000")
    return parsed.render_as_string(hide_password=False)


DATABASE_URL = normalize_database_url(settings.database_url)
_is_postgres = DATABASE_URL.startswith("postgresql")

_engine_options: dict = {"pool_pre_ping": True}
if _is_postgres:
    _engine_options.update(
        pool_size=5,          # connexions gardees ouvertes
        max_overflow=10,      # connexions supplementaires en cas de pic
        pool_timeout=10,      # attente max d'une connexion libre avant erreur 503 (au lieu d'attendre indefiniment)
        pool_recycle=1800,    # renouvelle les connexions de plus de 30 min (coupures reseau, pare-feu)
    )

engine = create_engine(DATABASE_URL, **_engine_options)

if _is_postgres:
    @event.listens_for(engine, "connect")
    def _set_statement_timeout(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency FastAPI: fournit une session DB et la ferme systematiquement."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

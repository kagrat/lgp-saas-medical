from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import get_settings

settings = get_settings()

# pool_pre_ping evite les connexions mortes (utile sur Railway/VPS avec coupures)
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency FastAPI: fournit une session DB et la ferme systematiquement."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

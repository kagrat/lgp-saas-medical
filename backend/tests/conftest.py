"""
Configuration pytest: base SQLite en memoire, isolee de la vraie base
PostgreSQL de production. Chaque test repart d'une base vide.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-for-production-0123456789")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app import security
from app.database import Base, get_db
from app.main import app
from app.ratelimit import limiter
from tests.helpers import World

# Hachage bcrypt volontairement leger EN TEST uniquement (4 tours au lieu de 12):
# sans cela chaque connexion simulee coute ~250 ms. La production garde 12 tours.
security._BCRYPT_ROUNDS = 4
security._DUMMY_HASH = security.hash_password("mot-de-passe-factice")

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Les compteurs de debit sont en memoire: on les remet a zero entre deux tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def world(db_session):
    """Fabrique de donnees de test (etablissements, medecins, patients, jetons)."""
    return World(db_session)

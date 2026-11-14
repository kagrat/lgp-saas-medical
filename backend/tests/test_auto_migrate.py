"""Migration automatique au demarrage (RUN_MIGRATIONS=true): rattachement d'une base historique, puis mise a niveau. Necessite PostgreSQL."""
import os
import pathlib
import subprocess
import sys

import pytest
from sqlalchemy import create_engine, text

from app.database import normalize_database_url

PG = normalize_database_url(os.environ["TEST_POSTGRES_URL"]) if os.environ.get("TEST_POSTGRES_URL") else None
ROOT = pathlib.Path(__file__).resolve().parent.parent
pytestmark = pytest.mark.skipif(not PG, reason="TEST_POSTGRES_URL non defini (PostgreSQL requis)")

SCRIPT = """
import app.models
from app.database import Base, engine
from app.indexes import HOT_INDEXES, index_name
from sqlalchemy import text
from app.migrate import run_migrations
import sys
if sys.argv[1] == "legacy":
    Base.metadata.create_all(engine)
    with engine.begin() as c:   # simule la base de production d'avant les index
        for t, cols in HOT_INDEXES: c.execute(text('DROP INDEX IF EXISTS "%s"' % index_name(t, cols)))
print("OK" if run_migrations(engine) else "FAIL")
"""


def _fresh(name):
    admin = create_engine(PG, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f"DROP DATABASE IF EXISTS {name}"))
        c.execute(text(f"CREATE DATABASE {name}"))
    return PG.rsplit("/", 1)[0] + "/" + name


def _run(url, mode):
    env = {**os.environ, "DATABASE_URL": url}
    return subprocess.run([sys.executable, "-c", SCRIPT, mode], cwd=ROOT, env=env, capture_output=True, text=True)


def test_base_historique_est_rattachee_puis_mise_a_niveau():
    url = _fresh("lgp_automigrate_legacy")
    r = _run(url, "legacy")
    assert r.stdout.strip().endswith("OK"), r.stderr[-600:]
    with create_engine(url).connect() as c:
        assert c.execute(text("select version_num from alembic_version")).scalar() == "0003"
        assert c.execute(text("select count(*) from pg_indexes where indexname='ix_appointments_patient_id'")).scalar() == 1
    assert _run(url, "again").stdout.strip().endswith("OK"), "rejouable sans erreur"


def test_base_vierge_est_migree():
    url = _fresh("lgp_automigrate_fresh")
    assert _run(url, "fresh").stdout.strip().endswith("OK")
    with create_engine(url).connect() as c:
        assert c.execute(text("select version_num from alembic_version")).scalar() == "0003"

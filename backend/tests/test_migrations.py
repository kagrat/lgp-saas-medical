"""
Migrations: la liste figee de la migration 0002 doit rester identique a celle du code;
le cycle complet (base vierge -> upgrade -> aucune derive) est joue sur un VRAI PostgreSQL
quand TEST_POSTGRES_URL est defini (CI), et ignore sinon.
"""
import importlib.util
import os
import pathlib
import subprocess
import sys

import pytest
from sqlalchemy import create_engine, text

from app.indexes import HOT_INDEXES

ROOT = pathlib.Path(__file__).resolve().parent.parent
from app.database import normalize_database_url

PG = normalize_database_url(os.environ["TEST_POSTGRES_URL"]) if os.environ.get("TEST_POSTGRES_URL") else None


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "alembic" / "versions" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_migration_0002_copie_figee_identique_a_la_liste_du_code():
    assert _load("0002_performance_indexes").INDEXES == HOT_INDEXES


def test_chaine_de_migrations_lineaire():
    m1, m2, m3 = _load("0001_baseline"), _load("0002_performance_indexes"), _load("0003_notification_links")
    assert m1.down_revision is None and m2.down_revision == m1.revision and m3.down_revision == m2.revision


def test_chaque_index_cible_une_colonne_existante():
    import app.models  # noqa: F401
    from app.database import Base
    for table, cols in HOT_INDEXES:
        assert table in Base.metadata.tables, table
        assert all(c in Base.metadata.tables[table].c for c in cols), (table, cols)


def _run(*args, url):
    env = {**os.environ, "DATABASE_URL": url}
    return subprocess.run([sys.executable, *args], cwd=ROOT, env=env, capture_output=True, text=True)


@pytest.mark.skipif(not PG, reason="TEST_POSTGRES_URL non defini (PostgreSQL requis)")
def test_postgres_base_vierge_upgrade_puis_aucune_derive():
    admin = create_engine(PG, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text("DROP DATABASE IF EXISTS lgp_migration_test"))
        c.execute(text("CREATE DATABASE lgp_migration_test"))
    url = PG.rsplit("/", 1)[0] + "/lgp_migration_test"
    up = _run("-m", "alembic", "upgrade", "head", url=url)
    assert up.returncode == 0, up.stderr[-800:]
    drift = _run("scripts/schema_drift.py", url=url)
    assert drift.returncode == 0, drift.stdout[-800:]
    with create_engine(url).connect() as c:
        assert c.execute(text("select count(*) from pg_indexes where indexname like 'ix_appointments_%'")).scalar() >= 3
    # idempotence: rejouer ne casse rien
    assert _run("-m", "alembic", "upgrade", "head", url=url).returncode == 0

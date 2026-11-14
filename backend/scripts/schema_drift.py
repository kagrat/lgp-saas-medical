"""
Detecte les ecarts entre la base reelle et les modeles du code (lecture seule).

    python scripts/schema_drift.py            # utilise DATABASE_URL
Code de sortie: 0 = identique, 1 = ecarts (liste affichee), 2 = base injoignable.
A lancer apres chaque deploiement (ou dans la CI): c'est ce qui aurait signale
tout de suite une migration SQL oubliee.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.autogenerate import compare_metadata  # noqa: E402
from alembic.migration import MigrationContext  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import Base, normalize_database_url  # noqa: E402
import app.models  # noqa: E402,F401


def main() -> int:
    engine = create_engine(normalize_database_url(get_settings().database_url))
    try:
        with engine.connect() as conn:
            diffs = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    except SQLAlchemyError as exc:
        print(f"Base injoignable: {exc.__class__.__name__}")
        return 2
    if not diffs:
        print("OK: la base correspond exactement aux modeles.")
        return 0
    print(f"{len(diffs)} ecart(s) entre la base et les modeles:")
    for d in diffs:
        print(" -", str(d if not isinstance(d, list) else d[0])[:160])
    return 1


if __name__ == "__main__":
    sys.exit(main())

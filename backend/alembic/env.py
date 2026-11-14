"""
Environnement Alembic: les migrations utilisent la MEME adresse de base et les
MEMES modeles que l'application (aucune configuration en double).
"""
from alembic import context
from sqlalchemy import create_engine, pool

from app.config import get_settings
from app.database import Base, normalize_database_url
import app.models  # noqa: F401  (enregistre toutes les tables dans Base.metadata)

config = context.config
target_metadata = Base.metadata
URL = normalize_database_url(get_settings().database_url)


def run_migrations_offline() -> None:
    context.configure(url=URL, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(URL, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

"""
Application automatique des migrations au demarrage (option RUN_MIGRATIONS=true).

Comportement, pense pour ne JAMAIS aggraver une situation:
  - un verrou PostgreSQL (advisory lock) empeche deux serveurs de migrer en meme temps;
  - base historique deja remplie mais jamais rattachee a Alembic: on la rattache
    d'abord a la migration de base 0001 ("stamp", ne modifie aucune donnee), puis on
    applique les migrations suivantes (index, ...);
  - base vierge ou deja suivie: simple "upgrade head";
  - en cas d'echec: l'erreur est journalisee et le serveur DEMARRE quand meme sur
    l'ancien schema (un service degrade vaut mieux qu'un service arrete); /health
    signale alors schema = "behind".
"""
import logging
from pathlib import Path

from sqlalchemy import inspect, text

logger = logging.getLogger("lgp.migrate")

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_LOCK_ID = 7_426_001  # identifiant arbitraire, propre a cette application


def _config():
    from alembic.config import Config

    config = Config(str(_BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    return config


def run_migrations(engine) -> bool:
    """Retourne True si la base est a jour a la fin, False sinon (sans jamais lever d'exception)."""
    from alembic import command

    try:
        config = _config()
        with engine.connect() as lock_conn:
            if engine.dialect.name == "postgresql":
                lock_conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _LOCK_ID})
            try:
                inspector = inspect(lock_conn)
                if not inspector.has_table("alembic_version") and inspector.has_table("establishments"):
                    logger.warning("Base historique detectee: rattachement a la migration de base 0001 (stamp).")
                    command.stamp(config, "0001")
                command.upgrade(config, "head")
            finally:
                if engine.dialect.name == "postgresql":
                    lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _LOCK_ID})
                    lock_conn.commit()
        logger.info("Migrations appliquees: base a jour.")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Echec des migrations (%s): le serveur demarre sur l'ancien schema.", type(exc).__name__, exc_info=True)
        return False

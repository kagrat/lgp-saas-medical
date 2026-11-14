"""
Etat des migrations de la base: la base est-elle a la version attendue par le code ?

Lecture seule, rapide (une requete). Resultat:
  ok          la base est a la derniere migration Alembic
  behind      la base est en retard: il manque des migrations (alembic upgrade head)
  unversioned la base n'a pas encore ete rattachee a Alembic (alembic stamp, voir
              docs/EXPLOITATION.md)
  unknown     impossible de le determiner (Alembic absent ou erreur)
Ne bloque jamais le demarrage: c'est une information, affichee par /health et
ecrite dans les journaux.
"""
import logging
from pathlib import Path

from sqlalchemy import inspect, text

logger = logging.getLogger("lgp.schema")

_BACKEND_DIR = Path(__file__).resolve().parent.parent


def get_schema_status(engine) -> dict:
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        ini = _BACKEND_DIR / "alembic.ini"
        if not ini.exists():
            return {"state": "unknown", "detail": "alembic non configure"}
        config = Config(str(ini))
        config.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
        head = ScriptDirectory.from_config(config).get_current_head()
        with engine.connect() as connection:
            if not inspect(connection).has_table("alembic_version"):
                return {"state": "unversioned", "head": head}
            current = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        return {"state": "ok" if current == head else "behind", "current": current, "head": head}
    except Exception as exc:  # noqa: BLE001 - ne doit jamais empecher le demarrage
        logger.warning("Etat du schema indeterminable: %s", type(exc).__name__)
        return {"state": "unknown", "detail": type(exc).__name__}

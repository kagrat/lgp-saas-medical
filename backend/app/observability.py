"""
Exploitation: journaux structures, identifiant de requete, en-tetes de securite,
gestion des erreurs et limite de taille des requetes.

Principes:
  - Chaque requete recoit un identifiant (X-Request-ID). Il apparait dans la
    reponse ET dans chaque ligne de journal: "ca a plante, ref xxxx" suffit
    pour retrouver la cause exacte.
  - Une erreur inattendue ne revele JAMAIS de detail technique a l'utilisateur
    (pas de trace, pas de nom de table): il recoit une reference; la trace
    complete est dans les journaux.
  - Aucune donnee sensible n'est journalisee: ni mot de passe, ni jeton, ni
    contenu de requete, ni parametres d'URL (ils peuvent contenir un jeton).
  - Base de donnees injoignable = reponse 503 "reessaie dans un instant", pas
    une erreur 500 opaque.
"""
import json
import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError, TimeoutError as PoolTimeoutError
from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9\-]{8,64}$")
# Chemins dont la reponse n'est pas du JSON pur (documentation interactive).
_DOC_PATHS = ("/docs", "/redoc", "/openapi.json")
# Verifications de sante frequentes: pas de ligne de journal pour ne pas noyer les vraies.
_QUIET_PATHS = ("/health/live",)


# --------------------------------------------------------------------------
# Journaux
# --------------------------------------------------------------------------
class JsonFormatter(logging.Formatter):
    """Une ligne JSON par evenement: filtrable et analysable (Railway, Datadog, Grafana...)."""

    _EXTRA_FIELDS = ("method", "path", "status", "duration_ms", "error_type")

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        for field in self._EXTRA_FIELDS:
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


class _TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        record.request_id = request_id_var.get()
        return super().format(record)


def configure_logging(level: str = "INFO", json_logs: bool = True) -> None:
    """Configure le journal racine (sortie standard). Idempotent."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if json_logs else _TextFormatter("%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # Le journal d'acces de uvicorn fait doublon avec le notre (et expose les URL completes).
    access = logging.getLogger("uvicorn.access")
    access.handlers[:] = []
    access.propagate = False
    access.setLevel(logging.CRITICAL)
    logging.getLogger("uvicorn.error").propagate = True
    # Bibliotheques bavardes: seuls leurs avertissements et erreurs nous interessent.
    for noisy in ("alembic", "httpx", "httpcore", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


logger = logging.getLogger("lgp.http")


# --------------------------------------------------------------------------
# En-tetes de securite
# --------------------------------------------------------------------------
def security_headers(path: str, is_production: bool) -> dict[str, str]:
    headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
        # Reponses medicales: ni le navigateur ni un intermediaire ne doivent les garder en cache.
        "Cache-Control": "no-store",
    }
    if path not in _DOC_PATHS:
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if is_production:
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return headers


# --------------------------------------------------------------------------
# Middleware ASGI
# --------------------------------------------------------------------------
class RequestTooLarge(Exception):
    pass


def _is_database_unavailable(exc: BaseException) -> bool:
    return isinstance(exc, (OperationalError, InterfaceError, PoolTimeoutError)) or (
        isinstance(exc, DBAPIError) and exc.connection_invalidated
    )


class RequestContextMiddleware:
    """Identifiant de requete, en-tetes de securite, limite de taille, journal d'acces, erreurs propres."""

    def __init__(self, app, *, is_production: bool, max_request_bytes: int):
        self.app = app
        self.is_production = is_production
        self.max_request_bytes = max_request_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        inbound = raw_headers.get("x-request-id", "")
        request_id = inbound if _REQUEST_ID_PATTERN.match(inbound) else uuid.uuid4().hex
        request_id_var.set(request_id)

        path, method = scope["path"], scope["method"]
        state = {"status": 500, "started": False}
        started_at = time.perf_counter()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                state["status"], state["started"] = message["status"], True
                headers = MutableHeaders(scope=message)
                for name, value in security_headers(path, self.is_production).items():
                    if name not in headers:
                        headers[name] = value
                headers["X-Request-ID"] = request_id
            await send(message)

        received = {"bytes": 0}

        async def limited_receive():
            message = await receive()
            if message["type"] == "http.request":
                received["bytes"] += len(message.get("body", b""))
                if received["bytes"] > self.max_request_bytes:
                    raise RequestTooLarge()
            return message

        declared = raw_headers.get("content-length")
        try:
            if declared and declared.isdigit() and int(declared) > self.max_request_bytes:
                raise RequestTooLarge()
            await self.app(scope, limited_receive, send_wrapper)
        except RequestTooLarge:
            logger.warning("Requete refusee: corps trop volumineux", extra={"method": method, "path": path})
            if not state["started"]:
                state["status"] = 413
                await JSONResponse({"detail": "Le contenu envoye est trop volumineux."}, status_code=413)(scope, receive, send_wrapper)
        except Exception as exc:  # noqa: BLE001 - dernier filet de securite, tout est journalise
            if _is_database_unavailable(exc):
                logger.error("Base de donnees indisponible", extra={"method": method, "path": path, "error_type": type(exc).__name__})
                status, body, extra_headers = 503, {"detail": "Service momentanement indisponible. Reessaie dans un instant."}, {"Retry-After": "5"}
            else:
                logger.exception("Erreur interne non geree", extra={"method": method, "path": path, "error_type": type(exc).__name__})
                status, body, extra_headers = 500, {"detail": f"Erreur interne. Si le probleme persiste, communique cette reference: {request_id}"}, {}
            if not state["started"]:
                state["status"] = status
                await JSONResponse(body, status_code=status, headers=extra_headers)(scope, receive, send_wrapper)
        finally:
            if path not in _QUIET_PATHS:
                status = state["status"]
                level = logging.ERROR if status >= 500 else logging.INFO
                logger.log(level, f"{method} {path} -> {status}", extra={
                    "method": method, "path": path, "status": status,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 1),
                })

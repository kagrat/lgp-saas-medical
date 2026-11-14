"""
Limitation de debit (rate limiting) des endpoints publics.

Pourquoi: un endpoint ouvert a tous (connexion, inscription, mot de passe
oublie, commande sans compte, recherche) peut etre appele des milliers de fois
par un script: creation massive de comptes, saturation de la base, envoi
d'e-mails a la chaine, devinette de mots de passe ou de codes.

Principe: fenetre glissante. On garde, par cle (ex: "login:203.0.113.7"), la
liste des instants des derniers appels; au-dela du plafond, la requete recoit
429 "Trop de requetes" avec l'en-tete Retry-After.

LIMITE ASSUMEE (voir docs/EXPLOITATION.md): les compteurs sont gardes en
memoire, DANS CE PROCESSUS. Avec un seul serveur (cas actuel sur Railway:
1 replica) c'est exact. Si le service passe a plusieurs replicas, chacun a son
propre compteur (le plafond effectif est multiplie): il faudra alors un compteur
partage (Redis). Les compteurs sont remis a zero a chaque redemarrage; les
protections qui DOIVENT survivre (verrouillage de compte apres 5 echecs,
plafond de commandes par telephone) sont, elles, enregistrees en base.
"""
import hashlib
import ipaddress
import threading
import time
from collections import deque
from typing import Optional

from fastapi import HTTPException, Request, status

from app.config import get_settings


class SlidingWindowLimiter:
    def __init__(self, max_keys: int = 100_000):
        self._events: dict[str, deque] = {}
        self._lock = threading.Lock()
        self._max_keys = max_keys

    def allow(self, key: str, limit: int, window_seconds: float) -> tuple[bool, int]:
        """Enregistre un appel s'il reste de la place. Retourne (autorise, secondes_avant_nouvel_essai).
        Un appel REFUSE n'est pas compte: un visiteur legitime qui reessaie ne prolonge pas son propre blocage."""
        now = time.monotonic()
        with self._lock:
            events = self._events.get(key)
            if events is None:
                if len(self._events) >= self._max_keys:
                    self._evict(now)
                events = self._events[key] = deque()
            cutoff = now - window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int(events[0] + window_seconds - now) + 1)
                return False, retry_after
            events.append(now)
            return True, 0

    def reset(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._events.clear()
            else:
                self._events.pop(key, None)

    def _evict(self, now: float) -> None:
        """Garde la memoire bornee face a un attaquant qui change de cle a chaque appel."""
        for k in [k for k, ev in self._events.items() if not ev or ev[-1] < now - 3600]:
            del self._events[k]
        if len(self._events) >= self._max_keys:
            oldest_first = sorted(self._events, key=lambda k: self._events[k][-1] if self._events[k] else 0)
            for k in oldest_first[: self._max_keys // 5]:
                del self._events[k]


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    """
    Adresse du VRAI visiteur. Derriere un proxy (Railway), l'adresse vue par
    l'application est celle du proxy; l'adresse du visiteur est dans
    X-Forwarded-For. Ce en-tete peut etre FALSIFIE par le visiteur (il ajoute
    ses propres valeurs au debut), seule la valeur ajoutee par NOTRE proxy est
    fiable: on lit donc depuis la FIN, a la position TRUSTED_PROXY_HOPS.
    """
    hops = get_settings().trusted_proxy_hops
    forwarded = request.headers.get("x-forwarded-for", "")
    candidate = None
    if hops > 0 and forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if len(parts) >= hops:
            candidate = parts[-hops]
    if candidate is None:
        candidate = request.client.host if request.client else "unknown"
    try:
        ip = ipaddress.ip_address(candidate)
    except ValueError:
        return "unknown"
    if ip.version == 6:
        # Un visiteur IPv6 dispose d'un bloc entier (/64): on limite par bloc, pas par adresse.
        return str(ipaddress.ip_network(f"{ip}/64", strict=False).network_address)
    return str(ip)


def hash_key(value: str) -> str:
    """Cle anonymisee (ex: e-mail ou telephone): le compteur ne garde jamais la donnee personnelle en clair."""
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()[:24]


def too_many(retry_after: int, message: str = "Trop de requêtes.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"{message} Réessaie dans {retry_after} seconde{'s' if retry_after > 1 else ''}.",
        headers={"Retry-After": str(retry_after)},
    )


def allow_key(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Comme limiter.allow, mais respecte RATE_LIMIT_ENABLED (pour les compteurs par e-mail / telephone)."""
    if not get_settings().rate_limit_enabled:
        return True, 0
    return limiter.allow(key, limit, window_seconds)


def rate_limit(name: str, limit: int, window_seconds: int):
    """Dependance FastAPI: au plus `limit` appels par `window_seconds` et par adresse IP."""
    def dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        allowed, retry_after = limiter.allow(f"{name}:{client_ip(request)}", limit, window_seconds)
        if not allowed:
            raise too_many(retry_after)
    return dependency

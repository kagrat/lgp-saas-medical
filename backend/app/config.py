"""
Configuration centrale de l'application.

Securite: aucune valeur secrete n'est codee en dur ici. Tout vient des
variables d'environnement (fichier .env en developpement, variables
d'environnement reelles en production - Railway/VPS).

Au demarrage, security_problems() controle que la configuration de production
est saine: une erreur GRAVE empeche le demarrage (mieux vaut ne pas demarrer
que tourner avec une faille), un simple AVERTISSEMENT est ecrit dans les
journaux sans rien bloquer.
"""
import os
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Algorithmes de signature acceptes pour les jetons. Une valeur exotique ou
# "none" dans JWT_ALGORITHM ouvrirait une faille: on refuse de demarrer.
ALLOWED_JWT_ALGORITHMS = ("HS256", "HS384", "HS512")

# Valeurs de remplacement de .env.example: ne doivent JAMAIS servir en production.
_PLACEHOLDER_SECRET_PREFIXES = ("change_me", "changeme", "test-secret", "secret", "password")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de donnees
    database_url: str

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    # SMS (Twilio - voir app/services/notifications.py::send_sms). Vide par
    # defaut = SMS silencieusement desactive (aucune erreur), tant que ces
    # 3 valeurs ne sont pas renseignees dans les variables d'environnement.
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    environment: str = "development"
    cors_origins: str = "http://localhost:5173"
    # URL de base du site web patient, pour construire le lien "mot de passe
    # oublie" envoye par e-mail. A definir en production (Railway) avec l'URL
    # Vercel reelle - ex: https://lgp-saas-medical.vercel.app
    frontend_url: str = "http://localhost:5173"

    # --- Exploitation (valeurs par defaut sures; voir docs/EXPLOITATION.md) ---
    # Niveau de detail des journaux: DEBUG, INFO, WARNING, ERROR.
    log_level: str = "INFO"
    # Limitation de debit des endpoints publics (connexion, inscription...).
    # A ne desactiver que pour des tests.
    rate_limit_enabled: bool = True
    # Nombre de serveurs intermediaires (proxys) entre Internet et l'application,
    # pour retrouver la VRAIE adresse IP du visiteur dans X-Forwarded-For.
    # Railway = 1. Si Cloudflare est ajoute devant Railway: 2.
    trusted_proxy_hops: int = 1
    # Creation automatique des tables manquantes au demarrage. Garder true tant
    # que les migrations Alembic ne sont pas adoptees; passer a false ensuite
    # (voir docs/EXPLOITATION.md, section "Migrations").
    auto_create_tables: bool = True
    # Applique automatiquement les migrations Alembic au demarrage (voir
    # app/migrate.py et docs/EXPLOITATION.md). Desactive par defaut: a activer
    # volontairement sur Railway une fois la sauvegarde de la base faite.
    run_migrations: bool = False
    # Taille maximale d'une requete (octets). Les photos d'ordonnance sont
    # reduites cote navigateur; cette limite protege la memoire du serveur.
    max_request_bytes: int = 10 * 1024 * 1024

    @field_validator("environment", "log_level", mode="before")
    @classmethod
    def _normalize_lower_upper(cls, value, info):
        value = str(value).strip()
        return value.lower() if info.field_name == "environment" else value.upper()

    @field_validator("jwt_algorithm")
    @classmethod
    def _check_jwt_algorithm(cls, value: str) -> str:
        if value not in ALLOWED_JWT_ALGORITHMS:
            raise ValueError(
                f"JWT_ALGORITHM='{value}' refuse. Valeurs autorisees: {', '.join(ALLOWED_JWT_ALGORITHMS)}."
            )
        return value

    @field_validator("trusted_proxy_hops")
    @classmethod
    def _check_hops(cls, value: int) -> int:
        if value < 0 or value > 5:
            raise ValueError("TRUSTED_PROXY_HOPS doit etre compris entre 0 et 5.")
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def security_problems(self) -> tuple[list[str], list[str]]:
        """Retourne (erreurs_graves, avertissements). Les erreurs graves bloquent le demarrage."""
        fatal: list[str] = []
        warnings: list[str] = []
        secret = self.jwt_secret_key or ""

        if self.is_production and secret.lower().startswith(_PLACEHOLDER_SECRET_PREFIXES):
            fatal.append(
                "JWT_SECRET_KEY est une valeur d'exemple: n'importe qui pourrait fabriquer un jeton valide. "
                "Genere une vraie cle (voir docs/EXPLOITATION.md)."
            )
        if len(secret) < 32:
            warnings.append(
                f"JWT_SECRET_KEY est courte ({len(secret)} caracteres, 32 minimum recommandes). "
                "Genere une cle aleatoire de 64 caracteres puis redeploie (les utilisateurs devront se reconnecter)."
            )
        if "*" in self.cors_origins_list:
            fatal.append("CORS_ORIGINS contient '*': interdit, les jetons d'authentification seraient exposes a n'importe quel site.")
        if self.is_production:
            if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origins_list):
                warnings.append("CORS_ORIGINS contient une adresse locale (localhost) en production.")
            if "localhost" in self.frontend_url or "127.0.0.1" in self.frontend_url:
                warnings.append("FRONTEND_URL pointe vers localhost: les liens de reinitialisation de mot de passe seront inutilisables.")
            if not self.smtp_host:
                warnings.append("SMTP_HOST est vide: aucun e-mail (mot de passe oublie, double authentification) ne peut partir.")
        on_railway = any(os.environ.get(k) for k in ("RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID"))
        if on_railway and not self.is_production:
            warnings.append(
                f"Le serveur tourne sur Railway mais ENVIRONMENT='{self.environment}' (et non 'production'): "
                "la documentation interactive /docs est publique et les en-tetes HSTS sont absents."
            )
        return fatal, warnings


@lru_cache
def get_settings() -> Settings:
    """Cache pour eviter de relire le .env a chaque appel."""
    return Settings()

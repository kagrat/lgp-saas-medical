"""
Configuration centrale de l'application.

Securite: aucune valeur secrete n'est codee en dur ici. Tout vient des
variables d'environnement (fichier .env en developpement, variables
d'environnement reelles en production - Railway/VPS).
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # SMS (interface uniquement, voir app/services/sms_provider.py)
    sms_api_key: str = ""
    sms_api_url: str = ""

    environment: str = "development"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cache pour eviter de relire le .env a chaque appel."""
    return Settings()

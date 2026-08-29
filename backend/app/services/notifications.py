"""
Interface Notifications (Email + SMS) - module "Confirmations RDV, rappels
24h, alertes stock" de la section 7.

SMS: integration Twilio reelle (appel direct de leur API REST, pas besoin
du SDK complet). Desactive silencieusement (retourne False, n'echoue
jamais) tant que TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER
ne sont pas renseignes dans les variables d'environnement - aucun envoi
n'a pu etre teste en conditions reelles (pas de compte Twilio disponible
dans cet environnement de developpement), mais la construction de la
requete (authentification, URL, corps) est verifiee par un test qui
intercepte l'appel HTTP sans jamais le laisser partir reellement (voir
backend/tests/test_sms.py).
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx

from app.config import get_settings

settings = get_settings()


def send_confirmation_email(to_email: str, subject: str, body: str) -> bool:
    """Envoie un email de confirmation RDV via SMTP. Retourne False si SMTP non configure."""
    if not settings.smtp_host or not settings.smtp_user:
        return False

    message = MIMEMultipart()
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to_email
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
    return True


def send_sms(to_phone: str, message: str) -> bool:
    """
    Envoie un SMS via l'API REST Twilio. Retourne False (sans lever
    d'exception) si les identifiants Twilio ne sont pas configures - un SMS
    manque, mais l'appelant (rappel de rendez-vous, alerte stock...) ne
    doit jamais planter pour autant.

    Leve une exception seulement si les identifiants SONT configures mais
    que l'appel echoue reellement (erreur reseau, identifiants invalides,
    numero invalide) - dans ce cas l'appelant doit le savoir plutot que de
    croire silencieusement que le SMS est parti.
    """
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    response = httpx.post(
        url,
        auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        data={"To": to_phone, "From": settings.twilio_from_number, "Body": message},
        timeout=10.0,
    )
    response.raise_for_status()
    return True

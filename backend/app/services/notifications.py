"""
Interface Notifications (Email + SMS) - module "Confirmations RDV, rappels
24h, alertes stock" de la section 7.

IMPORTANT (limite a signaler): aucun fournisseur SMS n'est cable en dur ici
car aucune cle API n'a ete fournie, et ce sandbox n'a pas d'acces reseau
pour la tester de toute facon. Cette classe definit le contrat a implementer.
Fournisseurs courants utilisables au Benin/Afrique de l'Ouest a evaluer:
Twilio, Vonage, ou un agregateur SMS local. Brancher la cle dans .env
(SMS_API_KEY, SMS_API_URL) puis completer send_sms() ci-dessous.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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
    A COMPLETER: aucun fournisseur SMS n'est branche (voir note en tete de
    fichier). Exemple d'implementation avec Twilio une fois le compte cree:

        from twilio.rest import Client
        client = Client(settings.sms_api_key, settings.sms_api_secret)
        client.messages.create(to=to_phone, from_=settings.sms_sender, body=message)

    Ne rien inventer d'autre ici tant qu'un vrai fournisseur n'est pas choisi.
    """
    if not settings.sms_api_key:
        return False
    raise NotImplementedError(
        "Aucun fournisseur SMS n'est branche. Complete cette fonction avec "
        "le SDK du fournisseur choisi (Twilio, Vonage, etc.) et sa cle API."
    )

"""
Validateurs reutilisables pour les donnees envoyees par les utilisateurs.
"""
import base64
import binascii
import re

# "data URL" d'image: data:image/png;base64,AAAA... (jamais de SVG: il peut contenir du script)
_DATA_URL = re.compile(r"data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})")
_MIN_IMAGE_BYTES = 60  # la plus petite image PNG valide fait environ 67 octets


def _real_format(raw: bytes) -> str | None:
    """Format REEL d'apres les premiers octets du fichier (et non d'apres ce que le client annonce)."""
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "webp"
    return None


def validate_image_data_url(value: str, *, max_decoded_bytes: int) -> str:
    """
    Accepte uniquement une vraie image PNG, JPEG ou WebP encodee en base64.
    Refuse: SVG, GIF, HEIC, texte, fichier renomme (annonce PNG mais contenu
    different), base64 invalide, image vide ou trop lourde.
    Leve ValueError avec un message affichable a l'utilisateur.
    """
    match = _DATA_URL.fullmatch(value or "")
    if not match:
        raise ValueError("L'image doit être au format PNG, JPEG ou WebP.")
    declared, payload = match.groups()
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("L'image est corrompue. Choisis-en une autre.")
    if len(raw) < _MIN_IMAGE_BYTES:
        raise ValueError("L'image est vide ou invalide.")
    if len(raw) > max_decoded_bytes:
        raise ValueError(f"L'image est trop lourde (maximum {max_decoded_bytes // (1024 * 1024)} Mo).")
    actual = _real_format(raw)
    if actual is None or actual != ("jpeg" if declared == "jpg" else declared):
        raise ValueError("Le fichier ne correspond pas au format d'image annoncé.")
    return value

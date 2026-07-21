"""
Utilitaires de geolocalisation - calcul de distance reelle entre etablissements.

IMPORTANT (a signaler honnetement): les coordonnees ci-dessous sont des
positions approximatives de CENTRE-VILLE pour les principales villes du
Benin, pas des releves GPS precis. Elles servent de solution de repli
quand un etablissement n'a pas ses propres coordonnees exactes.

Pour une precision reelle, chaque etablissement devrait avoir ses propres
latitude/longitude (voir Establishment.latitude / Establishment.longitude
dans models.py), obtenues par exemple via un clic droit sur Google Maps
("Que sont ces coordonnees ?"). Cette table de villes n'est qu'un
depannage raisonnable pour ne pas bloquer l'onboarding d'un etablissement
qui ne fournirait pas ses coordonnees exactes.
"""
import math
from typing import Optional

# Coordonnees approximatives de centre-ville (latitude, longitude).
# Liste non exhaustive - a completer si LGP HOLDINGS adhère des etablissements
# dans d'autres localites que celles listees ici.
BENIN_CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "cotonou": (6.3654, 2.4183),
    "porto-novo": (6.4969, 2.6289),
    "porto novo": (6.4969, 2.6289),
    "parakou": (9.3372, 2.6303),
    "abomey-calavi": (6.4491, 2.3554),
    "abomey calavi": (6.4491, 2.3554),
    "abomey": (7.1833, 1.9833),
    "bohicon": (7.1781, 2.0667),
    "djougou": (9.7085, 1.6660),
    "natitingou": (10.3042, 1.3792),
    "ouidah": (6.3625, 2.0852),
    "lokossa": (6.6389, 1.7167),
    "kandi": (11.1342, 2.9386),
    "savalou": (7.9294, 1.9756),
    "save": (8.0333, 2.4833),
    "nikki": (9.9401, 3.2098),
    "pobe": (6.9758, 2.6672),
    "pobè": (6.9758, 2.6672),
    "dogbo": (6.8000, 1.7833),
    "malanville": (11.8637, 3.3833),
    "banikoara": (11.2986, 2.4386),
    "come": (6.4056, 1.8825),
    "comé": (6.4056, 1.8825),
    "aplahoue": (6.9333, 1.6833),
    "tanguieta": (10.6167, 1.2667),
}


def resolve_city_coordinates(city: Optional[str]) -> Optional[tuple[float, float]]:
    """Retourne (lat, lon) approximatifs pour une ville connue, sinon None."""
    if not city:
        return None
    key = city.strip().lower()
    return BENIN_CITY_COORDINATES.get(key)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance a vol d'oiseau entre deux points GPS, en kilometres."""
    R = 6371.0  # rayon moyen de la Terre en km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

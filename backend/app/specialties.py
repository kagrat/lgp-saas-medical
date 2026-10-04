"""
Spécialités médicales - liste de référence côté serveur.

Pourquoi ce module: `Doctor.specialty` est une VALEUR STOCKÉE en base (le libellé choisi dans la liste
déroulante est enregistré tel quel) et la recherche la compare ensuite par `ilike` / égalité. Quand la
liste a été corrigée orthographiquement (« Generaliste » -> « Généraliste », etc.), les médecins déjà
enregistrés avec l'ancien libellé n'auraient plus été retrouvés. Ce module garantit que:
- à l'ENREGISTREMENT, une spécialité connue est toujours stockée sous sa forme canonique accentuée,
  quelle que soit la version du client qui l'envoie (canonical_specialty);
- à la RECHERCHE, l'ancienne et la nouvelle graphie se retrouvent mutuellement (specialty_variants),
  y compris pendant la fenêtre entre la migration SQL et le déploiement du frontend.
"""
import unicodedata

# Liste canonique - doit rester identique à SPECIALTIES de frontend-web/src/constants.js.
SPECIALTIES = [
    "Généraliste", "Dentiste", "Chirurgien", "Ophtalmologue", "Pédiatre", "Gynécologue", "Cardiologue",
    "Dermatologue", "ORL", "Kinésithérapeute", "Psychiatre", "Radiologue", "Urologue", "Neurologue", "Sage-femme",
]


def deaccent(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")


_CANONICAL = {deaccent(s).lower(): s for s in SPECIALTIES}


def canonical_specialty(value: str) -> str:
    """Forme canonique d'une spécialité connue (insensible à la casse et aux accents); sinon, valeur inchangée."""
    cleaned = (value or "").strip()
    return _CANONICAL.get(deaccent(cleaned).lower(), cleaned)


def specialty_variants(value: str) -> list[str]:
    """Toutes les graphies sous lesquelles cette spécialité peut exister en base (accentuée et non accentuée)."""
    cleaned = (value or "").strip()
    variants = {cleaned, deaccent(cleaned), canonical_specialty(cleaned)}
    return [v for v in variants if v]

"""Heure UTC "naive" (sans fuseau), exactement ce que renvoyait datetime.utcnow().

datetime.utcnow() est deprecie depuis Python 3.12. Toutes les colonnes de date de
la base sont "sans fuseau" et en UTC: cette fonction conserve ce comportement a
l'identique (aucune migration, aucune donnee a convertir) sans l'avertissement.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

"""
Script a executer UNE SEULE FOIS apres le premier deploiement, pour creer
le compte Super Admin de M. SOGADJI FAUSTIN (niveau 1).

Usage (depuis le dossier backend/, avec le venv active et .env configure):
    python -m scripts.create_super_admin

Le script demande le mot de passe de maniere interactive (jamais en argument
de ligne de commande, pour eviter qu'il reste dans l'historique shell).
"""
import getpass
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.models import User, UserRole
from app.security import hash_password


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        email = input("E-mail du Super Admin (M. SOGADJI FAUSTIN): ").strip().lower()
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print("Un compte existe déjà avec cet e-mail. Abandon.")
            return

        full_name = input("Nom complet: ").strip()
        password = getpass.getpass("Mot de passe (min. 8 caractères, 1 majuscule, 1 chiffre): ")
        password_confirm = getpass.getpass("Confirmer le mot de passe: ")

        if password != password_confirm:
            print("Les mots de passe ne correspondent pas. Abandon.")
            return
        if len(password) < 8:
            print("Mot de passe trop court. Abandon.")
            return

        user = User(
            id=str(uuid.uuid4()),
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=UserRole.SUPER_ADMIN,
            establishment_id=None,
        )
        db.add(user)
        db.commit()
        print(f"\nCompte Super Admin créé avec succès pour {email}.")
        print("Connecte-toi via POST /auth/login avec cet e-mail et ce mot de passe.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

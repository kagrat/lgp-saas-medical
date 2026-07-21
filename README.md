# LGP HOLDINGS — Plateforme SaaS Medicale

Implementation technique du cahier des charges (Juin 2026, Concepteur: M. Gratien KAKPO)
pour LGP HOLDINGS: gestion hospitaliere multi-etablissements, rendez-vous avec
suggestion automatique, et pharmacie en ligne.

Ce document est ecrit pour quelqu'un qui va **executer les etapes lui-meme**.
Chaque commande a copier-coller est indiquee explicitement.

---

## 1. Ce qui est livre ici (code reel, pas une maquette)

| Composant | Statut | Emplacement |
|---|---|---|
| API Backend multi-tenant (auth 3 niveaux, RBAC, JWT, bcrypt) | Livre | `backend/` |
| Moteur de suggestion automatique de RDV (section 6) | Livre | `backend/app/services/suggestion_engine.py` |
| Module Patients, Medecins, RDV, Pharmacie, Stats | Livre | `backend/app/routers/` |
| Journal d'audit | Livre | table `audit_logs` |
| Portail Web patients + Super Admin (React) | Livre | `frontend-web/` |
| Interface admin etablissement (React, reutilisee par le Desktop) | Livre | `frontend-web/src/pages/EstablishmentAdmin.jsx` |
| App Desktop (shell Electron) | Livre, avec 1 limite (voir §6) | `desktop-app/` |
| Tests automatises (auth, RBAC, moteur de suggestion) | Livre | `backend/tests/` |
| Script de creation du 1er Super Admin | Livre | `backend/scripts/create_super_admin.py` |

### Ce qui n'est PAS livre (et pourquoi — voir §6 pour le detail)
- Connexion reelle a un fournisseur SMS (aucune cle API disponible)
- Deploiement reel sur Railway/Vercel (necessite tes comptes et cartes de paiement)
- Vrai mode hors-ligne avec synchronisation (chantier technique a part entiere)
- Application mobile iOS/Android et teleconsultation video (Phase 3 du cahier des charges — explicitement "sur devis" / "prevue", donc hors MVP)

---

## 2. Architecture en un coup d'oeil

```
Patient / Super Admin (navigateur)          Etablissement (poste PC)
        |                                          |
   Portail Web React  <----HTTPS---->        App Desktop Electron
        |                                          |
        +-------------------> API FastAPI <---------+
                                   |
                          PostgreSQL (multi-tenant,
                          isole par establishment_id)
```

Isolation multi-tenant: chaque requete authentifiee porte un
`establishment_id` extrait du JWT (jamais envoye librement par le client).
Un `establishment_admin` ne peut jamais lire ou modifier les donnees d'un
autre etablissement — verifie par des tests automatises (`test_appointments.py`).

---

## 3. Installation manuelle — Backend

### 3.1 Prerequis a installer sur ta machine
- Python 3.11 ou plus (`python3 --version`)
- PostgreSQL 14+ (local, ou un compte Railway/Supabase/Neon si tu prefères du cloud)

### 3.2 Etapes

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # sur Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Cree ta base de donnees PostgreSQL locale (exemple) :
```bash
createdb lgp_medical
```

Copie le fichier d'environnement et remplis-le :
```bash
cp .env.example .env
```

Ouvre `.env` et renseigne au minimum :
- `DATABASE_URL` — ex: `postgresql://ton_user:ton_mdp@localhost:5432/lgp_medical`
- `JWT_SECRET_KEY` — genere une vraie valeur aleatoire avec la commande suivante,
  **ne reutilise jamais un exemple trouve dans un document** :
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
  Colle le resultat dans `JWT_SECRET_KEY=`.

### 3.3 Demarrer l'API en local
```bash
uvicorn app.main:app --reload
```
L'API est disponible sur `http://localhost:8000`.
La documentation interactive (Swagger) est sur `http://localhost:8000/docs`
— **uniquement en developpement** (elle se desactive automatiquement si
`ENVIRONMENT=production` dans `.env`).

### 3.4 Creer le compte Super Admin (M. SOGADJI FAUSTIN)
A faire une seule fois, apres le premier demarrage :
```bash
python -m scripts.create_super_admin
```
Le script demande l'email, le nom et un mot de passe de maniere interactive
(le mot de passe ne s'affiche pas a l'ecran et n'est jamais stocke en clair).

### 3.5 Lancer les tests automatises
```bash
pytest tests/ -v
```
Tous les tests doivent passer avant toute mise en production. Ils verifient
notamment que l'isolation entre etablissements fonctionne reellement.

---

## 4. Installation manuelle — Portail Web (React)

### 4.1 Prerequis
- Node.js 18+ (`node --version`)

### 4.2 Etapes
```bash
cd frontend-web
npm install
cp .env.example .env
```
Dans `.env`, verifie que `VITE_API_URL` pointe vers ton backend
(`http://localhost:8000` en local).

```bash
npm run dev
```
Le portail est disponible sur `http://localhost:5173`.

### 4.3 Build de production
```bash
npm run build
```
Genere un dossier `dist/` a deployer (voir §5).

---

## 5. Installation manuelle — App Desktop (Electron)

### 5.1 Prerequis
- Node.js 18+, et le portail web (`frontend-web`) doit tourner (`npm run dev`)
  ou etre buildee et servie quelque part.

### 5.2 Etapes
```bash
cd desktop-app
npm install
npm start
```
Au premier lancement, l'app cherche un fichier de config dans le dossier
utilisateur de l'OS (`app.getPath('userData')/establishment-config.json`).
Cree-le manuellement avec l'`establishment_id` recu quand le Super Admin
a cree l'etablissement (reponse de `POST /establishments`), exemple :
```json
{
  "establishment_id": "colle-ici-l-uuid-recu",
  "api_url": "http://localhost:8000",
  "web_dashboard_url": "http://localhost:5173"
}
```

### 5.3 Limite honnete a connaitre
Le cahier des charges demande un fonctionnement **hors ligne** adapte aux
coupures reseau au Benin. Ce shell Electron detecte la perte de connexion
mais n'implemente pas encore l'ecriture locale + synchronisation differee
(ça demande une base locale type SQLite embarquee et de vrais tests de
coupure reseau — un chantier a prevoir dans une iteration dediee, pas
quelque chose qu'on invente sans le tester). Voir les commentaires dans
`desktop-app/main.js` pour le point d'extension prevu.

---

## 6. Deploiement en production — ce que TU dois faire manuellement

Aucun de ces comptes n'existe ici, je ne peux pas les creer a ta place :

### 6.1 Backend + Base de donnees (Railway conseille par le cahier des charges)
1. Cree un compte sur https://railway.app
2. Cree un nouveau projet, ajoute un service PostgreSQL (Railway te donne une `DATABASE_URL`)
3. Ajoute un service "Deploy from GitHub repo" pointant vers `backend/`
4. Dans les variables d'environnement Railway, renseigne exactement les memes
   cles que dans `.env` (surtout `DATABASE_URL` fournie par Railway et un
   `JWT_SECRET_KEY` different de celui de developpement)
5. Mets `ENVIRONMENT=production` pour desactiver `/docs` publiquement
6. Railway detecte `requirements.txt` et lance normalement
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 6.2 Portail Web (Vercel conseille par le cahier des charges)
1. Cree un compte sur https://vercel.com
2. Importe le dossier `frontend-web/`
3. Dans les variables d'environnement Vercel, ajoute
   `VITE_API_URL=https://ton-backend-railway.app`
4. Vercel build et deploie automatiquement a chaque push

### 6.3 Nom de domaine et HTTPS
Vercel et Railway fournissent HTTPS automatique. Si tu utilises un nom de
domaine perso (ex: `sante.lgpholdings.bj`), configure les DNS chez ton
registrar vers Vercel/Railway selon leur documentation respective.

### 6.4 SMS (a brancher toi-meme)
Aucune cle SMS n'est fournie ici. Etapes suggerees :
1. Cree un compte chez un fournisseur (Twilio, Vonage, ou un agregateur
   local beninois)
2. Recupere la cle API
3. Complete la fonction `send_sms()` dans
   `backend/app/services/notifications.py` avec le SDK du fournisseur choisi
4. Renseigne `SMS_API_KEY` et `SMS_API_URL` dans les variables d'environnement

---

## 7. Checklist de securite avant mise en production

- [ ] `JWT_SECRET_KEY` de production different de celui de developpement, genere aleatoirement
- [ ] `.env` jamais commite dans Git (verifie que `.gitignore` contient `.env`)
- [ ] `ENVIRONMENT=production` sur le backend deploye (desactive `/docs`)
- [ ] `CORS_ORIGINS` limite exactement au(x) domaine(s) reel(s) du portail web
- [ ] Mot de passe du Super Admin: fort, unique, change immediatement apres le premier login
- [ ] Sauvegardes automatiques PostgreSQL activees (Railway le propose nativement)
- [ ] HTTPS force partout (pas de HTTP en production)
- [ ] Tous les tests (`pytest tests/ -v`) passent avant chaque deploiement

---

## 8. Mapping complet avec le cahier des charges

| Section du cahier des charges | Statut | Note |
|---|---|---|
| 4. Niveau 1 - Super Admin | Fait | routes `/establishments`, `/dashboard/global` |
| 4. Niveau 2 - Admin etablissement | Fait | routes `/doctors`, `/appointments/establishment`, `/pharmacy/stock` |
| 4. Niveau 3 - Patient | Fait | routes `/auth/register-patient`, `/appointments`, `/pharmacy/reservations` |
| Module 1 - Authentification et roles | Fait | JWT + bcrypt + RBAC, journal des connexions dans `audit_logs` |
| Module 2 - Gestion des patients | Fait | table `patients`, numero de dossier auto-genere |
| Module 3 - Rendez-vous | Fait | creation, annulation, detection de conflit d'horaire |
| Module 4 - Medecins | Fait | specialites, prix, disponibilites, absences/conges |
| Module 5 - Pharmacie | Fait | stock, seuil d'alerte, reservations patients |
| Module 6 - Tableau de bord | Fait (export PDF/Excel non inclus) | stats en JSON; export a ajouter cote frontend si besoin (ex: bibliotheque `xlsx` ou generation PDF) |
| Section 6 - Suggestion automatique | Fait | `suggestion_engine.py`, suit exactement les 5 etapes du cahier des charges |
| Section 7 - Architecture technique | Fait | React+Tailwind, Electron, FastAPI, PostgreSQL — technologies identiques a celles demandees |
| Section 11 - Securite | Fait | isolation tenant, bcrypt, JWT, journal d'audit append-only |
| Notifications email | Fait (SMTP) | `notifications.py::send_confirmation_email` — a activer avec un vrai compte SMTP |
| Notifications SMS | Interface prete, non branchee | necessite ta propre cle fournisseur (§6.4) |
| Application mobile (Phase 3) | Non livre | hors MVP par le cahier des charges lui-meme ("sur devis") |
| Teleconsultation video (Phase 3) | Non livre | hors MVP par le cahier des charges lui-meme ("prevue") |
| Export PDF/Excel des rapports | Non livre | a ajouter si prioritaire — je peux le faire dans un prochain lot |

---

## 9. Prochaines etapes suggerees (par ordre de priorite)

1. Faire tourner le backend + frontend en local en suivant les §3 et §4, et
   verifier que la creation d'etablissement, de medecin et la prise de RDV
   fonctionnent de bout en bout avec tes propres donnees de test.
2. Choisir un fournisseur SMS et le brancher (§6.4).
3. Deployer sur Railway + Vercel (§6.1-6.2) une fois les tests en local concluants.
4. Ajouter l'export PDF/Excel du module 6 si LGP HOLDINGS le juge prioritaire
   avant la Phase 2.

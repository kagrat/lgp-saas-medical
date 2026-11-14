# LGP HOLDINGS — Plateforme SaaS Médicale

Implémentation technique du cahier des charges (Juin 2026, Concepteur: M. Gratien KAKPO)
pour LGP HOLDINGS: gestion hospitalière multi-établissements, rendez-vous avec
suggestion automatique, et pharmacie en ligne.

Ce document est écrit pour quelqu'un qui va **exécuter les étapes lui-même**.
Chaque commande à copier-coller est indiquée explicitement.

---

## 1. Ce qui est livré ici (code réel, pas une maquette)

| Composant | Statut | Emplacement |
|---|---|---|
| API Backend multi-tenant (auth 3 niveaux, RBAC, JWT, bcrypt) | Livré | `backend/` |
| Moteur de suggestion automatique de RDV (section 6) | Livré | `backend/app/services/suggestion_engine.py` |
| Module Patients, Médecins, RDV, Pharmacie, Stats | Livré | `backend/app/routers/` |
| Journal d'audit | Livré | table `audit_logs` |
| Portail Web patients + Super Admin (React) | Livré | `frontend-web/` |
| Interface admin établissement (React, réutilisée par le Desktop) | Livré | `frontend-web/src/pages/EstablishmentAdmin.jsx` |
| App Desktop (shell Electron) | Livré, avec 1 limite (voir §6) | `desktop-app/` |
| Tests automatisés (auth, RBAC, moteur de suggestion) | Livré | `backend/tests/` |
| Script de création du 1er Super Admin | Livré | `backend/scripts/create_super_admin.py` |

### Ce qui n'est PAS livré (et pourquoi — voir §6 pour le détail)
- Connexion réelle à un fournisseur SMS (aucune clé API disponible)
- Déploiement réel sur Railway/Vercel (nécessite tes comptes et cartes de paiement)
- Vrai mode hors-ligne avec synchronisation (chantier technique à part entière)
- Application mobile iOS/Android et téléconsultation vidéo (Phase 3 du cahier des charges — explicitement "sur devis" / "prévue", donc hors MVP)

---

## 2. Architecture en un coup d'œil

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

Isolation multi-tenant: chaque requête authentifiée porte un
`establishment_id` extrait du JWT (jamais envoyé librement par le client).
Un `establishment_admin` ne peut jamais lire ou modifier les données d'un
autre établissement — vérifié par des tests automatisés (`test_appointments.py`).

---

## 3. Installation manuelle — Backend

### 3.1 Prérequis à installer sur ta machine
- Python 3.11 ou plus (`python3 --version`)
- PostgreSQL 14+ (local, ou un compte Railway/Supabase/Neon si tu prefères du cloud)

### 3.2 Étapes

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # sur Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Crée ta base de données PostgreSQL locale (exemple) :
```bash
createdb lgp_medical
```

Copie le fichier d'environnement et remplis-le :
```bash
cp .env.example .env
```

Ouvre `.env` et renseigne au minimum :
- `DATABASE_URL` — ex: `postgresql://ton_user:ton_mdp@localhost:5432/lgp_medical`
- `JWT_SECRET_KEY` — génère une vraie valeur aléatoire avec la commande suivante,
  **ne réutilise jamais un exemple trouve dans un document** :
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
  Colle le résultat dans `JWT_SECRET_KEY=`.

### 3.3 Démarrer l'API en local
```bash
uvicorn app.main:app --reload
```
L'API est disponible sur `http://localhost:8000`.
La documentation interactive (Swagger) est sur `http://localhost:8000/docs`
— **uniquement en développement** (elle se désactive automatiquement si
`ENVIRONMENT=production` dans `.env`).

### 3.4 Créer le compte Super Admin (M. SOGADJI FAUSTIN)
À faire une seule fois, après le premier démarrage :
```bash
python -m scripts.create_super_admin
```
Le script demande l'e-mail, le nom et un mot de passe de manière interactive
(le mot de passe ne s'affiche pas à l'écran et n'est jamais stocke en clair).

### 3.5 Lancer les tests automatisés
```bash
pytest tests/ -v
```
Tous les tests doivent passer avant toute mise en production. Ils vérifient
notamment que l'isolation entre établissements fonctionne réellement, que
**aucune route n'est publique par erreur**, que les endpoints publics sont
limités en débit, que les messages restent confidentiels, que les migrations
s'appliquent sur un vrai PostgreSQL (variable `TEST_POSTGRES_URL`) et qu'aucune
bibliothèque utilisée par le code n'est oubliée dans `requirements.txt`.
Installation reproductible : `pip install --require-hashes -r requirements.txt`
(dépendances verrouillées, voir `docs/EXPLOITATION.md`).

---

## 4. Installation manuelle — Portail Web (React)

### 4.1 Prérequis
- Node.js 18+ (`node --version`)

### 4.2 Étapes
```bash
cd frontend-web
npm install
cp .env.example .env
```
Dans `.env`, vérifie que `VITE_API_URL` pointe vers ton backend
(`http://localhost:8000` en local).

```bash
npm run dev
```
Le portail est disponible sur `http://localhost:5173`.

### 4.3 Build de production
```bash
npm run build
```
Génère un dossier `dist/` à déployer (voir §5).

---

## 5. Installation manuelle — App Desktop (Electron)

### 5.1 Prérequis
- Node.js 18+, et le portail web (`frontend-web`) doit tourner (`npm run dev`)
  ou être buildée et servie quelque part.

### 5.2 Étapes
```bash
cd desktop-app
npm install
npm start
```
Au premier lancement, l'app cherche un fichier de config dans le dossier
utilisateur de l'OS (`app.getPath('userData')/establishment-config.json`).
Crée-le manuellement avec l'`establishment_id` reçu quand le Super Admin
a créé l'établissement (réponse de `POST /establishments`), exemple :
```json
{
  "establishment_id": "colle-ici-l-uuid-recu",
  "api_url": "http://localhost:8000",
  "web_dashboard_url": "http://localhost:5173"
}
```

### 5.3 Limite honnête à connaître
Le cahier des charges demande un fonctionnement **hors ligne** adapte aux
coupures réseau au Bénin. Ce shell Electron détecte la perte de connexion
mais n'implémente pas encore l'écriture locale + synchronisation différée
(ça demande une base locale type SQLite embarquée et de vrais tests de
coupure réseau — un chantier à prévoir dans une itération dédiée, pas
quelque chose qu'on invente sans le tester). Voir les commentaires dans
`desktop-app/main.js` pour le point d'extension prévu.

---

## 6. Déploiement en production — ce que TU dois faire manuellement

Aucun de ces comptes n'existe ici, je ne peux pas les créer à ta place :

### 6.1 Backend + Base de données (Railway conseillé par le cahier des charges)
1. Crée un compte sur https://railway.app
2. Crée un nouveau projet, ajoute un service PostgreSQL (Railway te donne une `DATABASE_URL`)
3. Ajoute un service "Deploy from GitHub repo" pointant vers `backend/`
4. Dans les variables d'environnement Railway, renseigne exactement les mêmes
   clés que dans `.env` (surtout `DATABASE_URL` fournie par Railway et un
   `JWT_SECRET_KEY` différent de celui de développement)
5. Mets `ENVIRONMENT=production` pour désactiver `/docs` publiquement
6. Railway détecte `requirements.txt` et lance normalement
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 6.2 Portail Web (Vercel conseillé par le cahier des charges)
1. Crée un compte sur https://vercel.com
2. Importe le dossier `frontend-web/`
3. Dans les variables d'environnement Vercel, ajoute
   `VITE_API_URL=https://ton-backend-railway.app`
4. Vercel build et déploie automatiquement à chaque push

### 6.3 Nom de domaine et HTTPS
Vercel et Railway fournissent HTTPS automatique. Si tu utilises un nom de
domaine perso (ex: `sante.lgpholdings.bj`), configure les DNS chez ton
registrar vers Vercel/Railway selon leur documentation respective.

### 6.4 SMS (à brancher toi-même)
Aucune clé SMS n'est fournie ici. Étapes suggérées :
1. Crée un compte chez un fournisseur (Twilio, Vonage, ou un agrégateur
   local béninois)
2. Récupère la clé API
3. Complète la fonction `send_sms()` dans
   `backend/app/services/notifications.py` avec le SDK du fournisseur choisi
4. Renseigne `SMS_API_KEY` et `SMS_API_URL` dans les variables d'environnement

### 6.5 Suspendre / rétablir l'accès (mode maintenance)
Un interrupteur permet de remplacer **toute** l'application (site web et
application desktop, qui charge son interface depuis le même site) par une
page « Accès temporairement suspendu ». Rien n'est supprimé, et l'opération
est réversible.

**Suspendre l'accès**
1. Vercel → *Settings* → *Environment Variables* → ajoute `VITE_MAINTENANCE_MODE`
   avec la valeur `true` (environnement *Production*).
2. *Deployments* → menu **⋯** du dernier déploiement → **Redeploy**.
3. Attends la fin du déploiement (environ 1 à 2 minutes), puis ouvre le site dans
   une fenêtre de navigation privée pour vérifier.

**Rétablir l'accès** : repasse `VITE_MAINTENANCE_MODE` à `false` (ou supprime-la),
puis **Redeploy**.

**Message personnalisé (optionnel)** : définis `VITE_MAINTENANCE_MESSAGE`. Sans
cette variable, un message par défaut est affiché.

**Aperçu sans rien activer** : ajoute `?apercu-maintenance=1` à l'adresse
(par exemple `https://ton-site.vercel.app/?apercu-maintenance=1`).

Limites à connaître :
- Une variable Vite est intégrée à la compilation : le changement n'est **pas
  instantané**, il faut un redéploiement.
- C'est un blocage d'**interface**, pas un contrôle de sécurité. Le serveur
  (Railway) reste en ligne, et un onglet déjà ouvert continue de fonctionner
  jusqu'à son rechargement.

---

> **Exploitation courante** (variables, migrations, sauvegarde, restauration,
> incidents, rotation des clés) : voir **`docs/EXPLOITATION.md`**.

## 7. Checklist de sécurité avant mise en production

- [ ] `JWT_SECRET_KEY` de production différent de celui de développement, génère aléatoirement
- [ ] `.env` jamais commite dans Git (vérifie que `.gitignore` contient `.env`)
- [ ] `ENVIRONMENT=production` sur le backend déployé (désactive `/docs`)
- [ ] `CORS_ORIGINS` limite exactement au(x) domaine(s) réel(s) du portail web
- [ ] Mot de passe du Super Admin: fort, unique, change immédiatement après le premier login
- [ ] Sauvegardes automatiques PostgreSQL activées (Railway le propose nativement)
- [ ] HTTPS force partout (pas de HTTP en production)
- [ ] Tous les tests (`pytest tests/ -v`) passent avant chaque déploiement (la CI GitHub le fait seule)
- [ ] `TRUSTED_PROXY_HOPS` correct (Railway seul = 1) et `RUN_MIGRATIONS=true` après sauvegarde
- [ ] `python scripts/schema_drift.py` ne signale aucun écart après déploiement

---

## 8. Mapping complet avec le cahier des charges

| Section du cahier des charges | Statut | Note |
|---|---|---|
| 4. Niveau 1 - Super Admin | Fait | routes `/establishments`, `/dashboard/global` |
| 4. Niveau 2 - Admin établissement | Fait | routes `/doctors`, `/appointments/establishment`, `/pharmacy/stock` |
| 4. Niveau 3 - Patient | Fait | routes `/auth/register-patient`, `/appointments`, `/pharmacy/reservations` |
| Module 1 - Authentification et rôles | Fait | JWT + bcrypt + RBAC, journal des connexions dans `audit_logs` |
| Module 2 - Gestion des patients | Fait | table `patients`, numéro de dossier auto-généré |
| Module 3 - Rendez-vous | Fait | création, annulation, détection de conflit d'horaire |
| Module 4 - Médecins | Fait | spécialités, prix, disponibilités, absences/congés |
| Module 5 - Pharmacie | Fait | stock, seuil d'alerte, réservations patients |
| Module 6 - Tableau de bord | Fait (export PDF/Excel non inclus) | stats en JSON; export à ajouter côté frontend si besoin (ex: bibliothèque `xlsx` ou génération PDF) |
| Section 6 - Suggestion automatique | Fait | `suggestion_engine.py`, suit exactement les 5 étapes du cahier des charges |
| Section 7 - Architecture technique | Fait | React+Tailwind, Electron, FastAPI, PostgreSQL — technologies identiques à celles demandées |
| Section 11 - Sécurité | Fait | isolation tenant, bcrypt, JWT, journal d'audit append-only |
| Notifications e-mail | Fait (SMTP) | `notifications.py::send_confirmation_email` — à activer avec un vrai compte SMTP |
| Notifications SMS | Interface prête, non branchée | nécessite ta propre clé fournisseur (§6.4) |
| Application mobile (Phase 3) | Non livré | hors MVP par le cahier des charges lui-même ("sur devis") |
| Téléconsultation vidéo (Phase 3) | Non livré | hors MVP par le cahier des charges lui-même ("prévue") |
| Export PDF/Excel des rapports | Non livré | à ajouter si prioritaire — je peux le faire dans un prochain lot |

---

## 9. Prochaines étapes suggérées (par ordre de priorité)

1. Faire tourner le backend + frontend en local en suivant les §3 et §4, et
   vérifier que la création d'établissement, de médecin et la prise de RDV
   fonctionnent de bout en bout avec tes propres données de test.
2. Choisir un fournisseur SMS et le brancher (§6.4).
3. Déployer sur Railway + Vercel (§6.1-6.2) une fois les tests en local concluants.
4. Ajouter l'export PDF/Excel du module 6 si LGP HOLDINGS le juge prioritaire
   avant la Phase 2.

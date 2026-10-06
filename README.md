# Comptabilité matières

Application web de gestion des matières d'une entreprise : biens durables (meubles, véhicules…),
consommables (stylos, papier, ampoules…), services et bureaux, et **contrôle annuel** des biens.

**Stack** : Angular 20 · Chart.js · Node.js (Express) · PostgreSQL · JWT

## Connexion par défaut
`admin@entreprise.mg` / `admin123` — à changer via `.env` avant toute mise en production.

## Option A — Docker (recommandé)
```bash
cp .env.example .env      # puis modifiez les mots de passe
docker compose up --build
```
- Application : http://localhost:8080
- pgAdmin : http://localhost:5050 (identifiants du `.env`). Ajoutez un serveur : hôte `db`, port `5432`, utilisateur/mot de passe du `.env`.

## Option B — Sans Docker
Prérequis : Node.js 22+, PostgreSQL 14+.
```bash
# 1. Base de données
createdb compta_matieres            # ou via pgAdmin

# 2. Backend (les tables sont créées automatiquement au démarrage)
cd backend
cp .env.example .env                # adaptez DATABASE_URL
npm install
npm start                           # http://localhost:3000

# 3. Frontend (autre terminal)
cd frontend
npm install
npm start                           # http://localhost:4200 (proxy /api vers le port 3000)
```

## Utilisation
1. **Organisation** : créez les bureaux, puis les services. *Un bureau peut contenir plusieurs services ; un service appartient à un seul bureau.*
2. **Biens durables** : un enregistrement par objet (n° d'inventaire unique, catégorie, service, état, valeur).
3. **Consommables** : stock avec seuil d'alerte ; boutons Entrée / Sortie.
4. **Contrôle annuel** : l'administrateur ouvre la campagne de l'année (la liste des biens est générée) et pointe chaque bien :
   présent ou manquant, état et service constatés. Les écarts (manquant, déplacé, état différent) sont signalés.
   Impression du procès-verbal, puis clôture.
5. **Utilisateurs** : l'administrateur crée les comptes.

## Rôles
| Rôle | Accès |
|---|---|
| **Administrateur** | Tout : tableau de bord, biens, consommables, bureaux, services, catégories, utilisateurs, saisie du contrôle |
| **Utilisateur simple** | Uniquement le **suivi du contrôle annuel**, en lecture seule (appliqué aussi côté API) |

## Mise à jour depuis la version 1
Au démarrage, le backend migre automatiquement le schéma (les services ont maintenant un bureau, les biens un service).
Les anciens liens bureau/service ne peuvent pas être convertis : ressaisissez-les. Pour repartir de zéro : `docker compose down -v`.

## API
`POST /api/auth/login` · CRUD `/api/{bureaux,services,categories,biens,consommables,utilisateurs}` ·
`POST /api/consommables/:id/mouvement` · `GET|POST /api/campagnes` · `GET /api/campagnes/:id/controles` ·
`PUT /api/controles/:id` · `POST /api/campagnes/:id/cloturer` · `GET /api/dashboard`

## Déploiement gratuit (démo)
Frontend : Netlify/Vercel · Backend : Render · Base : Neon. Définir `DATABASE_URL` (avec `?sslmode=require`) et `JWT_SECRET` côté backend.
Pensez à faire pointer `/api` du frontend vers l'URL du backend (redirection Netlify ou reverse proxy).

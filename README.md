# LIVI

LIVI — application mobile, API backend et logique métier.

## Structure

- `frontend/livi` — application mobile Expo / React Native
- `backend/livi` — API Node.js / Express et logique métier
- `backend/livi/migrations` — migrations PostgreSQL versionnées
- `.github/workflows` — CI backend

## Architecture de déploiement cible

```text
Application mobile
       ↓
API LIVI sur Render
       ↓
PostgreSQL Supabase
```

Les fournisseurs externes (paiement, SMS, push, stockage objet) sont branchés via les adapters présents dans le backend.

## Règles Git

Aucun secret réel, fichier `.env`, `node_modules`, stockage local ou artefact de build ne doit être commit.

## Démarrage

Consulter `backend/livi/README.md` pour le backend et `frontend/livi/README.md` pour l'application mobile.

# Déploiement LIVI

## 1. Supabase

Créer une base PostgreSQL Supabase et fournir son URL à `DATABASE_URL` côté backend.

Exécuter ensuite les migrations de `backend/livi/migrations` dans l'ordre via :

```bash
npm run migrate
```

## 2. Render

Déployer `backend/livi` comme service backend à partir de son `Dockerfile`.

Le conteneur écoute sur le port `3000` et utilise les variables d'environnement configurées dans Render.

Ne pas activer les helpers de staging en production :

```env
ALLOW_STAGING_TEST_HELPERS=false
```

## 3. Mobile

Construire l'application Expo avec :

```env
EXPO_PUBLIC_API_BASE_URL=https://<domaine-render>/api/v1
```

## 4. Secrets

Les secrets réels restent uniquement dans Supabase/Render/EAS ou les systèmes de secret appropriés, jamais dans GitHub.

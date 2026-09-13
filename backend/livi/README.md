# LIVI Backend

API Node.js/Express 5 pour LIVI, avec PostgreSQL comme base de données.

## Prérequis

- Node.js 20+
- PostgreSQL 15+

## Local

```bash
npm install
cp .env.example .env
npm run migrate
npm start
```

API locale : `http://localhost:3000/api/v1`

## Base de données Supabase

LIVI utilise PostgreSQL directement via `DATABASE_URL`. Une base Supabase PostgreSQL peut donc être utilisée sans introduire un second ORM ou une seconde couche d'accès aux données.

Configurer notamment :

```env
DATABASE_URL=postgresql://...
```

Puis exécuter les migrations :

```bash
npm run migrate
```

## Déploiement Render

Le backend contient un `Dockerfile` Node 20 prêt pour un service Render.

Commande d'application :

```bash
node src/server.js
```

Les variables d'environnement doivent être configurées dans Render ; aucune clé réelle ne doit être placée dans Git.

## Sécurité

Ne jamais committer :

- `.env`
- secrets JWT
- secrets webhook
- clés de chiffrement
- fichiers de stockage local
- `node_modules`

Les fonctionnalités dépendant de fournisseurs externes utilisent les adapters de `src/adapters/`.

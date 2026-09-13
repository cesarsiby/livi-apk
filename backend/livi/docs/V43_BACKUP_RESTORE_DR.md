# V43 — Sauvegarde, restauration et reprise après sinistre (DR)

Ce document a été écrit en Session 26 (réconciliation de branches), en
comblant un vide réel : `scripts/v43_restore_drill.js` et le test associé
(`tests/v43_backup_restore_dr.test.js`) existaient déjà dans les deux
branches fusionnées, mais référençaient ce fichier sans qu'il ait jamais
été créé — le test correspondant échouait donc silencieusement (ENOENT)
depuis la session qui a introduit ce correctif V43, sans que personne ne
l'ait remarqué avant cette réconciliation.

**Portée** : ce document couvre la procédure et son script de vérification
automatisé. Il ne remplace pas une répétition réelle sur Render/Supabase —
voir la section H, « À vérifier après déploiement ».

## A. Sauvegarde (pg_dump)

Sauvegarde complète au format custom (permet une restauration sélective et
la compression, contrairement au format texte brut) :

```bash
pg_dump --format=custom --file=livi_$(date +%Y%m%d_%H%M%S).dump \
  --dbname="$DATABASE_URL"
```

Sur Supabase, `DATABASE_URL` (ou les variables `PGHOST`/`PGUSER`/
`PGPASSWORD`/`PGPORT`/`PGDATABASE` équivalentes) se trouve dans
Project Settings → Database → Connection string. Utiliser la connexion
directe (port 5432), pas le pooler (port 6543/PgBouncer), pour `pg_dump` —
le pooler peut couper les connexions longues sur une base volumineuse.

**Fréquence recommandée** : Supabase effectue déjà des sauvegardes
automatiques quotidiennes sur les plans payants (point-in-time recovery
selon le plan). Ce `pg_dump` manuel est le complément pour :
- une copie exportable avant une migration à risque (voir section D) ;
- un exercice de restauration périodique (section C) — Supabase ne permet
  pas de "restaurer pour tester" sans affecter le projet réel, d'où
  l'intérêt d'un dump exploitable sur une instance Postgres jetable.

## B. Restauration (pg_restore)

Vers une base vide (jamais vers la base de production directement pour un
test) :

```bash
createdb livi_restore_test
pg_restore --dbname="postgres://localhost:5432/livi_restore_test" \
  --no-owner --no-privileges livi_20260101_120000.dump
```

`--no-owner --no-privileges` : évite les échecs de restauration liés à des
rôles PostgreSQL qui n'existent pas forcément sur l'instance cible
(courant en passant de Supabase à une instance locale ou de test).

## C. Vérifier qu'une restauration a réellement fonctionné

Un serveur qui démarre après restauration ne prouve rien à lui seul — un
schéma incomplet ou un ledger déséquilibré peut coexister avec un process
qui répond sur `/health`. C'est exactement ce que
`scripts/v43_restore_drill.js` vérifie automatiquement :

```bash
DATABASE_URL="postgres://localhost:5432/livi_restore_test" \
  node scripts/v43_restore_drill.js
```

Contrôles effectués (voir le script pour le détail exact) :

| Code d'échec | Signification |
|---|---|
| `MIGRATION_NOT_APPLIED` | un fichier de `migrations/` n'a pas de ligne correspondante dans `schema_migrations` |
| `UNKNOWN_APPLIED_MIGRATION` | `schema_migrations` référence une migration absente de l'arbre source actuel |
| `TABLE_NOT_QUERYABLE` | une table applicative attendue (`users`, `orders`, `escrow_transactions`, `ledger_entries`…) n'existe pas ou n'est pas interrogeable |
| `GLOBAL_LEDGER_UNBALANCED_AFTER_RESTORE` | `sum(ledger_entries.amount)` ≠ 0 — un restore ayant perdu ou dupliqué des écritures serait détecté ici |
| `MISSING_EXTENSION` | `pgcrypto` ou `citext` non installées sur l'instance restaurée |

Le script sort avec un code non-zéro et un JSON `{status:"FAIL", failures:[...]}` 
au moindre échec plutôt que de déclarer un succès silencieux.

**Répéter le même drill sur une base fraîchement migrée** (sans passer par
un vrai dump), pour s'entraîner sans dépendre d'une sauvegarde existante :

```bash
createdb livi_migrate_test
DATABASE_URL="postgres://localhost:5432/livi_migrate_test" npm run migrate
DATABASE_URL="postgres://localhost:5432/livi_migrate_test" node scripts/v43_restore_drill.js
```

## D. Avant une migration à risque

1. `pg_dump` (section A).
2. Appliquer la migration sur l'environnement cible.
3. Lancer le drill (section C) sur l'environnement qui vient d'être migré —
   il valide aussi bien un restore qu'une migration normale, les deux
   aboutissant au même état attendu (schéma complet, ledger équilibré).
4. En cas d'échec du drill : restaurer le dump de l'étape 1 plutôt que de
   tenter une correction manuelle en production.

## E. Ce que ce drill NE couvre PAS

- Le contenu métier des données (un restore syntaxiquement complet mais
  correspondant à un point dans le temps trop ancien reste un problème que
  ce script ne détecte pas — il vérifie la cohérence structurelle, pas la
  fraîcheur).
- Les fichiers KYC hors base de données (voir la limitation de stockage
  documentée séparément dans `docs/KYC_STORAGE_DURABILITY.md` — un restore
  de la base ne restaure pas des fichiers qui vivraient sur le filesystem
  local de Render).
- Un test de charge ou de performance post-restauration.

## F. Rôles PostgreSQL requis

`pg_dump`/`pg_restore` avec le rôle de connexion applicatif standard
suffisent pour un schéma sans RLS complexe multi-rôles. Si Supabase Row
Level Security est activé sur des tables sensibles, restaurer avec un rôle
disposant de `BYPASSRLS` (ou le rôle `postgres` de l'instance cible) pour
éviter des lignes silencieusement filtrées pendant la restauration
elle-même.

## G. Fréquence de l'exercice

Recommandation : exécuter le drill complet (section C, variante migration
fraîche) à chaque session d'audit touchant les migrations ou le ledger, et
la variante réelle (section D) avant toute migration modifiant une table
financière (`escrow_transactions`, `ledger_entries`, `payout_requests`,
`platform_fee_rules`).

## H. À vérifier après déploiement sur GitHub / Supabase / Render

Rien dans ce document n'a été exécuté contre une instance Supabase ou
Render réelle — cette session n'a accès qu'au code local. À vérifier une
fois déployé :
- `pg_dump`/`pg_restore` fonctionnent réellement avec les identifiants de
  connexion directe Supabase (pas seulement le pooler).
- Le rôle de connexion utilisé en production a bien les permissions
  nécessaires pour un restore complet si RLS est activé sur des tables
  ajoutées depuis l'écriture de ce document.
- `node scripts/v43_restore_drill.js` s'exécute sans erreur contre une
  vraie copie restaurée, pas seulement contre une base fraîchement migrée
  en local.

# Rapport final — Audit et finalisation des migrations LIVI

**Périmètre** : backend LIVI, base de données, migrations. Frontend non touché (conforme à la consigne).
**Base cible** : PostgreSQL hébergé sur Supabase, utilisé strictement comme Postgres managé (pas d'Auth Supabase, pas de RLS/PostgREST côté client).
**Environnement d'exécution de cette session** : sandbox sans accès réseau ni instance PostgreSQL disponible. Toute vérification a été faite par lecture de code et recoupement systématique — jamais par supposition. Chaque affirmation ci-dessous est vérifiable par grep/lecture directe dans le dépôt.

Légende des statuts (section 41 de la mission) : **ANALYSÉ** · **CORRIGÉ** (fichier de migration créé) · **EXÉCUTÉ** · **NON EXÉCUTÉ** · **À TESTER**.

---

## 1. Système de migration détecté — ANALYSÉ

Un seul système, réel et utilisé : SQL brut dans `backend/livi/migrations/*.sql`, appliqué par `backend/livi/src/utils/migrate.js` via `npm run migrate`.

Mécanique confirmée par lecture du fichier :
- Verrou advisory Postgres de session (`pg_advisory_lock(7241991000000001)`) — empêche deux exécutions concurrentes.
- Table `schema_migrations(version text PRIMARY KEY, applied_at timestamptz)` pour le suivi.
- Fichiers appliqués par ordre alphabétique, chacun dans sa propre transaction (`BEGIN`/`COMMIT`, `ROLLBACK` si erreur).
- Arrêt immédiat au premier échec.

Aucun autre système n'a été trouvé dans le dépôt : pas de `supabase/migrations`, pas de Prisma/Drizzle/TypeORM/Knex, pas de `schema.sql` séparé. **Un seul système cohérent est déjà en place ; aucun système parallèle n'a été créé.**

**Commande réelle de validation** (la seule qui existe dans ce projet — voir `package.json`) :
```
npm run migrate
```
Les commandes `supabase db reset` / `supabase migration list` / `supabase db push` mentionnées à titre d'exemple dans la mission ne s'appliquent pas ici : ce projet n'utilise pas le CLI Supabase. Les inventer aurait été trompeur.

## 2. Supabase : rôle réel dans l'architecture — ANALYSÉ

Confirmé par recherche exhaustive (`grep -ri supabase` sur tout le dépôt hors `.git`) : le mot « Supabase » n'apparaît que dans la documentation (README, `docs/DEPLOYMENT.md`), jamais dans le code ni les migrations. `.env.example` ne définit qu'une `DATABASE_URL` Postgres standard — aucune variable `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`.

**Conséquence directe pour la section RLS (point 22 de la mission)** : les clients (apps mobile/web) ne parlent jamais directement à l'API Supabase (PostgREST) — ils passent exclusivement par le backend Express, qui revalide le JWT et l'autorisation à chaque requête. Le modèle de sécurité réel est donc *backend + triggers Postgres*, pas RLS. Ajouter des policies RLS aujourd'hui n'apporterait aucune protection supplémentaire tant qu'aucun client n'a de clé d'accès direct à Postgres/PostgREST ; ce serait de la sécurité décorative si elle n'est jamais évaluée. **Recommandation, non appliquée** : si un rôle `anon`/`service_role` Supabase venait à être exposé un jour (ex. accès direct depuis un futur client), activer RLS deviendrait alors nécessaire en défense en profondeur — mais ce n'est pas le cas aujourd'hui, donc rien n'a été créé pour ne pas donner une fausse impression de protection.

## 3. État du schéma avant correction — ANALYSÉ

33 migrations, 55 tables, avant cette session. Le niveau de rigueur déjà en place est élevé : grand livre comptable en partie double avec triggers d'équilibrage transactionnels, escrow avec garde-fous d'état, preuves de livraison QR/PIN chiffrées avec rotation et journal d'événements, idempotence de webhooks (`UNIQUE(provider, event_id)`), réconciliation partenaire, corrections financières tracées, traçabilité des acteurs admin. Extensions utilisées : `pgcrypto`, `citext` — toutes deux standard et disponibles sur Supabase.

Ce niveau de maturité indique que ce projet a déjà traversé plusieurs sessions d'audit similaires (voir `CHANGELOG_SESSION.md` et les 5 `RAPPORT_AUDIT_PARTIE*.md` déjà présents à la racine, orientés frontend↔backend). Cette session-ci est la première **exclusivement** base de données/migrations.

## 4. Migrations existantes — liste complète — ANALYSÉ

| # | Fichier | Objet |
|---|---|---|
| 001 | `001_initial.sql` | Schéma de base complet (users, vendors, transporters, products, orders, escrow, ledger, shipments, disputes, chat, notifications, KYC, audit) |
| 002 | `002_market_ready.sql` | Colonnes de mise en marché (catégories, `disputes.category`/`closed_at`, `updated_at` trigger) |
| 003 | `003_production_hardening.sql` | `payout_requests`, durcissements initiaux |
| 004 | `004_finance_v4.sql` | `financial_operations`, `platform_fee_rules` |
| 005 | `005_withdrawal_fees.sql` | `withdrawal_fee_rules` |
| 006 | `006_order_lifecycle.sql` | Alignement cycle de vie commande |
| 007 | `007_delivery_proofs.sql` | `shipment_proofs`, `shipment_proof_events` (QR/PIN) |
| 008 | `008_proof_stability.sql` | Chiffrement stable des secrets QR (ciphertext/iv/tag) |
| 009 | `009_v11_invariants.sql` | Invariants financiers V11 |
| 010 | `010_financial_db_guards.sql` | Garde-fous financiers base |
| 011 | `011_v13_escrow_delivery_guard.sql` | Cohérence escrow ↔ livraison |
| 012 | `012_v15_concurrency_guards.sql` | Protections concurrence (stock, etc.) |
| 013 | `013_v16_payable_ownership.sql` | Propriété des créances |
| 014 | `014_v17_payout_attribution.sql` | Attribution des payouts |
| 015 | `015_v18_financial_attribution_guards.sql` | Attribution financière |
| 016 | `016_v19_refund_integrity.sql` | Intégrité des remboursements |
| 017 | `017_v20_cancellation_dispute_guards.sql` | Annulation / litiges |
| 018 | `018_v21_webhook_integrity.sql` | Intégrité + idempotence webhooks (`partner_payment_events`) |
| 019 | `019_v22_partner_reconciliation.sql` | Réconciliation partenaire |
| 020 | `020_v23_reconciliation_corrections.sql` | `financial_correction_cases/actions` |
| 021 | `021_v24_authorization_integrity.sql` | Autorisation payout par rôle |
| 022 | `022_v25_security_hardening.sql` | Durcissement sécurité (1er CHECK `kyc_document_type`) |
| 023 | `023_v26_privacy_audit_guards.sql` | Confidentialité / audit |
| 024 | `024_v27_private_file_access.sql` | `kyc_file_access_logs`, jetons d'accès fichiers privés |
| 025 | `025_v28_auth_session_security.sql` | Sécurité sessions/auth |
| 026 | `026_v29_access_control_integrity.sql` | Contrôle d'accès payout par rôle (trigger) |
| 027 | `027_v30_postgres_invariants.sql` | Invariants Postgres généraux |
| 028 | `028_v35_stock_restitution_idempotency.sql` | Idempotence restitution de stock |
| 029 | `029_v36_wallet_legacy_guard.sql` | Fige `wallets` (legacy) au profit du ledger |
| 030 | `030_v37_commission_consistency_guards.sql` | Cohérence des commissions |
| 031 | `031_v40_admin_actor_traceability_guard.sql` | Traçabilité acteur admin |
| 032 | `032_v46_frontend_backend_unification.sql` | `user_roles`, `payment_methods`, tables `social_*`, `live_shops`, `vendor_videos` |
| 033 | `033_v46_architecture_alignment.sql` | `product_variants`, `notification_outbox`, `partners`, `partner_instructions`, `settlements` |

**Rejouabilité depuis une base vide — ANALYSÉ** : vérifiée par relecture complète et par un parseur de schéma maison (33 fichiers, paren-matching, extraction colonnes/contraintes/index/triggers) qui rejoue les 33 fichiers dans l'ordre sans erreur de cohérence détectée (noms de contraintes réutilisés correctement via `DROP CONSTRAINT IF EXISTS` avant `ADD CONSTRAINT`, aucune référence à une table non encore créée à ce stade). **À TESTER réellement** : aucune instance Postgres n'était disponible dans ce sandbox pour un `npm run migrate` réel sur une base vide — voir section 21.

Aucun doublon, aucune migration contradictoire, aucune migration ne correspondant plus au backend n'a été trouvé dans les 33 fichiers existants.

## 5. Comparaison backend ↔ migrations — méthode et résultat — ANALYSÉ

Chaque route (`src/routes/*.js`, 17 fichiers) et chaque service (`src/services/*.js`, 18 fichiers) a été lu intégralement. Toutes les requêtes SQL brutes (`pg`, pas d'ORM) ont été extraites et confrontées à un schéma de référence reconstruit par script à partir des 33 migrations. Extrait des résultats :

- **Tables référencées par le code mais absentes du schéma : aucune.**
- **Tables du schéma jamais lues/écrites par le code : 3** — `categories`, `dispute_evidence`, `kyc_file_access_logs`. Traitement : voir section 17 « Éléments non supprimés ».
- **Colonnes utilisées par le backend mais absentes ou mal typées : aucune trouvée.** Le schéma est en avance sur, ou aligné avec, le code applicatif partout où une correspondance a été vérifiée.
- **Contraintes manquantes confirmées : 9 colonnes** — détail section 10.
- **Un défaut applicatif dont la valeur elle-même violait la contrainte existante** : `kyc_documents.document_type` — détail section 10.

## 6. Migrations créées cette session — CORRIGÉ

4 nouveaux fichiers, ajoutés à la suite du 033 en respectant la convention de nommage et de style déjà en usage (`NNN_vXX_description.sql`, prochain numéro de version disponible : **v50**, confirmé par recherche du plus haut `vNN` cité dans tout le dépôt, y compris les corrections applicatives hors migrations) :

| Fichier | Objet |
|---|---|
| `034_v50_status_enum_integrity.sql` | CHECK manquants/élargis sur 8 colonnes de statut fermées |
| `035_v51_missing_indexes.sql` | 8 index confirmés manquants sur des colonnes réellement filtrées |
| `036_v52_kyc_retention_guard.sql` | `kyc_documents.user_id` : CASCADE → RESTRICT |
| `037_v53_role_consistency_guard.sql` | Trigger de synchronisation `users.role` → `user_roles` |

**Aucune migration existante n'a été modifiée.** Diff vérifié : les 33 fichiers originaux sont strictement inchangés ; seuls 4 fichiers ont été ajoutés.

## 7 & 8. Tables et colonnes créées/modifiées — CORRIGÉ

**Aucune nouvelle table, aucune nouvelle colonne.** Toutes les corrections sont des contraintes (CHECK, FK) ou des index sur des colonnes déjà existantes. C'est un choix délibéré : la mission demande explicitement de ne créer que ce que le backend confirme réellement, et aucune colonne/table manquante n'a été confirmée par le croisement code↔schéma (section 5).

## 9. Foreign keys — ANALYSÉ puis CORRIGÉ (1 cas)

Audit complet des clauses `ON DELETE` sur les 55 tables. Résultat : la quasi-totalité des relations financières et d'audit (`orders`, `escrow_transactions`, `ledger_entries`, `ledger_transactions`, `payout_requests`, `audit_logs`, `disputes`...) utilisent déjà le comportement par défaut (`NO ACTION`/`RESTRICT`), jamais `CASCADE`. C'est le résultat attendu et il n'y avait quasiment rien à corriger.

**Une exception trouvée** : `kyc_documents.user_id` était en `ON DELETE CASCADE` depuis la migration initiale — un document de conformité (CNI, passeport, registre de commerce...) aurait disparu automatiquement si son utilisateur était supprimé. Corrigé en `RESTRICT` dans `036_v52_kyc_retention_guard.sql`. **Confirmé sans risque de régression** : aucune route applicative ne supprime jamais un `users` (`grep` exhaustif — seuls des scripts de test le font). C'est donc un durcissement préventif, pas la correction d'un bug actif.

`order_items.order_id` reste volontairement en `CASCADE` : une ligne de commande n'a aucun sens détachée de sa commande, et aucune route ne supprime jamais une `orders` en pratique — ce cas diffère de KYC (document de conformité, valeur légale indépendante).

## 10. CHECK / enums — le principal chantier de cette session — ANALYSÉ puis CORRIGÉ

Audit systématique (script) de toutes les colonnes de type statut/enum sur les 55 tables. Deux catégories ont été distinguées, volontairement :

**A. États fermés, pilotés par une validation explicite côté backend (zod, table de transition) → CHECK ajouté.** Chaque valeur ci-dessous a été confirmée par grep exhaustif des sites d'écriture réels, jamais supposée :

| Table.colonne | Valeurs confirmées | Preuve |
|---|---|---|
| `orders.status` | pending_payment, payment_pending, paid, preparing, shipping, delivered, disputed, completed, cancelled, refunded | `orderLifecycle.js` (source de vérité unique) + grep de tous les `orders SET status=` |
| `disputes.status` | open, resolved | `routes/disputes.js` |
| `disputes.category` | non_delivery, damaged, wrong_item, fraud, other (+ NULL toléré) | enum zod `openSchema.category` |
| `kyc_documents.status` | pending, approved, rejected | enum zod `reviewSchema` dans `routes/kyc.js` |
| `transporters.availability` | online, offline, busy | enum zod, `PATCH /transporter/availability` |
| `live_shops.status` | live, ended | `POST /vendor/live/start` et `/vendor/live/:id/end` |
| `vendor_videos.status` | published, deleted | suppression douce, `DELETE /vendor/videos/:id` |
| `shipments.status` | pending, assigned, rejected, picked_up, in_transit, arrived, delivered, cancelled | `routes/delivery.js` + `routes/compatibility.js` (voir aussi section 15) |

**B. `kyc_documents.document_type` — élargissement d'une contrainte existante trop stricte (le constat le plus important de cette catégorie) :**
La contrainte actuelle (posée en V25, élargie en V46) n'autorise que 7 valeurs. Or la route réelle de soumission (`POST /users/me/kyc`, `compatibility.js`) calcule :
```
document_type = req.body.document_type || req.body.step || 'identity'
```
sans aucune liste blanche avant l'`INSERT`. **`'identity'` — son propre repli par défaut — n'est pas dans la contrainte actuelle.** Conséquence concrète : toute soumission KYC qui n'envoie ni `document_type` ni `step` échoue aujourd'hui avec une violation de contrainte en base. `routes/kyc.js` déclare déjà, dans une constante `KYC_DOCUMENT_TYPES`, l'ensemble complet voulu (10 valeurs) — mais cette constante n'est **jamais importée ni utilisée** par la route réelle de soumission, malgré un commentaire affirmant explicitly le contraire dans le code. Corrigé en élargissant le CHECK aux 10 valeurs déclarées. Le résidu applicatif (constante toujours non branchée, aucune validation d'entrée sur cette route) est noté en section 17 — hors périmètre migrations strict.

**C. Colonnes volontairement laissées sans CHECK — ANALYSÉ, aucune action, avec justification explicite :**
- `ledger_transactions.type`, `financial_operations.type/status`, `notifications.type` : ce sont des journaux extensibles par nature (catégorisation libre d'un log), pas des machines à états fermées — un CHECK y serait une invention de ma part, contraire à la demande explicite de ne pas ajouter de contrainte qui bloquerait un scénario métier valide futur.
- `product_media.kind` : une seule valeur (`'image'`) est confirmée en usage réel ; le nom de la colonne suggère une extension future (vidéo). Contraindre à une seule valeur aurait été arbitraire.
- `wallets.status` : jamais lu ni écrit ailleurs que son défaut `'active'` — aucune deuxième valeur confirmée, donc rien à contraindre utilement (le sous-système `wallets` est de toute façon déjà mis hors service au profit du ledger depuis la migration V36).
- `vendors.kyc_status` / `transporters.kyc_status` : seules `pending`/`approved` sont confirmées en écriture (`rejected` existe sur `kyc_documents.status` mais n'est jamais propagé ici) — par prudence, aucune contrainte n'a été ajoutée plutôt que de deviner si `rejected` doit un jour y apparaître.
- Colonnes `currency` (orders, wallets, ledger, settlements, payout_requests...) : `'XOF'` est la seule valeur jamais utilisée, mais aucune validation explicite dans le code ne déclare que c'est la *seule* devise valide — contrairement aux cas ci-dessus, il n'y a pas d'enum applicatif prouvant une intention fermée. Figer `CHECK (currency = 'XOF')` serait une décision d'architecture (mono-devise ou multi-devise à terme ?), pas une correction de bug. **Recommandation non appliquée**, à trancher par l'équipe produit.
- `user_addresses.country` : code pays ISO libre par conception, pas un enum métier.

## 11. Index — ANALYSÉ puis CORRIGÉ

Audit systématique de chaque colonne de clé étrangère contre les index existants (y compris index implicites via PRIMARY KEY/UNIQUE, pour éviter les faux positifs — ex. `wallets.user_id` et `shipments.order_id` sont déjà couverts par une contrainte `UNIQUE`, `wishlists.user_id` par une PK composite `(user_id, product_id)`). Sur la trentaine de FK non couvertes par un index dédié, seules celles correspondant à une requête réellement observée dans le code ont été retenues — conformément à la consigne de ne pas indexer partout inutilement :

| Index ajouté | Justifié par |
|---|---|
| `order_items(order_id)` | Agrégation des lignes à chaque affichage de commande |
| `product_media(product_id)` | 4 sites d'accès confirmés (liste, upload, comptage) |
| `user_addresses(user_id)` | `GET /users/me/addresses` |
| `conversation_members(user_id)` | `GET /conversations` — la PK `(conversation_id, user_id)` ne sert pas une recherche par `user_id` seul |
| `social_posts(created_at DESC)` | Fil social principal : `ORDER BY created_at DESC LIMIT n` **sans aucun WHERE** — scan complet + tri à chaque appel aujourd'hui |
| `social_comments(post_id)` | Compteur de fil + liste de commentaires ; pas de contrainte naturelle pouvant servir d'index |
| `social_shares(post_id)` | Compteur de fil ; même situation |
| `social_follows(following_id)` | `GET /vendor/subscriptions` — la PK `(follower_id, following_id)` ne sert pas une recherche par `following_id` seul |

Le plus significatif des huit est `social_posts(created_at DESC)` : c'est aujourd'hui la seule requête haute fréquence identifiée qui scanne et trie une table entière sans aucun filtre.

Les FK à faible trafic (tables de correction financière, de réconciliation, colonnes `reviewed_by`/`resolved_by`...) ont été délibérément laissées sans index dédié : pas de preuve d'un accès fréquent, et la mission demande explicitement de ne pas indexer « partout ».

## 12. Triggers et fonctions — ANALYSÉ puis CORRIGÉ

Inventaire : le schéma existant contient déjà de nombreux triggers de garde (équilibrage du ledger, cohérence escrow/livraison, rôle du bénéficiaire d'un payout, sujet KYC, `updated_at` automatique...). Un seul trou a été trouvé dans cette famille de « seconde ligne de défense » :

`users.role` et `user_roles.role` utilisent déjà exactement le même CHECK (`client`/`vendor`/`transporter`/`admin`) — pas de vocabulaire incompatible entre les deux représentations. Mais rien ne les maintenait synchronisés **au niveau base** : `src/services/auth.js` écrit bien les deux tables à l'inscription et à la première connexion OTP, mais via deux requêtes non transactionnelles, par seule discipline applicative. `037_v53_role_consistency_guard.sql` ajoute `livi_sync_user_roles()` + trigger `AFTER INSERT OR UPDATE OF role ON users`, qui garantit que le rôle courant est toujours présent dans `user_roles` — de façon strictement additive (jamais de suppression, car `user_roles` représente l'historique des rôles jamais détenus, pas seulement le rôle actuel).

## 13. RLS / policies — ANALYSÉ, aucune action

Voir section 2 : zéro policy RLS dans les 33 migrations existantes, et c'est cohérent avec l'architecture réelle (backend Express comme unique point d'accès, pas de client parlant directement à Postgres/PostgREST). Aucune policy n'a été ajoutée pour ne pas donner une fausse impression de protection sur un mécanisme qui ne serait jamais évalué par aucun client actuel.

## 14. Seeds — ANALYSÉ, déjà conforme

`scripts/seed-staging.js` est le seul script de seed du projet. Vérifié : strictement séparé des migrations (jamais appelé par `migrate.js`), données manifestement fictives, refuse explicitement de s'exécuter si le nom de la base ne contient pas `staging`/`test`/`dev`, aucun secret réel. Les quelques `INSERT` présents *dans* les migrations elles-mêmes (`ledger_accounts` — plan comptable, `platform_fee_rules`/`withdrawal_fee_rules` — règle par défaut à 0) ne sont **pas des données de test** : ce sont des données de configuration structurelle nécessaires au fonctionnement du système (équivalent à des valeurs d'énumération), pas des comptes/commandes/paiements fictifs. Rien à corriger.

## 15. Éléments non supprimés — ANALYSÉ, décision explicite de conservation

Conformément à la règle absolue n°1, rien n'a été supprimé. Trois tables sont présentes en base mais ne sont lues/écrites par aucune route ni aucun service actuellement :

- **`categories`** (+ `products.category_id`) : la table existe, la relation existe, mais aucune route ne filtre ni n'affiche jamais par catégorie. Fonctionnalité de catégorisation non encore exposée, pas un défaut du schéma. **Conservée** — utile à très court terme pour tout écran de navigation par catégorie.
- **`dispute_evidence`** : table créée dès la migration initiale, avec ses propres garde-fous de sécurité (V30, guard sur `file_key`), mais aucune route ne l'alimente ni ne la lit. La fonctionnalité « pièces jointes de litige » semble avoir été prévue puis jamais branchée côté API. **Conservée** — le schéma et ses protections sont prêts, seule la route manque.
- **`kyc_file_access_logs`** : table d'audit créée en V27 spécifiquement pour tracer les accès aux documents KYC, mais `privateFileAccess.js` (qui gère précisément ces accès) n'y écrit jamais. La protection *technique* (jetons signés, expiration) fonctionne ; c'est la *traçabilité* prévue par le schéma qui n'est pas branchée côté code. **Conservée et signalée avec une priorité plus élevée** que les deux précédentes, car c'est une lacune de conformité potentielle, pas juste une fonctionnalité incomplète.

Aucune de ces trois tables n'a d'index ajouté (section 11) : indexer une table jamais interrogée n'aurait aucune valeur.

## 16. Cashback / fidélité — ANALYSÉ, déjà retiré

Recherche exhaustive (`cashback|loyalty|fidélit|reward`, insensible à la casse, tout le dépôt hors `.git`) : **aucun résidu dans le backend ni dans les 33 migrations.** Les seules occurrences restantes sont dans deux documents d'audit déjà obsolètes (`AUDIT_CORRESPONDANCE_HTML_MOBILE.md`, `MATRICE_HTML_MOBILE_COMPLETE.csv`) qui décrivent un état frontend antérieur au nettoyage déjà effectué (voir `RAPPORT_AUDIT_PARTIE4.md`, qui documente la suppression). Rien à faire côté base de données : il n'y a jamais eu de table `cashback`/`loyalty` dans le schéma SQL lui-même.

## 17. Préparation des intégrations externes — ANALYSÉ

| Domaine | État réel du schéma |
|---|---|
| **PSP / paiement** | Prêt. `escrow_transactions`, `partner_payment_events` (idempotence `UNIQUE(provider,event_id)`), `partner_instructions` (idempotency_key, provider_reference, payload/response JSONB), `settlements`. Aucun fournisseur particulier codé en dur. |
| **Payout** | Prêt. `payout_requests` + `partner_instructions(type='PAYOUT')` + `partners`. |
| **SMS / OTP** | Prêt côté colonnes (`auth_otp_challenges`), mais **aucun fournisseur réel n'est branché** — l'envoi est actuellement simulé/loggé (`adapters/otpProvider.js`, non modifié ici). |
| **Push** | **Écart confirmé** : le frontend appelle déjà `POST /notifications/push-token` et `DELETE /notifications/push-token` (`notificationsApi.ts`), mais cette route **n'existe pas côté backend**, et aucune table `device_tokens` n'existe. `notification_outbox.channel` accepte déjà `'push'` en valeur (prêt pour le jour où c'est branché), mais le mécanisme d'enregistrement d'un jeton d'appareil est totalement absent. **Non corrigé volontairement** : créer la table sans la route qui l'alimenterait aurait produit un schéma mort, et créer la route dépasse le périmètre migrations exclusif de cette mission. Signalé comme le point d'action le plus concret pour une prochaine session backend. |
| **Maps / géolocalisation** | Utilisé en interne uniquement (`shipment_events` de type `location`, lat/lng bruts) — pas de dépendance à un fournisseur externe identifiée dans le code actuel. |
| **Stockage externe** | KYC/preuves utilisent un stockage de fichiers avec accès par jeton signé (`privateFileAccess.js`), mais sans modélisation explicite d'un provider de stockage externe (clé objet, bucket) — actuellement local. Pas de blocage : le jour où un stockage externe est branché, une colonne `storage_provider`/`object_key` pourra être ajoutée sans casser l'existant. |

## 18. Problèmes restants confirmés — ANALYSÉ, non corrigés (hors périmètre migrations)

Deux constats de **logique applicative**, pas de schéma, trouvés en croisant le code — signalés avec la priorité la plus haute de tout ce rapport car ils affectent directement la capacité de LIVI à livrer des commandes :

1. **Aucune route ne crée jamais un `shipment`.** Recherche exhaustive (`INSERT INTO shipments`, toutes graphies) : zéro occurrence dans `src/`. Le module transporteur entier (accepter/refuser/récupérer/arriver/livrer, preuves QR/PIN) est fonctionnel et bien construit, mais opère uniquement sur des lignes `shipments` pré-existantes — que seuls des scripts de test créent aujourd'hui. Aucune route vendeur ni admin ne transforme une commande "prête" en mission livrable. **Le schéma est prêt** (colonnes, FK, index) ; c'est la décision produit (attribution manuelle par un admin ? matching automatique ? pool ouvert aux transporteurs disponibles ?) qui manque, et elle dépasse une mission migrations.
2. **Aucune route ne fait jamais transiter un `shipment` de `picked_up` vers `in_transit`**, alors que `/transporter/missions/:id/arrive` et `verifyDeliveryProof()` exigent l'un ou l'autre de `in_transit`/`arrived`. Un colis récupéré via l'API réelle ne peut aujourd'hui atteindre ni `arrived` ni `delivered`. Le CHECK ajouté en section 10 valide que ces valeurs existent bien dans le vocabulaire autorisé ; il ne comble pas — et ne doit pas chercher à combler — cette transition manquante, qui est un choix de flux métier.

Un troisième constat, mineur : `KYC_DOCUMENT_TYPES` (constante déclarée dans `kyc.js`) n'est importée par aucune route, y compris celle que son propre commentaire dit synchroniser — la validation d'entrée sur `POST /users/me/kyc` reste donc inexistante malgré la contrainte DB maintenant élargie en conséquence (section 10-B).

## 19. Commandes utilisées — NON EXÉCUTÉ (voir justification)

La seule commande réelle du projet pour appliquer les migrations est `npm run migrate`. **Elle n'a pas été exécutée dans cette session** : le sandbox ne dispose d'aucun accès réseau ni d'aucune instance PostgreSQL (confirmé par l'absence de `psql`/`postgres` dans l'environnement, et cohérent avec la limitation déjà documentée dans `CHANGELOG_SESSION.md` pour les sessions précédentes). Aucune commande n'a été inventée, et aucune migration n'a été déclarée comme exécutée alors qu'elle ne l'a pas été.

Ce qui a été fait à la place, pour compenser l'absence de base réelle : un parseur de schéma Python maison a rejoué la structure des 37 fichiers de migration (33 existants + 4 nouveaux) en simulant colonnes/contraintes/index/triggers, et a confirmé que les nouveaux fichiers produisent exactement les objets attendus, sans collision de nom ni référence à un objet inexistant à ce stade de l'historique.

## 20. Résultats réellement obtenus — récapitulatif honnête

| Action | Statut |
|---|---|
| Audit complet des 33 migrations existantes | **EXÉCUTÉ** |
| Croisement exhaustif backend (35 fichiers routes/services) ↔ schéma | **EXÉCUTÉ** |
| Détection des 9 colonnes de statut sans CHECK / avec CHECK trop strict | **EXÉCUTÉ** |
| Détection des 8 index manquants à fort impact confirmé | **EXÉCUTÉ** |
| Détection du CASCADE non protégé sur `kyc_documents.user_id` | **EXÉCUTÉ** |
| Détection de l'absence de synchronisation `users.role` ↔ `user_roles` | **EXÉCUTÉ** |
| Détection des 3 tables orphelines (`categories`, `dispute_evidence`, `kyc_file_access_logs`) | **EXÉCUTÉ** |
| Détection de l'écart push-token frontend/backend | **EXÉCUTÉ** |
| Détection de l'absence de création de `shipment` et de la transition `picked_up→in_transit` | **EXÉCUTÉ** |
| Rédaction des 4 migrations correctives (034 à 037) | **CORRIGÉ** (fichiers créés, syntaxe relue et vérifiée par parseur) |
| Application réelle des migrations sur une base Postgres | **NON EXÉCUTÉ** — aucune base disponible dans ce sandbox |
| Validation qu'une base vide + 37 migrations produit le schéma complet sans intervention manuelle | **À TESTER** en environnement réel (`npm run migrate` sur une base fraîche) |
| Validation que les nouveaux CHECK n'entrent pas en conflit avec des lignes déjà présentes en base de dev | **À TESTER** — voir précaution ci-dessous |
| Suppression de code/tables | **NON EFFECTUÉ** (aucune suppression, conformément à la règle absolue n°1) |

**Précaution avant application réelle** : les nouvelles contraintes CHECK valident l'intégralité des lignes déjà présentes au moment de l'`ALTER TABLE`. Si la base de développement actuelle contient une ligne insérée hors du chemin applicatif normal (SQL manuel, ancien test) avec une valeur hors de l'ensemble confirmé, la migration `034` échouera sur cette table précise — ce qui est le comportement voulu (mieux vaut échouer à l'application qu'accepter silencieusement une incohérence), mais à anticiper. Vérification recommandée avant `npm run migrate` :
```sql
SELECT DISTINCT status FROM orders;
SELECT DISTINCT status FROM shipments;
SELECT DISTINCT status, category FROM disputes;
SELECT DISTINCT document_type, status FROM kyc_documents;
SELECT DISTINCT availability FROM transporters;
SELECT DISTINCT status FROM live_shops;
SELECT DISTINCT status FROM vendor_videos;
```
Puisque la mission confirme que cette base est une base de développement/test sans donnée de production à préserver, la voie la plus simple reste une reconstruction complète depuis une base vide (`npm run migrate` sur une base fraîche), qui élimine ce risque par construction.

## 21. Matrice finale

La matrice complète des 55 tables (migration de création, nb colonnes, nb FK, unique, check, nb index, RLS, utilisation backend, préparation externe) est fournie en fichier séparé : **`MATRICE_FINALE_MIGRATIONS.csv`**, plus facile à filtrer/trier que 55 lignes dans ce document.

## 22. Conclusion

Le schéma LIVI était déjà, avant cette session, dans un état nettement plus mature que la moyenne des projets à ce stade : grand livre comptable rigoureux, garde-fous transactionnels nombreux, séparation propre migrations/seeds, aucun résidu cashback/fidélité. Le travail de cette session a porté sur ce qu'un audit base de données exclusif peut réellement apporter à ce niveau de maturité : fermer des trous de contraintes précis (CHECK, un CASCADE, un trigger de cohérence de rôle), ajouter des index confirmés par des requêtes réelles, et — surtout — documenter avec preuves deux lacunes de logique applicative (création de shipment, transition `picked_up→in_transit`) qui ont un impact opérationnel bien plus grand que n'importe quelle contrainte manquante, mais qui ne relèvent pas d'une migration.

Rien n'a été supprimé, aucune donnée fictive n'a été ajoutée aux migrations, aucun secret n'y figure, et les 33 fichiers existants sont strictement inchangés.

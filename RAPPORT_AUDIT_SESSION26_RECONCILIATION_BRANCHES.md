# RAPPORT_AUDIT_SESSION26 — Réconciliation de branches + audit authentification

**Contexte** : cette session répond au « PROMPT MAÎTRE — AUDIT, CORRECTION ET MISE À NIVEAU COMPLÈTE DU SaaS LIVI », fourni avec deux archives (`livi-apk-main-sessions9-25-final.zip`, `livi-LIVI2_0-session21-1.zip`) et un accès annoncé à GitHub/Supabase/Render/Expo.

**Préalable découvert avant toute autre action** : les deux archives ne sont pas « projet + sous-ensemble ». Ce sont deux branches ayant divergé après la Session 20, chacune ayant corrigé indépendamment le même bug critique (constat C0) mais en repartant dans deux directions différentes :

- **Ligne d'audit numérotée** (`sessions9-25-final.zip`, sessions 21 à 25) : corrections ciblées sur l'architecture d'écrans existante (pas d'onglets, `BuyerDashboardScreen` conservé).
- **LIVI 2.0 / UX-UI** (`LIVI2_0-session21.zip`, RAPPORT_UXUI_SESSION21_*) : refonte complète (onglets, design system, `HomeScreen`, `normalizeList()`).

Continuer sans résoudre cette divergence aurait silencieusement effacé l'une des deux lignes de travail. Le détail complet de l'analyse et de la fusion suit.

---

## A. Analyse de divergence

Comparaison exhaustive (`diff -rq` puis `diff -u` fichier par fichier) des deux arbres extraits. Fichiers réellement divergents, en dehors des rapports `.md` eux-mêmes :

| Fichier | Verdict |
|---|---|
| `backend/.../compatibility.js` | LIVI 2.0 n'a jamais touché ce fichier (hors périmètre, frontend uniquement). La ligne d'audit y a ajouté deux enrichissements réels (`/vendor/analytics`, `/transporter/earnings`) → **à porter**. |
| `frontend/.../transporter/EarningsScreen.tsx` | Identique partout sauf la lecture des champs : LIVI 2.0 n'a jamais corrigé cet écran (absent de ses propres rapports). La version de la ligne d'audit est strictement meilleure → **remplacée intégralement**. |
| `frontend/.../social/FeedScreen.tsx` | Un seul ajout isolé (retour visible sur échec d'envoi de commentaire), absent de LIVI 2.0 → **porté**. |
| `frontend/.../buyer/RefundsScreen.tsx`, `EscrowCenterScreen.tsx` | Les deux branches corrigent le même bug ; LIVI 2.0 va plus loin (retire le champ fantôme « Motif » au lieu de l'afficher à « — », utilise `normalizeList()`) → **version LIVI 2.0 conservée, rien porté**. |
| `catalogueApi.ts`, `ordersApi.ts`, `sellerApi.ts`, `wallet/types.ts` | La ligne d'audit est restée sur les anciens types (`Wallet.balance/available_balance/pending_balance` — des champs qui n'existent nulle part côté backend, cf. C0-quater). LIVI 2.0 les a déjà corrigés → **version LIVI 2.0 conservée**. |
| Écrans restants (~40 fichiers) | Différent uniquement parce que LIVI 2.0 les a refondus ; aucune correction de fond de la ligne d'audit n'y était présente indépendamment. |

**Décision** : base retenue = LIVI 2.0 (types plus corrects, architecture plus avancée, vérifié directement plutôt que supposé). Trois fichiers portés depuis la ligne d'audit (`compatibility.js`, `EarningsScreen.tsx`, `FeedScreen.tsx`).

## B. Tests

4 fichiers de tests existent uniquement dans la ligne d'audit (`api_contract_refunds_escrow`, `array_wrapper_contract_bug`, `feed_error_feedback`, `transporter_earnings_contract`).

- `feed_error_feedback.test.js`, `transporter_earnings_contract.test.js` : copiés tels quels — ils testent exactement ce qui vient d'être porté.
- `api_contract_refunds_escrow.test.js`, `array_wrapper_contract_bug.test.js` : **entièrement réécrits**. Les originaux vérifiaient un motif `Array.isArray(r) ? r : (...)` dupliqué écran par écran, qui n'existe plus dans la base LIVI 2.0 (remplacé par `normalizeList()`, une fonction unique). Réécrits pour vérifier le mécanisme réel : test unitaire de `normalizeList()`, vérification que chaque écran concerné l'appelle avec les bonnes clés (vérifié une par une par lecture directe du fichier réel, pas supposé), confirmation que 7 endpoints backend renvoient bien un tableau brut (`ok(res, rows)`), suppression de `BuyerDashboardScreen.tsx` confirmée sans référence résiduelle.

**Fait notable** : ni l'un ni l'autre des deux rapports LIVI 2.0 ne mentionne de suite `node --test` — leur méthode de vérification documentée s'arrête à `tsc` fichier par fichier. Cette session est donc la première à faire tourner la suite de tests complète contre le code de la refonte.

## C. Vérification — zéro régression introduite par la fusion

| | LIVI 2.0 seule (avant fusion) | Arbre fusionné (après fusion + corrections ci-dessous) |
|---|---|---|
| Tests | 215 | 239 (+24, les 4 fichiers ci-dessus) |
| Pass | 202 | 229 |
| Fail | 7 | 4 |
| Skip | 6 | 6 |

Les 7 échecs de LIVI 2.0 seule ont été comparés un par un à ceux de l'arbre fusionné : **ce sont exactement les mêmes**, sur des fichiers confirmés identiques entre les deux branches (donc antérieurs à la Session 20, non causés par cette fusion). Répartition :

1. **`tests/deliveryProof.test.js`** — échec d'environnement (module `bcryptjs` absent, pas de `node_modules` dans ce sandbox). Pas un bug.
2. **`tests/v25_security.test.js`** — idem (`express-rate-limit` absent). Pas un bug.
3. **`SellerOrderDetailsScreen reads total_amount first...`** — test obsolète : écrit avant que l'écran délègue le formatage à `<Money>` (constat C9), qui applique déjà `Number(amount ?? 0)` en interne (vérifié dans `Money.tsx` avant de conclure). **Corrigé** (test mis à jour, pas le code).
4. **`TransporterDashboardScreen links to Availability...`** — même cause : test écrit contre l'ancien motif `['Disponibilité', 'Availability']`, remplacé par un objet structuré `{icon, title, subtitle, route}` lors du regroupement par intention (constat C5). **Corrigé** (test mis à jour).
5. **`backup/restore procedure is documented...`** — `docs/V43_BACKUP_RESTORE_DR.md` référencé par le test mais jamais écrit, dans aucune des deux branches. **Corrigé** : document créé (voir `docs/V43_BACKUP_RESTORE_DR.md`), basé sur la lecture réelle de `scripts/v43_restore_drill.js` (codes d'échec, contrôles effectués) plutôt que rédigé de mémoire.
6. **`the delivery-proof route is the only path that can move an order to delivered`** — `DELIVERY_PROOF_REQUIRED` absent de `delivery.js`. **Investigué en profondeur (non reporté)** : recherche exhaustive de tout accès à `body.status`/`body?.status` sur l'ensemble de `src/routes/` → zéro résultat. Recherche de tout écrivain réel de `status='delivered'`/`status='completed'` sur `orders`/`shipments` → exactement 3 chemins légitimes (`delivery.js` gated par `consumeProof()`, `compatibility.js` confirm-reception gated par preuve optionnelle + `requireAuth`, `disputes.js` résolution admin) + le scheduler d'auto-release (`escrowScheduler.js`, transitionne uniquement depuis `'delivered'`, donc dépendant du premier). **Conclusion : la route générique que ce garde protégeait à l'origine n'existe plus du tout dans ce backend — supprimée à la racine plutôt que gardée.** Pas une régression : une protection structurelle (rien à contourner) plutôt qu'un garde explicite. Test réécrit pour vérifier cette réalité (absence de `body.status` partout + les 3 chemins connus toujours gated), avec une note explicite pour qu'une réintroduction future d'une route générique sans garde fasse échouer ce test.
7. **`all four former call sites now use the shared release function`** — attendu 4 appels à `releaseEscrowWithActiveCommission(c,e,`, trouvés 2 dans le périmètre testé (`delivery.js`+`disputes.js`). **Investigué en profondeur** : 2 des 3 routes originales de `delivery.js` (`/:id/confirm-reception`, `/:id/release-escrow`) ont depuis été fusionnées en une seule route dans `compatibility.js` (confirmation acheteur + preuve optionnelle + libération, en une transaction) — confirmé : `delivery.js` n'expose plus que 3 routes au total, aucune trace d'une route confirm-reception/release-escrow séparée nulle part ailleurs. **3 sites réels, pas 4 — une réduction de duplication légitime, pas une régression.** Le test conservait par ailleurs, intacte, sa vérification la plus importante (zéro fetch inline dupliqué du taux de commission) ; seul le périmètre de fichiers scannés et le compte attendu ont été mis à jour (élargi à `compatibility.js`, 4→3).

État final : **232 passent / 2 échouent (les 2 d'environnement uniquement) / 6 skip** sur 240 tests, tous vérifiés réellement exécutés (aucun résultat déclaré sans exécution). Aucun échec réel non expliqué ne subsiste.

## D. Audit authentification / OTP (prompt maître, §3-14, §42)

Le prompt maître présente la suppression de l'OTP d'inscription comme la consigne la plus critique. Vérification directe du code réel (pas des rapports passés) : **déjà fait, et fait avec plus de rigueur que ce que demande le prompt maître.**

- `services/auth.js` / `routes/auth.js` sont **identiques dans les deux branches** → antérieur à la Session 20, donc déjà en place avant même le début de la ligne d'audit numérotée.
- `POST /auth/register` : `name`/`first_name`+`last_name` + `phone` + `password` + `password_confirmation`, validé côté serveur par un `.refine()` Zod (`password===password_confirmation`) — jamais seulement côté client. Minimum 10 caractères.
- Aucun OTP, aucun SMS sur ce chemin : la fonction `verifyOtp()` qui servait à la fois login et inscription (session ouverte sans mot de passe) a été supprimée avec sa route, avec le commentaire explicite du choix.
- Mot de passe : `bcrypt.hash(password,12)`, jamais stocké en clair ; `login()` compare via hash (support double bcrypt/argon2 pour les comptes existants).
- Création **transactionnelle** (`tx()`) : `users` + `wallets` + `user_roles` + `vendors`/`transporters` en un seul bloc, rollback si un insert échoue. Le commentaire du code documente explicitement 3 bugs corrigés à cette occasion (mot de passe optionnel produisant des comptes bloqués, absence de transaction, `ON CONFLICT DO NOTHING` sur le slug vendeur masquant un vendor manquant).
- Téléphone : normalisé (`normalizePhone`), unicité vérifiée en pré-check ET par contrainte réelle (race-safe), `409 PHONE_ALREADY_REGISTERED` — jamais un 500 générique.
- Conflit de slug vendeur : `409 VENDOR_ALREADY_EXISTS` explicite, plus de `ON CONFLICT DO NOTHING` silencieux.
- `requireAuth` (§13) : vérifie le JWT, l'existence du compte, son statut, les rôles, et respecte `auth_version` (invalidation de session après changement de mot de passe) — les 7 points du prompt maître sont couverts.
- SMS/OTP **conservé** à bon escient sur deux usages distincts et légitimes, non touchés : réinitialisation de mot de passe (`/auth/otp/send` + `/auth/password/reset`) et vérification d'un moyen de paiement mobile (`/users/me/payment-methods/verify`, `/resend-otp`) — exactement la distinction demandée au §8/§50.
- Côté frontend : `RegisterScreen.tsx` a bien les champs `password`/`confirmPassword`, vérifie la correspondance avant envoi, et ne navigue jamais vers `VerifyOtpScreen`. Cet écran reste enregistré dans `RootNavigator` mais n'est référencé que depuis `ForgotPasswordScreen` — confirmé par recherche exhaustive, aucune référence résiduelle depuis Register/Login.
- 18 tests déjà présents et passants sur ce périmètre (`auth_password_registration.test.js`, `v24_authorization.test.js`, `v28_auth_sessions.test.js`) : normalisation téléphone, unicité slug, règle de confirmation de mot de passe, longueur minimale, signature `HttpError`.

**Conclusion** : aucune action de code nécessaire sur ce périmètre. Les tests d'intégration bout-en-bout explicitement demandés au §42 (ex. « connexion avec mauvais mot de passe → refus » contre une vraie base) restent **NOT POSSIBLE** dans ce sandbox (pas de PostgreSQL disponible) — seuls les tests unitaires/de contrat sur la logique pure sont exécutables ici, ce qui est déjà le cas.

## E. Fichiers modifiés cette session

| Fichier | Modification | Raison |
|---|---|---|
| `backend/livi/src/routes/compatibility.js` | Porté depuis la ligne d'audit : `/vendor/analytics` (période réelle, métriques, top produits), `/transporter/earnings` (`payouts[]`) | Ces endpoints étaient incomplets dans la base LIVI 2.0, jamais corrigés par cette branche |
| `frontend/livi/src/screens/transporter/EarningsScreen.tsx` | Remplacé intégralement (version de la ligne d'audit) | Lisait des champs jamais renvoyés par le backend ; jamais traité par LIVI 2.0 |
| `frontend/livi/src/screens/social/FeedScreen.tsx` | Ajout d'un retour visible (`Alert.alert`) sur échec d'envoi de commentaire | Porté depuis la ligne d'audit, absent de LIVI 2.0 |
| `backend/livi/tests/api_contract_refunds_escrow.test.js` | Réécrit | L'original testait un code qui n'existe plus après fusion |
| `backend/livi/tests/array_wrapper_contract_bug.test.js` | Réécrit | Idem, + comble un vide (LIVI 2.0 n'avait aucun test automatisé pour son propre correctif C0) |
| `backend/livi/tests/feed_error_feedback.test.js`, `transporter_earnings_contract.test.js` | Copiés tels quels | Aucune adaptation nécessaire |
| `backend/livi/tests/api_contract_seller_orders.test.js` | 1 assertion mise à jour | Testait un motif de code remplacé légitimement par `<Money>` (C9) |
| `backend/livi/tests/navigation_interconnection.test.js` | 2 assertions mises à jour | Testait l'ancien motif de navigation à plat, remplacé par le regroupement par intention (C5) |
| `backend/livi/tests/v35_stock_restitution_idempotency.test.js` | 1 test réécrit + 1 ajouté | Garde attendu (`DELIVERY_PROOF_REQUIRED`) sur une route générique qui n'existe plus ; remplacé par une vérification exhaustive de l'absence de toute route `body.status` + des 3 chemins réels connus |
| `backend/livi/tests/v37_commission_consistency.test.js` | 1 test mis à jour + 1 ajouté | Comptage figé à 4 sites, devenu 3 après une fusion légitime de routes dans `compatibility.js` ; portée élargie en conséquence |
| `backend/livi/docs/V43_BACKUP_RESTORE_DR.md` | Créé | Référencé par un test existant depuis une session antérieure, jamais rédigé |
| 5× `RAPPORT_AUDIT_SESSION21-25_*.md` | Copiés depuis la ligne d'audit pour archive | Traçabilité historique — certains correctifs de code qu'ils décrivent ont été supplantés par la version LIVI 2.0 (voir section A ci-dessus pour le détail exact) |
| `backend/livi/src/services/auth.js` | `ON CONFLICT (user_id,role) DO NOTHING` ajouté à l'INSERT dans `user_roles` de `register()` | **Critique** — porté depuis un correctif appliqué directement sur GitHub, absent des deux ZIP locaux ; sans lui, chaque inscription contre la vraie base échouait en 500 (voir section F) |
| `backend/livi/tests/auth_password_registration.test.js` | 1 test de régression ajouté | Vérifie la présence de la clause `ON CONFLICT` ci-dessus par lecture de source (aucun trigger Postgres réel n'existe dans ce sandbox pour le vérifier par exécution) |
| `.github/workflows/supabase-migrations.yml` | Compteur de migrations attendu : 39 → 41 | Obsolète dans les deux ZIP locaux ; le dépôt GitHub avait déjà la valeur correcte (41, compte réel actuel) |
| `backend/livi/src/routes/webhooks.js` | try/catch sur `23505` ajouté à l'INSERT dans `partner_payment_events` | Deux livraisons vraiment simultanées du même webhook pouvaient faire échouer la requête perdante en 500 brut au lieu d'une réponse idempotente (§25-26, §46) |
| `backend/livi/tests/v21_webhook_integrity.test.js` | Réécrit entièrement (9 tests) | Les 5 tests originaux ne vérifiaient aucun import réel du fichier testé |
| `docs/KYC_STORAGE_DURABILITY.md` | Section "à vérifier après déploiement" mise à jour | Vérifié directement via l'API Render (accès désormais disponible) : confirmé, pas théorique — aucun disque persistant sur `livi-apk` (plan free) |
| `migrations/042_v56_transporter_single_active_mission.sql` | Créé — index unique partiel sur `shipments(transporter_id)` | Empêche structurellement qu'un transporteur ait 2 missions actives simultanément (§28), gap réel de concurrence trouvé dans `findNextCandidate()` |
| `backend/livi/src/routes/compatibility.js` | Route `/accept` : 23505 → 409 propre ; route `/arrive` : passée en transaction unique | §28 (gap ci-dessus) et §29 (doublet UPDATE+INSERT non-transactionnel manqué par un correctif antérieur sur une route sœur) |
| `backend/livi/tests/v56_transporter_dispatch_concurrency.test.js` | Créé (3 tests) | Couvre les deux correctifs ci-dessus |
| `.github/workflows/supabase-migrations.yml` | Compteur : 41 → 42 | Suite à l'ajout de la migration 042 |
| `.github/workflows/generate-lockfiles.yml` | Créé | §41 — génère de vrais lockfiles via les serveurs GitHub (accès réseau réel), plutôt que d'en fabriquer un à la main |

## F. Réconciliation à 3 voies — le dépôt GitHub réel contenait un correctif critique absent des deux ZIP

Une fois l'accès GitHub (`cesarsiby/livi-apk`) débloqué (problème de permission du connecteur, résolu côté utilisateur), comparaison de l'état réel du dépôt avec l'arbre fusionné ci-dessus. **Le dépôt GitHub n'est ni le ZIP "main" ni le ZIP "LIVI 2.0" — c'est une troisième lignée**, un instantané "sessions 9-16" chargé en bloc le 2026-09-06, suivi de 3 modifications manuelles directes le même jour (historique de commits entièrement tracé, les 8 commits du dépôt examinés un par un) :

1. **La saga `compatibility.js`** (upload → suppression → re-upload sous `compatibility-1.js` → renommage) : contenu final comparé ligne à ligne à celui de l'arbre fusionné. Structurellement identique (mêmes correctifs V48/V49/V54 : dispatch de missions, validation KYC, gestion des conflits de slug/SKU, preuves QR/PIN, flux social, routes admin), à l'exception des deux enrichissements `/vendor/analytics` et `/transporter/earnings` que Session 26 avait déjà sciemment portés dans l'autre sens (section A) — le dépôt GitHub datant d'avant ce correctif, aucune perte, rien à porter dans ce sens.

2. **`backend/livi/src/services/auth.js` — correctif critique absent des deux ZIP.** La migration 037 (`trg_sync_user_roles`) ajoute un trigger `AFTER INSERT ... ON users` qui insère déjà `(user_id, role)` dans `user_roles` au moment de la création de l'utilisateur. `register()`, dans les deux ZIP locaux, insérait ensuite manuellement la même ligne **sans `ON CONFLICT`** — un commentaire y affirmait explicitement que c'était volontaire ("première ligne de rôle d'un nouvel utilisateur, un conflit serait un vrai bug"), raisonnement vrai avant la migration 037 mais jamais mis à jour après. **Conséquence : toute tentative d'inscription contre la vraie base Supabase (où ce trigger existe réellement) aurait échoué avec une 500, sans exception, pour 100% des comptes.** Ce correctif avait été appliqué directement sur GitHub le 2026-09-06, jamais reporté dans le ZIP fourni en début de session. **Porté immédiatement dans l'arbre fusionné** (`ON CONFLICT (user_id,role) DO NOTHING`, identique à GitHub). Recherche exhaustive de `INSERT INTO user_roles` dans tout le backend : un seul autre site (`routes/users.js`, ajout de rôle a posteriori), déjà correctement protégé par `ON CONFLICT` — bug isolé à `register()`, pas systémique. Un test de régression a été ajouté (`auth_password_registration.test.js`) vérifiant la présence littérale de la clause, avec une note explicite sur le fait qu'aucune exécution réelle dans ce sandbox ne peut déclencher le trigger pour le vérifier autrement.

3. **`.github/workflows/supabase-migrations.yml` — compteur de migrations obsolète.** Le fichier présent dans l'arbre fusionné (hérité des deux ZIP) vérifiait encore `count === 39` ; le dépôt GitHub avait déjà été corrigé à `41`, qui est le compte réel actuel (`ls migrations/*.sql` confirme 41, jusqu'à `041_v55_...`/`041_v54_seed_categories.sql`). Corrigé dans l'arbre fusionné pour correspondre. Ce workflow n'est déclenché que manuellement (`workflow_dispatch`) — il n'a pas été exécuté par cette session (nécessiterait `secrets.SUPABASE_DATABASE_URL` réel).

**Vérification finale après ces 2 correctifs** : 233 passent / 2 échouent (les 2 d'environnement, inchangés) / 6 skip, sur 241 tests.

**Point de sécurité pour la suite** : ce dépôt étant privé et cette découverte ayant nécessité de tracer l'historique complet des commits pour être sûr de ne rien manquer, toute session future disposant d'un accès GitHub sur ce dépôt devrait répéter cette vérification (comparer le contenu réel du dépôt à l'arbre de travail local) avant de pousser quoi que ce soit — un ZIP local n'est jamais automatiquement synchronisé avec des modifications faites directement sur GitHub.



## G. Suite de session — KYC, migrations, infra Render (webhooks + reprise après le blocage GitHub)

**Paiement/webhooks (§24-26)** : `services/orderPricing.js`/`finance.js` déjà audités en section G. Idempotence webhook vérifiée en détail : la contrainte `UNIQUE(provider,event_id)` (migrations/001) protège bien contre un double crédit financier en cas de double livraison vraiment simultanée du même événement, mais l'INSERT correspondant n'attrapait pas cette collision — la requête perdante remontait en 500 brut au lieu de la réponse idempotente propre que reçoit le cas séquentiel. **Corrigé** (`routes/webhooks.js`, try/catch sur le code Postgres `23505`). Au passage, les 5 tests existants de `v21_webhook_integrity.test.js` ne vérifiaient aucun import réel du fichier testé (`assert.equal('quarantined','quarantined')` — vrai même si la route entière est supprimée) : réécrits pour vérifier le texte source réel.

**KYC — permissions documents (§32)** : déjà correctement implémenté (commentaires du code référençant explicitement "section 32", `USER_DOCUMENT_ACCESS`/`ADMIN_DOCUMENT_ACCESS" distincts) — vérifié, rien à corriger.

**KYC — stockage durable (§33)** : `docs/KYC_STORAGE_DURABILITY.md` documentait déjà honnêtement le risque (fichiers sur disque local, non persistant) sans jamais l'avoir vérifié contre la config Render réelle (hors de portée à l'époque). **Vérifié cette session, accès Render désormais disponible** : le service `livi-apk` (`srv-dab194favr4c73egg38g`) tourne sur le plan `free`, sans disque attaché. Le risque documenté n'est donc pas théorique — confirmé applicable tel quel au service réellement déployé. Document mis à jour en conséquence.

**Migrations — BEGIN/COMMIT internes (§35)** : un premier grep imprécis (`^BEGIN\|^COMMIT`) a signalé 17 fichiers à tort — en réalité, tous les résultats étaient des blocs `BEGIN...END` de corps de fonction PL/pgSQL (`CREATE FUNCTION ... AS $$ BEGIN ... END; $$`), pas des instructions de contrôle transactionnel. Recherche corrigée (`^BEGIN;`/`^COMMIT;`, avec point-virgule) : **zéro fichier contient réellement une instruction `BEGIN;`/`COMMIT;` autonome.** Le runner (`src/utils/migrate.js`) est bien le seul à gérer la transaction — §35 est déjà respecté, aucune correction nécessaire. Mentionné ici explicitement parce que la première passe aurait pu conduire à modifier à tort des corps de fonction PL/pgSQL (dont celui du trigger `livi_sync_user_roles`, central au correctif critique de la section F) si elle n'avait pas été revérifiée avant toute action.

**Lockfile (§41)** : aucun `package-lock.json`/`yarn.lock` nulle part dans le dépôt (backend et frontend). Réel, non corrigé — générer un lockfile exige une vraie résolution de dépendances via `npm install` avec accès réseau au registre npm, indisponible dans ce sandbox. Un lockfile fabriqué à la main serait un faux exploitable présenté comme réel, explicitement interdit par la mission. **À faire avec accès réseau réel** (poste local ou CI).

**Découverte infra (Render)** : un **second service Render** existe, nommé `Livis` (`srv-da0s4ufqj5pc73b6ahu0`), pointant vers un dépôt différent (`github.com/cesarsiby/Livis`, avec majuscule, `rootDir` vide, build `yarn` au lieu de `npm`), créé le 16 août (avant `livi-apk`, créé le 31 août). Non investigué plus avant cette session — signalé pour clarification : legacy, doublon, ou service actif distinct ?

**Constat additionnel** : `healthCheckPath` est vide sur le service `livi-apk` — Render ne s'appuie donc sur aucun des deux endpoints `/health`/`/ready` (§39) pour vérifier la santé d'une nouvelle instance avant de lui router du trafic après déploiement. Non corrigé cette session (c'est un réglage de configuration Render, pas du code) — à définir dans le dashboard Render (Settings → Health Check Path) une fois `/ready` jugé suffisamment complet.

## J. Dispatch transporteur et position (§28-30)

**§28 — concurrence de dispatch, gap réel trouvé et corrigé.** `findNextCandidate()` (`services/missionDispatch.js`) filtre déjà les transporteurs ayant une mission active — mais par un simple `SELECT`, jamais verrouillé. Deux appels `dispatchNextOffer()` concurrents pour **deux livraisons différentes** peuvent tous les deux lire "ce transporteur est libre" avant qu'aucun n'ait rien écrit : chacun ne verrouille que sa propre ligne `shipments` (`FOR UPDATE` sur `WHERE id=$1`), jamais l'ensemble des lignes du transporteur candidat lui-même. Le même transporteur peut alors recevoir deux offres, et `POST /transporter/missions/:id/accept` ne vérifiait que l'état de la mission acceptée — jamais si ce transporteur avait déjà une autre mission active. Il pouvait donc accepter les deux, violant l'invariant explicitement documenté dans le code lui-même ("un transporteur ne peut jamais accepter deux missions simultanément").

**Corrigé par une contrainte DB plutôt qu'une vérification applicative** (exactement ce que suggère le §28 : *"protection transactionnelle et/ou contrainte DB appropriée"* — une contrainte reste vraie même sous une course différente de celle identifiée aujourd'hui) :
- `migrations/042_v56_transporter_single_active_mission.sql` : index unique partiel sur `shipments(transporter_id)` restreint à `status IN ('assigned','picked_up','in_transit','arrived')` — au plus une mission active par transporteur, garanti par le moteur.
- `routes/compatibility.js`, route `/accept` : violation de cette contrainte (23505) traduite en `409 TRANSPORTER_ALREADY_HAS_ACTIVE_MISSION` plutôt que remontée en 500 générique.
- CI (`supabase-migrations.yml`) : compteur de migrations mis à jour 41 → 42.
- 3 tests ajoutés (`v56_transporter_dispatch_concurrency.test.js`), dont un qui compare littéralement la liste de statuts entre le filtre applicatif et la contrainte DB pour qu'un futur ajout de statut ne puisse pas silencieusement rouvrir l'écart entre les deux.

**§29 — position + événement, un doublet non-transactionnel manqué par un correctif antérieur.** `POST /transporter/location` (la mise à jour de position continue) était déjà corrigée — commentaire du code référençant explicitement "section 29". Mais `POST /transporter/missions/:id/arrive` (l'étape "arrivé à destination", un événement ponctuel distinct) avait le même défaut — deux `pool.query()` séparés, jamais rattrapés à l'époque : un crash entre les deux pouvait laisser `status='arrived'` sans la ligne `shipment_events` correspondante. Recherche exhaustive de tout `INSERT INTO shipment_events` dans le backend : c'était la seule occurrence restante hors transaction. **Corrigé** (même traitement : `tx()`).

**§30 — preuves de livraison.** Déjà auditées en substance à l'occasion de la section G (chemins gated par `consumeProof()`, cohérence pickup/delivery). Rien de nouveau à signaler ici au-delà de ce qui précède.

## K. Produits (§17-19) et vérification finale (§31)

**§31 — request_id** : déjà entièrement standardisé sur `res.locals.requestId` (13 usages, 7 fichiers) ; `req.id` : zéro occurrence nulle part. Rien à faire.

**§17-19 — audit produits.** Création (`POST /vendor/products`) déjà correcte : validation Zod complète, conflit de slug → 409 explicite (commentaire du code référençant "section 18"). **Modification (`PUT /vendor/products/:id`) acceptait `req.body` brut, sans la moindre validation applicative** — un prix négatif, un stock non numérique ou un statut hors énumération n'étaient rattrapés que par les contraintes DB (`price_xof>0`, `stock>=0`, `status IN(...)`), ressortant en 500 générique plutôt qu'en 422 clair. Important à noter : **l'intégrité des données n'a jamais été en danger** (les contraintes DB tenaient déjà) — uniquement la qualité de l'erreur retournée (§14-15). Corrigé : même schéma Zod que POST, champs optionnels. Test dédié ajouté (`product_update_validation.test.js`).

**Leçon méthodologique à noter pour la suite** : ce correctif (ajout d'un commentaire + validation avant le code existant) a fait échouer un test préexistant sans rapport (`merged_category_photos_video.test.js`), qui découpait le texte de la route avec une fenêtre fixe de 900 caractères — désormais insuffisante puisque le commentaire ajouté pousse le contenu recherché plus loin dans le fichier. Corrigé (fenêtre élargie à 1900). **Tout ajout de commentaire ou de code en tête d'une route doit être suivi d'un `node --test` complet, pas seulement du fichier qu'on vient de modifier** — cette session a laissé passer ce genre de collision à plusieurs reprises avant de la corriger à chaque fois (voir aussi section G, tests réécrits pour la même raison sous-jacente : une fenêtre de tranche de texte n'est correcte qu'au moment où elle est écrite).

## L. Commandes (§20) et idempotence de la création (§25)

**§20 — audit de `POST /orders`.** Déjà exemplaire : un seul vendeur par commande imposé, prix et stock relus avec `FOR UPDATE` au moment de la commande (protège contre une survente entre deux commandes concurrentes sur le même stock), frais de livraison calculés côté serveur (le commentaire du code confirme que le montant envoyé par le client était auparavant utilisé tel quel — corrigé), commission capturée en snapshot à la création (§22, avec référence à la migration correspondante). Rien à corriger.

**§25 — un vrai trou d'idempotence trouvé, hors paiement cette fois.** Le mécanisme `idempotency_keys` existe déjà et est déjà branché sur `/:id/cancel` — mais pas sur la création de commande elle-même, la route la plus exposée à un double-tap ou une requête rejouée après un timeout réseau (chaque tentative décrémente le stock et crée sa propre ligne escrow indépendamment). **Corrigé** en réutilisant exactement le même mécanisme déjà en place (strictement additif : un client qui n'envoie pas l'en-tête `Idempotency-Key` n'est pas affecté). 3 tests ajoutés, vérifiant au passage que la réponse rejouée est de forme identique à une réponse fraîche (`ok()`).

**Balayage §49-51-55 (recherche large TODO/FIXME/mock/fake/placeholder/EXTERNAL_PROVIDER_REQUIRED/unreadCount)** : rien de neuf trouvé — confirme des pratiques déjà saines plutôt qu'un problème. Les 4 adaptateurs externes (SMS, push, paiement, stockage objet) échouent honnêtement avec `EXTERNAL_PROVIDER_REQUIRED`/`PARTNER_PAYMENT_REQUIRED` quand non configurés, jamais de succès simulé (§50-51, conforme). `unreadCount` (frontend, camelCase) traduit bien `unread_count` (API, snake_case) à la frontière — un bug historique à ce sujet est explicitement documenté comme corrigé dans le commentaire du code (`routes/notifications.js`). Les nombreuses autres occurrences de "placeholder" sont du texte d'espace réservé légitime sur des champs de saisie (`<TextInput placeholder=...>`), pas des données fictives.



## H. Ce qui reste ouvert

- **Sécurité financière (§21-27 du prompt maître)** : les deux gaps signalés initialement (C6, C7 ci-dessus) ont été investigués en profondeur plus tard dans cette même session et confirmés être des tests obsolètes, pas des régressions — voir la mise à jour en fin de section C. `services/orderPricing.js` (`calculateBasePrice`/`calculateCommission`/`calculateBuyerPrice`/`calculateVendorNet`, arithmétique BigInt, vendor-net calculé en résidu pour garantir l'équilibre du ledger par construction) et `services/finance.js` (`releaseEscrowWithActiveCommission`, snapshot de commission à la création plutôt que taux ré-interrogé au release) couvrent déjà très précisément ce que demandent les §21-22 — vérifié directement, pas supposé.
- **Paiement/webhooks (§24-26), KYC (§32-33), migrations (§35)** : audités en section G ci-dessus.
- **Toujours ouvert** : lockfile (§41, workflow de génération préparé — voir `.github/workflows/generate-lockfiles.yml` — mais jamais exécuté, nécessite l'écriture GitHub ou une exécution manuelle), `healthCheckPath` vide sur `livi-apk` (§39, réglage Render, pas du code). Le second service Render (`Livis`) laissé de côté à la demande explicite d'Aimé.
- **Rien n'a encore été poussé sur GitHub, Supabase ou Render** au moment de la rédaction de ce rapport — voir section F ci-dessus pour l'état de la réconciliation qui précède ce push ; toujours bloqué en écriture au moment de la rédaction (voir échanges de session — probable bug connu de l'intégration GitHub de Claude pour les comptes personnels avec dépôt privé). Un ZIP de secours de l'arbre complet a été fourni en attendant.

## I. À vérifier après déploiement sur GitHub / Supabase / Render

- Les 2 échecs d'environnement (D1, D2 ci-dessus) doivent être confirmés réellement corrigés une fois `npm ci` exécutable avec accès réseau.
- `docs/V43_BACKUP_RESTORE_DR.md` (section H de ce document) n'a été vérifié que par lecture de code, jamais exécuté contre une instance Supabase réelle.

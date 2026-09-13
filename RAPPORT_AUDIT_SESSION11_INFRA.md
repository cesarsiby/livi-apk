# Session 11 — Ledger, transport, request_id, CI/health-ready

Suite directe de la Session 10. Périmètre : sections 27–31 et 39–41 du
prompt maître.

## A. Ledger — code mort et potentiellement dangereux supprimé (section 27)

`services/ledger.js#postLedgerTransaction` ouvrait sa **propre**
transaction interne (`tx()`), contrairement à `services/market.js#postBalanced`
(utilisé partout ailleurs dans le code financier : `finance.js`,
`webhooks.js`, `disputes.js`, `payouts.js`, `financialCorrections.js`), qui
participe correctement à la transaction de l'appelant. Vérifié :
`postLedgerTransaction` n'était **appelé nulle part** dans tout le dépôt
(import mort dans `routes/escrow.js`). Dangereux s'il avait été utilisé un
jour à l'intérieur d'une transaction existante en pensant qu'il se
comporte comme `postBalanced` : une écriture comptable aurait pu rester
validée même si l'opération englobante était annulée (`ROLLBACK`).
Supprimé (fichier entier + import mort) plutôt que corrigé sur place,
`postBalanced` couvrant déjà exactement le même besoin correctement.

Reste du système financier (`wallet.js#payableBalance/ledgerOwedToUser`,
`withdrawal.js#calculateWithdrawalFee`, `routes/payouts.js`) : relu
intégralement, aucun bug trouvé — vérrou consultatif par utilisateur sur
les demandes de payout, vérification de solde avant paiement, protection
contre le double règlement (`status IN ('processing','pending')`), contre
un payout incohérent (`gross!==fee+net`), écritures via `postBalanced`
correctement intégrées à la transaction. Confirmé correct, pas modifié.

## B. Transport — position + événement non transactionnels (section 29)

`POST /transporter/location` (`routes/compatibility.js`) faisait trois
`pool.query()` séquentiels indépendants (mise à jour de la position,
recherche de la mission active, insertion de l'événement) — un échec
transitoire entre deux appels pouvait laisser la position à jour sans
événement correspondant, sans aucun moyen de le détecter après coup.
Regroupé dans une seule transaction.

Dispatch et acceptation de mission (`services/missionDispatch.js`,
`routes/compatibility.js` `/transporter/missions/:id/accept`) : relu
intégralement — le modèle d'acceptation atomique déjà en place (`UPDATE
shipments SET ... WHERE ... (offered_to=$2 AND transporter_id IS NULL AND
...) RETURNING *`) protège correctement contre deux transporteurs
acceptant la même mission simultanément (l'UPDATE ne matche qu'une seule
fois, peu importe l'ordre d'arrivée). Confirmé correct, pas modifié.

## C. `request_id` — déjà standardisé (section 31)

Recherche complète de `req.id` dans tout le dépôt : **aucune occurrence**.
`res.locals.requestId` est la seule source utilisée, de façon cohérente,
dans les 6 fichiers concernés (`middleware/requestId.js`,
`middleware/requestLog.js`, `server.js`, `utils/http.js`,
`routes/orders.js`, `routes/kyc.js`). Cette préoccupation du prompt maître
ne s'applique pas à l'état actuel du dépôt — vérifié, pas de correction
nécessaire. `middleware/requestLog.js` (logs structurés par requête :
request_id, méthode, chemin, statut, durée ; ne journalise jamais mots de
passe/tokens/corps de requête) également relu : conforme à la section 16.

## D. CI — fichier invisible pour GitHub Actions (section 40) + régression trouvée et corrigée

**Confirmé** : `backend/livi/.github/workflows/ci.yml` existait (fichier
complet, deux jobs, suite unitaire + suite PostgreSQL réelle) mais GitHub
Actions ne scanne que `.github/workflows/` à la **racine du dépôt** —
seul `supabase-migrations.yml` s'y trouvait. Ce pipeline n'avait donc
**jamais tourné**, sur aucun push ni PR, malgré son contenu correct.

Déplacé vers `.github/workflows/backend-ci.yml` (nom distinct de
`supabase-migrations.yml`), avec ajout de `defaults.run.working-directory:
backend/livi` sur les deux jobs (le fichier utilise des commandes
relatives à `backend/livi/`, comme `supabase-migrations.yml` le fait déjà
pour le même besoin). YAML validé réellement (parsé avec `python3 -c
"import yaml..."`, pas une simple relecture visuelle).

**Régression trouvée et corrigée dans la foulée** : `tests/v44_ci_cd_preparation.test.js`
et `tests/v45_staging_environment.test.js` vérifiaient le contenu de ce
fichier à son **ancien** chemin (`backend/livi/.github/workflows/ci.yml`)
— exactement l'emplacement invisible pour GitHub Actions. Ces tests
passaient donc en confirmant un fichier qui ne s'exécutait jamais
réellement. Après le déplacement, 6 tests ont commencé à échouer
(logique : le fichier n'était plus au chemin qu'ils vérifiaient) — détecté
immédiatement par la réexécution complète de la suite, pas ignoré. Les deux
fichiers de test ont été mis à jour pour vérifier le nouveau chemin correct
(`../../.github/workflows/backend-ci.yml` relatif à `backend/livi/`),
pas le code revenu en arrière — le chemin qu'ils vérifiaient était le bug,
pas le correctif.

## E. `/health` vs `/ready` (section 39)

`/health` interrogeait la base de données (`SELECT 1`) — un incident
PostgreSQL transitoire (pic de charge Supabase, pool épuisé) aurait pu
faire croire à l'orchestrateur (Render ou autre) que le **processus**
était mort et le redémarrer, alors que le processus Node lui-même allait
bien et se serait rétabli seul dès que la base répondrait à nouveau.

`/health` simplifié : ne dépend plus que du processus lui-même. Nouveau
`/ready` : vérifie la connexion DB, la présence de `schema_migrations`
avec au moins une ligne, et qu'une colonne ajoutée par la migration la
plus récente de ce dépôt (`escrow_transactions.vendor_net_amount_snapshot`,
migration 040) existe réellement — plutôt qu'un nombre de migrations codé
en dur (qui se périmerait à chaque nouvelle migration sans mise à jour
manuelle). Chemins réels une fois montés : `/api/v1/health` et
`/api/v1/ready` (`server.js` : `app.use('/api/v1', api)`).

## F. Lockfile — toujours bloqué dans ce bac à sable (section 41)

Aucun `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` nulle part dans le
dépôt (backend ni frontend) — confirmé à nouveau. Un vrai lockfile exige de
résoudre l'arbre de dépendances contre le registre npm réel, ce qui exige
un accès réseau que ce bac à sable n'a pas (`npm install` échoue toujours
avec une 403, comme confirmé en Session 9). Une session précédente avait
déjà documenté correctement cette même limite dans les commentaires de
`ci.yml`/`Dockerfile` (`npm install` au lieu de `npm ci`, pas de
`cache: 'npm'`) plutôt que de la contourner — rien à ajouter de plus
honnête que ce qui est déjà écrit là. **À faire dans un environnement avec
accès réseau** : `npm install` (backend ET frontend), committer les deux
`package-lock.json`, puis remettre `npm ci` + `cache: 'npm'` dans
`backend-ci.yml`.

## G. Vérifié réellement

- `node --check` sur tous les fichiers backend touchés cette session :
  PASS.
- YAML du workflow relocalisé : parsé réellement avec PyYAML, valide,
  `working-directory: backend/livi` confirmé sur les deux jobs.
- Suite de tests complète réexécutée à chaque étape. Une régression réelle
  (6 tests) a été introduite par le déplacement du CI, détectée
  immédiatement, et corrigée en mettant à jour les tests pour vérifier le
  bon chemin (pas en annulant le correctif). État final : **175/186
  PASS**, mêmes 5 échecs préexistants qu'en Session 10 (sans rapport,
  déjà diagnostiqués individuellement), aucune régression nette.

## H. NON exécuté / à vérifier après déploiement

- Le workflow `backend-ci.yml` n'a jamais tourné dans GitHub Actions
  (pas d'accès à GitHub depuis ce bac à sable) — à confirmer après le
  premier push que les deux jobs se déclenchent et passent réellement.
- `docs/V43_BACKUP_RESTORE_DR.md`, référencé par `backend-ci.yml`
  (`npm run restore:drill`) et par `tests/v43_backup_restore_dr.test.js`,
  est absent du dépôt (confirmé par recherche complète, y compris dans la
  structure imbriquée `backend/livi/backend/docs/` où vivent
  d'autres documents V32/V33/V34) — écrire ce document exige de décrire
  des procédures de sauvegarde/restauration spécifiques à Supabase que je
  ne peux pas vérifier sans accès à Supabase ; à traiter dans une session
  dédiée plutôt que d'inventer des étapes non vérifiées.
- `/ready` n'a pas pu être appelé contre une vraie base de données dans ce
  bac à sable.

## I. Fichiers modifiés

| Fichier | Modification | Impact |
|---|---|---|
| `backend/livi/src/services/ledger.js` | **Supprimé.** | Élimine un risque d'atomicité latent, jamais utilisé. |
| `backend/livi/src/routes/escrow.js` | Import mort retiré. | Cohérence avec la suppression ci-dessus. |
| `backend/livi/src/routes/compatibility.js` | `/transporter/location` transactionnel. | Position et événement toujours cohérents. |
| `backend/livi/src/routes/health.js` | `/health` simplifié, `/ready` ajouté. | Redémarrages inutiles évités en cas d'incident DB transitoire. |
| `.github/workflows/backend-ci.yml` | **Déplacé** depuis `backend/livi/.github/workflows/ci.yml`, `working-directory` ajouté. | Le pipeline CI va enfin réellement s'exécuter sur GitHub. |
| `backend/livi/tests/v44_ci_cd_preparation.test.js` | Chemin mis à jour vers le nouvel emplacement. | Corrige la régression introduite par le déplacement ci-dessus. |
| `backend/livi/tests/v45_staging_environment.test.js` | Idem. | Idem. |

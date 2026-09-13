# Session 9 — Suppression OTP/SMS de l'inscription + 3 bugs systémiques

Suite directe de la Session 8 (voir `CHANGELOG_SESSION.md`). Cette session
répond au "PROMPT MAÎTRE" transmis en début de conversation. Périmètre de
cette session : **authentification uniquement** (sections 3–8, 13, 42, 48 du
prompt maître), plus trois bugs systémiques découverts en cours d'audit qui
touchent l'ensemble de l'API (sections 14, 15, 35). Le reste du prompt
maître (produits, commandes, paiement, escrow, transport, KYC storage,
CI/CD, matrice de traçabilité complète) n'a **pas** été traité dans cette
session — voir "Reste à faire" en bas de ce document.

## A. Constat de départ (vérifié dans le code, pas supposé)

Avant toute modification, l'inscription et la connexion réelles (celles
appelées par `RegisterScreen`/`LoginScreen`, pas l'endpoint `/auth/login`
existant mais jamais utilisé par le frontend) étaient **entièrement basées
sur OTP**, sans aucun mot de passe :
- Inscription : nom/prénom/téléphone → `POST /auth/register` (créait déjà
  le compte, mais **sans mot de passe** — le champ n'existait pas dans
  l'écran) → OTP envoyé → écran de vérification → session ouverte.
- Connexion : téléphone seul → OTP envoyé → écran de vérification → session
  ouverte. Aucun champ mot de passe n'existait sur `LoginScreen`.

Conséquence directe confirmée dans le code : un compte fraîchement créé
avait `password_hash = NULL` et ne pouvait plus jamais se reconnecter une
fois sa session expirée, puisque `login()` exige un mot de passe. C'est ce
point précis que corrige cette session.

## B. Suppression OTP/SMS — ce qui a changé

**Conservé sans modification** (usage légitime, hors périmètre de la
suppression) :
- `sendOtp()` / `POST /auth/otp/send` — toujours utilisé, uniquement pour
  `password_reset`.
- `resetPasswordWithOtp()` / `POST /auth/password/reset` — flux "mot de
  passe oublié", inchangé.
- `/users/me/payment-methods/verify` et `/resend-otp`
  (`routes/compatibility.js`) — vérification OTP d'un moyen de paiement
  mobile money, sans rapport avec l'inscription/connexion.
- La table `auth_otp_challenges` et sa colonne `purpose`.

**Supprimé** (devenu backdoor après le changement — un compte pouvait être
créé et une session ouverte sans jamais fournir de mot de passe) :
- `verifyOtp()` (`src/services/auth.js`) et sa route `POST /auth/otp/verify`.
- `VerifyOtpScreen` a perdu toute sa logique register/login (elle ne gérait
  plus que `password-reset` de toute façon) ; son seul appelant restant est
  `ForgotPasswordScreen`.
- `authApi.verifyOtp`, `AuthProvider.verifyOtp`. `OtpPurpose` réduit à
  `'password_reset'`.

**Nouveau flux (conforme section 4 du prompt maître)** :
Inscription = nom + prénom + téléphone + mot de passe + confirmation →
validation → création atomique du compte → session ouverte immédiatement.
Connexion = téléphone + mot de passe → session. Aucun OTP, aucun SMS, aucun
écran de vérification dans ces deux parcours.

## C. Bugs corrigés (backend)

1. **Mot de passe optionnel** (`services/auth.js`, `register()`) — était
   `password?:` avec `password_hash=null` si absent ; désormais requis
   (422 `PASSWORD_REQUIRED` sinon), haché en bcrypt(12) comme le reste du
   projet.
2. **Inscription non transactionnelle** — 4 à 5 `pool.query()` séquentiels
   sans transaction (user, wallet, user_roles, vendor/transporter) ;
   remplacé par `tx()` (le helper déjà existant dans `config/db.js`, utilisé
   ailleurs dans le projet) : tout ou rien.
3. **Slug vendeur `ON CONFLICT DO NOTHING`** — deux vendeurs de même nom
   généraient le même slug ; l'insert vendeur était silencieusement
   ignoré alors que user/role/wallet étaient déjà validés → compte
   "vendeur" sans ligne `vendors`, cassé sur tous les écrans vendeur.
   Corrigé : slug suffixé par 8 caractères de l'id (fraîchement généré,
   donc jamais en collision) + erreur explicite `409
   VENDOR_ALREADY_EXISTS` en cas de conflit résiduel (plus de `DO
   NOTHING`).
4. **Absence de normalisation téléphone** — aucune normalisation
   n'existait nulle part dans le dépôt ; `+223 74 12 34 56` et
   `+22374123456` étaient deux valeurs distinctes pour la contrainte
   d'unicité et pour `login()`. Nouveau : `src/utils/phone.js`
   (`normalizePhone`), appliqué avant la vérification d'unicité et le
   stockage. Ne suppose pas d'indicatif pays par défaut (voir commentaire
   dans le fichier).
5. **Code d'erreur téléphone déjà utilisé** — la vérification existait déjà
   (409) mais sans code machine ; ajout de `PHONE_ALREADY_REGISTERED`, avec
   un filet de sécurité sur la vraie violation de contrainte DB (23505) pour
   couvrir la course entre deux inscriptions strictement simultanées.
6. **Minimum mot de passe incohérent** — 8 caractères à l'inscription, 10
   à la réinitialisation (même compte, même mot de passe, deux règles
   différentes). Aligné à 10 partout.
7. **Confirmation du mot de passe absente côté backend** — le schéma zod
   n'avait pas de champ `password_confirmation` ; ajouté avec
   `.refine()` (validation serveur, jamais uniquement côté client).

## D. Trois bugs systémiques trouvés en auditant le fichier ci-dessus (hors périmètre auth, mais confirmés touchant l'ensemble de l'API)

1. **`HttpError` — ordre des paramètres inversé** (`src/utils/http.js`).
   Le constructeur était `(status, message, details, code)`. Les **202**
   sites d'appel du projet (`grep -c "new HttpError("` = 202) passent
   systématiquement un code machine en 3ᵉ argument
   (`new HttpError(409, '...', 'PHONE_ALREADY_REGISTERED')`), jamais un
   objet `details`. Résultat réel en production : `error.code` valait
   **`'INTERNAL_ERROR'` sur absolument toutes les erreurs non-500 de
   l'API**, quel que soit le code métier réellement levé (le handler
   global fait `code: err.code || 'INTERNAL_ERROR'`). Corrigé en inversant
   l'ordre vers `(status, message, code, details)` — aucun site d'appel
   n'a eu besoin d'être modifié, l'ordre correspond déjà à leur usage réel.
2. **Erreurs zod transformées en 500** (`src/server.js`). Le handler
   d'erreur global faisait `err.status||500` ; une `ZodError` n'a pas de
   `.status`, donc **toute requête mal formée sur n'importe quelle route
   du projet retournait 500 "Erreur interne du serveur"** au lieu de 400
   `VALIDATION_ERROR`. C'est exactement l'exemple cité en premier dans la
   section 14 du prompt maître. Corrigé par une détection dédiée (par
   duck-typing sur `name`/`issues`, sans dépendre de l'export exact de
   zod) qui renvoie 400, `VALIDATION_ERROR`, et le détail champ par champ.
3. **Migrations avec `BEGIN;`/`COMMIT;` internes en plus de la transaction
   du runner** (section 35 du prompt maître). Confirmé réel (pas
   seulement théorique) : `migrate.js` ouvre déjà sa propre transaction
   par fichier (`BEGIN` / exécution / `INSERT INTO schema_migrations` /
   `COMMIT`) ; 16 migrations contenaient **en plus** un `BEGIN;`/`COMMIT;`
   littéral au niveau SQL. Le `COMMIT;` interne validait la transaction du
   runner en avance ; si l'écriture de `schema_migrations` échouait
   ensuite (ou si le process s'arrêtait entre les deux), la migration se
   retrouvait appliquée en base **sans être enregistrée comme appliquée**
   — prochaine exécution : nouvelle tentative sur un schéma déjà modifié,
   échec probable sur les `ALTER TABLE`/`CREATE TABLE` non idempotents.
   Corrigé en retirant les `BEGIN;`/`COMMIT;` internes des 16 fichiers
   (`009`, `010`, `011`, `012`, `013`, `014`, `015`, `016`, `017`, `021`,
   `024`, `027`, `028`, `029`, `030`, `031`) ; les blocs `DO $$ BEGIN ...
   END $$;` (PL/pgSQL, pas du contrôle transactionnel) n'ont pas été
   touchés. **Sans effet sur une base où ces migrations sont déjà
   appliquées** — `migrate.js` suit l'état par nom de fichier, pas par
   contenu ; ce correctif ne change le comportement que pour une base qui
   ne les a pas encore reçues (nouvel environnement, CI, staging).

## E. Ce qui a été vérifié localement (réellement exécuté)

- `node --check` sur les 5 fichiers backend modifiés
  (`utils/http.js`, `utils/phone.js`, `services/auth.js`, `routes/auth.js`,
  `server.js`) : **PASS**, syntaxe valide.
- Nouveau fichier `tests/auth_password_registration.test.js` (13 tests,
  `node --test`, zéro dépendance externe — importe réellement
  `utils/phone.js` et `utils/http.js`, qui n'ont aucun import) :
  **13/13 PASS**, réellement exécutés (voir sortie TAP dans les logs de
  cette session).
- Suite de tests existante (`node --test tests/*.test.js`) exécutée avant
  et après : **157/168 PASS après** (168 = 155 préexistants + 13 nouveaux).
  Les 5 échecs ont été individuellement diagnostiqués : 2 sont des
  imports manquants (`bcryptjs`, `express-rate-limit` — absence de
  `node_modules` dans ce bac à sable, sans lien avec cette session), 3
  sont des échecs préexistants sans rapport avec l'authentification
  (route de preuve de livraison, comptage de sites d'appel commission,
  documentation backup manquante). **Aucun des 5 échecs ne touche un
  fichier modifié dans cette session** — vérifié en traçant chaque erreur
  à sa cause réelle, pas supposé.
- Les 16 migrations éditées : diff ligne à ligne confirmant exactement 2
  lignes retirées par fichier (`BEGIN;` et `COMMIT;`), rien d'autre.

## F. NON exécuté / à vérifier après déploiement

- `npm install` échoue dans ce bac à sable (pas d'accès réseau sortant —
  confirmé par une tentative réelle, erreur 403 du registre npm). Aucune
  route HTTP réelle, aucune requête PostgreSQL réelle n'a pu être exécutée.
  Le comportement de `register()`/`login()` end-to-end (vraie transaction
  DB, vraie contrainte unique, vrai hachage bcrypt) doit être vérifié en
  staging avant production.
- `tsc --noEmit` sur le frontend reste **BLOCKED** dans ce bac à sable
  (`node_modules` du frontend absent — même constat que la session
  précédente, `AUDIT_CORRESPONDANCE_HTML_MOBILE.md`) : les fichiers
  `.tsx` modifiés (`RegisterScreen`, `LoginScreen`, `VerifyOtpScreen`,
  `AuthProvider`, `authApi`) ont été vérifiés par relecture attentive
  (types, props réellement supportées par `TextField`/`Button` vérifiées
  dans leur code source, cohérence des types de retour entre
  `authApi`/`AuthProvider`) et non par compilation.
- **Comptes existants sans mot de passe** : tout compte créé avant cette
  session via l'ancien flux OTP a `password_hash = NULL` et ne peut pas se
  connecter avec le nouveau `login()`. Aucune contrainte `NOT NULL` n'a été
  ajoutée en base (décision volontaire : impossible de vérifier/backfiller
  des données de production réelles depuis ce bac à sable). Ces comptes
  peuvent retrouver l'accès via "mot de passe oublié" (OTP conservé pour ce
  flux). À vérifier après déploiement : combien de comptes réels sont dans
  ce cas, et si une communication proactive est nécessaire.
- Test manuel bout en bout (inscription réelle sur l'app, connexion réelle,
  webhook, etc.) : à faire sur Render/Supabase après déploiement.

## G. Fichiers modifiés dans cette session

| Fichier | Modification | Impact |
|---|---|---|
| `backend/livi/src/utils/phone.js` | **Nouveau.** `normalizePhone`, `slugify`. | Numéros équivalents traités comme identiques ; slugs vendeur cohérents avec le reste du code. |
| `backend/livi/src/utils/http.js` | Ordre constructeur `HttpError` corrigé. | `error.code` correct sur toute l'API (202 sites d'appel), plus jamais `INTERNAL_ERROR` par défaut. |
| `backend/livi/src/server.js` | Détection `ZodError` dans le handler global. | Requêtes mal formées → 400 `VALIDATION_ERROR` au lieu de 500 sur toutes les routes. |
| `backend/livi/src/services/auth.js` | `register()` réécrit (transactionnel, mot de passe requis, téléphone normalisé, slug vendeur sûr) ; `verifyOtp()` supprimée. | Inscription atomique, sans OTP, compte toujours utilisable après coup. |
| `backend/livi/src/routes/auth.js` | Schéma zod inscription (`password_confirmation`, min 10) ; route `/otp/verify` retirée. | Confirmation mot de passe vérifiée côté serveur ; backdoor OTP fermée. |
| `backend/livi/tests/auth_password_registration.test.js` | **Nouveau.** 13 tests réels. | Couverture vérifiée (pas seulement affirmée) des utilitaires purs touchés. |
| `frontend/livi/src/features/auth/authApi.ts` | `RegisterPayload` + mot de passe ; `login` typé avec `session_id` ; `verifyOtp` retiré. | Contrat frontend/backend cohérent avec le nouveau flux. |
| `frontend/livi/src/features/auth/AuthProvider.tsx` | `login()` ajouté ; `register()` persiste enfin la session (bug : elle était jetée). | Connexion et inscription ouvrent réellement une session. |
| `frontend/livi/src/screens/auth/RegisterScreen.tsx` | Champs mot de passe + confirmation ; suppression de l'appel OTP/navigation. | Correspond au nouveau parcours (section 4 du prompt maître). |
| `frontend/livi/src/screens/auth/LoginScreen.tsx` | Champ mot de passe ; suppression de l'appel OTP/navigation. | Connexion réelle par mot de passe. |
| `frontend/livi/src/screens/auth/VerifyOtpScreen.tsx` | Simplifié à son seul usage restant (reset mot de passe). | Plus de chemin mort réactivable en backdoor. |
| 16 fichiers `backend/livi/migrations/0{09-31}_*.sql` | Retrait des `BEGIN;`/`COMMIT;` internes. | Atomicité garantie entre application d'une migration et son enregistrement, sur tout environnement pas encore migré. |

## H. Reste à faire (périmètre du prompt maître non couvert par cette session)

Sections du prompt maître non traitées ici, pour la suite : produits
(17–19), commandes/prix serveur (20), snapshot de commission (22), escrow
(23–27), transport/dispatch (28–30), KYC storage durable (33), request_id
unifié (31), CI déplacé à la racine + lockfile (40–41), `/ready` (39),
matrice de traçabilité complète (57), rapport final toutes sections
(58–63). Le Changelog (sessions 6–8) couvre déjà une partie de ce
périmètre — à re-vérifier plutôt qu'à supposer, comme pour l'authentification
dans cette session.

# Changelog — session d'harmonisation frontend/backend

Cette entrée documente une session d'audit et de correction complète. Contexte détaillé, méthodologie et éléments encore ouverts : voir `RAPPORT_AUDIT_HARMONISATION.md`, `RAPPORT_AUDIT_PARTIE2.md` et `RAPPORT_AUDIT_PARTIE3.md` à la racine du dépôt.

## Corrigé

**KYC vendeur**
- Le statut KYC affiché était toujours "Non vérifié" — l'écran lisait un champ (`me.kyc`) qui n'a jamais existé sur `GET /users/me`. Ajout de `sellerKycApi.status()` (`GET /kyc/mine`), réécriture de `SellerKYCScreen`.
- Suppression du doublon `GET /kyc/mine` qui masquait la vraie implémentation (plus sûre) de `kyc.js`.
- Suppression de `POST /kyc/documents` (mort, paradigme d'upload différent de celui réellement utilisé) ; enum `document_type` étendu et appliqué sur la route réellement utilisée (`POST /users/me/kyc`).

**Escrow / Wallet / Retraits**
- `escrowApi.transaction(id)` utilisait un paramètre de requête ignoré par le backend ; aligné sur `GET /escrow/transactions/:id`.
- Suppression de 6 routes `/wallet/*` mortes (dupliquaient `/escrow/balance`, `/escrow/transactions`, `/payouts`).
- Suppression de `POST /escrow/withdraw` et de 2 routes de retrait dupliquées (`/vendor/payouts/request`, `/transporter/wallet/payout`) qui contournaient le palier KYC appliqué par `/payouts`.

**Messagerie (chat acheteur↔vendeur)**
- Liste de conversations et messages toujours vides (le frontend attendait un objet enveloppé, le backend renvoie un tableau brut) ; alignement des bulles cassé (`sender_role` inexistant, corrigé via comparaison `sender_id`) ; envoi de message masqué par un écho local factice. Tout corrigé côté frontend, et `GET /chat/conversations` enrichi côté backend (nom du contact, aperçu, non-lus — absents avant).

**Litiges**
- Résolution admin envoyait du texte libre, le backend attend un choix fermé (`release`/`refund`) + une note obligatoire — nouvelle UI avec boutons explicites.
- Réponse à un litige envoyait le mauvais nom de champ (`message` au lieu de `content`) — échec systématique, corrigé.
- Autorisation trop stricte : seul l'ouvreur du litige pouvait recevoir une réponse — élargie à acheteur/vendeur/ouvreur.
- `GET /disputes/:id` ne renvoyait jamais l'historique des échanges — ajouté.
- Champ "Description" silencieusement perdu à la création (pas de colonne correspondante) — fusionné dans `reason`.

**Notifications**
- Liste et badge de non-lus toujours vides/à zéro (même famille de bug que le chat : tableau brut vs objet attendu, `read` vs `read_at`). Corrigé ; pagination par curseur réellement implémentée côté backend (le frontend l'appelait déjà, ignorée jusqu'ici).

**Fil social**
- `GET /feed` ne renvoyait presque aucun champ dans le nom ou la forme attendus par l'écran (vendeur, texte, image, compteurs, produit) — requête réécrite pour correspondre exactement au contrat frontend.

**Live**
- `GET /live/:id` ne renvoyait pas le nom du vendeur (contrairement à la liste) — jointure ajoutée.
- `GET /vendor/subscriptions` interrogeait la table dans le mauvais sens (qui je suis vs qui me suit) — corrigé.

**Nettoyage de doublons**
- Suppression de `addresses.js` (3 routes, jamais appelées — superseded par `/users/me/addresses`).
- Suppression de `POST /products` (mort — superseded par `/vendor/products`).
- Suppression de `POST /orders/:id/status` (mort — superseded par les transitions spécifiques).
- `delivery.js` réduit de 14 à 3 routes (les 11 autres n'avaient aucun appelant, frontend ou backend).

**Administration**
- 16 endpoints backend fonctionnels mais totalement inaccessibles depuis l'app (aucun écran, aucune navigation) : KYC review, intégrité comptable, finance (résumé/règles de commission/remboursement), réconciliation partenaire (cycles, dossiers de correction), file de retraits admin. 5 nouveaux écrans créés et reliés.
- 10 des 11 écrans admin génériques existants (Vendeurs, Transporteurs, Commandes, Paiements, Escrow, etc.) étaient déjà fonctionnels mais inatteignables depuis l'UI — un seul lien existait, vers "Utilisateurs", enterré dans l'écran Support. Grille d'accès rapide ajoutée au tableau de bord admin.

## Connu, non corrigé (voir rapports pour le détail)

- Le motif de redirection HTTP interne (307) / appel loopback utilisé par `/transporter/missions/:id/pickup`, `.../deliver` et `/transporter/qr/scan` fonctionne selon la sémantique HTTP standard mais n'a pas pu être testé en conditions réelles (pas d'environnement d'exécution disponible). Recommandation : couvrir par un test d'intégration réel avant production, éventuellement remplacer par un appel de fonction direct.
- `socialApi.comments()` (lister les commentaires d'un post) existe des deux côtés mais n'est appelé nulle part — fonctionnalité incomplète, pas un bug.
- La confirmation réelle de paiement dépend d'un partenaire mobile money non encore branché (documenté de longue date dans `.env.example`).

## Non exécuté

Aucune de ces corrections n'a pu être testée en conditions réelles (démarrage serveur, base de données, appels réseau) : le bac à sable de cette session n'a pas d'accès réseau ni de base PostgreSQL disponible. Tout a été vérifié par lecture de code, correspondance de schéma exacte contre les migrations, et recoupement systématique de chaque appel frontend contre chaque route backend. Un passage en environnement de staging reste nécessaire avant toute mise en production.

## Suite (sessions ultérieures, non détaillées ici)

Cette entrée ne couvre que les parties 1 à 3. Le travail a continué sur trois sessions supplémentaires, chacune avec son propre rapport à la racine du dépôt : `RAPPORT_AUDIT_PARTIE4.md` (bug de déconnexion après OTP, cartes de statistiques trop étroites, nettoyage Cashback/Fidélité, URL API de production), `RAPPORT_AUDIT_QR_PIN.md` (`createProofs()` jamais appelée — aucune livraison ne pouvait être validée — et les écrans manquants pour afficher le PIN/QR), et `RAPPORT_AUDIT_PARTIE5.md` (vérification des correctifs précédents, redirection HTTP cassée sur la prise en charge transporteur, permissions iOS, `MissionDetailsScreen`). Se référer à ces quatre documents pour l'état actuel du projet plutôt qu'à cette seule entrée.

## Session 6 — Audit exclusif base de données / migrations

Rapport complet : `RAPPORT_AUDIT_MIGRATIONS.md`. Matrice des 55 tables : `MATRICE_FINALE_MIGRATIONS.csv`.

### Corrigé
- 8 colonnes de statut fermées sans CHECK (`orders.status`, `disputes.status`/`category`, `kyc_documents.status`, `transporters.availability`, `live_shops.status`, `vendor_videos.status`, `shipments.status`) — migration `034_v50_status_enum_integrity.sql`.
- `kyc_documents.document_type` : CHECK élargi — la route réelle de soumission utilise `'identity'` comme repli par défaut, valeur absente de l'ancienne contrainte (toute soumission sans type explicite échouait en base).
- 8 index manquants confirmés par requête réelle observée, dont `social_posts(created_at DESC)` qui scannait toute la table à chaque appel du fil social — migration `035_v51_missing_indexes.sql`.
- `kyc_documents.user_id` : `ON DELETE CASCADE` → `RESTRICT` (documents de conformité) — migration `036_v52_kyc_retention_guard.sql`.
- Trigger de synchronisation `users.role` → `user_roles`, additif uniquement — migration `037_v53_role_consistency_guard.sql`.

### Connu, non corrigé (hors périmètre migrations — voir rapport pour le détail)
- Aucune route ne crée jamais un `shipment` (recherche exhaustive : zéro `INSERT INTO shipments` dans `src/`) — le module transporteur est prêt mais rien ne l'alimente en production.
- Aucune route ne fait transiter un `shipment` de `picked_up` à `in_transit`, alors que l'arrivée/livraison l'exigent.
- Le frontend appelle déjà `POST/DELETE /notifications/push-token` ; ni la route ni une table `device_tokens` n'existent côté backend.
- `KYC_DOCUMENT_TYPES` (kyc.js) n'est toujours importée par aucune route, y compris celle que son propre commentaire dit synchroniser.
- 3 tables présentes mais inutilisées par le backend, conservées sans modification : `categories`, `dispute_evidence`, `kyc_file_access_logs` (cette dernière est le plus notable : table d'audit d'accès KYC créée en V27, jamais alimentée par `privateFileAccess.js`).

### Non exécuté
Comme pour les sessions précédentes, aucun accès réseau ni base PostgreSQL n'était disponible dans ce sandbox : les 4 nouvelles migrations n'ont pas pu être appliquées réellement (`npm run migrate`). Vérifiées par relecture complète et par un parseur de schéma maison rejouant les 37 fichiers ; un passage réel avant mise en production reste nécessaire (voir précaution sur les CHECK dans `RAPPORT_AUDIT_MIGRATIONS.md` section 20).

## Session 7 — Audit complet 4 rôles + correction du blocage critique de livraison

Rapport complet : `RAPPORT_AUDIT_SESSION7.md`.

### Corrigé — bloquant en production
- **Aucune commande ne pouvait jamais être livrée.** `POST /vendor/orders/:id/ready` était un no-op (`status='preparing'` remis à `'preparing'`) et ne créait jamais de `shipment` — confirmé par recherche exhaustive (zéro `INSERT INTO shipments` nulle part), exactement ce que la Session 6 avait signalé comme premier point ouvert. Transition réelle vers `'shipping'` + création du shipment dans un pool non assigné.
- `POST /transporter/missions/:id/accept` exigeait que `transporter_id` soit déjà positionné sur le transporteur courant — mais rien ne l'assignait jamais nulle part. Passage à un modèle de claim atomique (pool ouvert), ré-acceptation idempotente préservée.
- `GET /transporter/missions` et `.../:id` ne montraient que les shipments déjà assignés — élargis pour inclure le pool non assigné, sinon la correction ci-dessus n'était atteignable par aucun bouton.
- `verifyPickupProof` (delivery.js) mettait le statut à `'picked_up'`, un cul-de-sac : ni `.../arrive` (exige `'in_transit'`) ni la livraison (exige `'in_transit'`/`'arrived'`) n'étaient jamais atteignables ensuite — deuxième point ouvert de la Session 6, confirmé. Transition directe vers `'in_transit'` ; l'évènement `'picked_up'` reste journalisé dans `shipment_events` pour l'historique.

### Corrigé — authentification
- `VerifyOtpScreen` prenait des props directes (`phone`,`onBack`) mais était aussi enregistré comme écran React Navigation et atteint via `navigation.navigate()` depuis Register/ForgotPassword : `phone` était `undefined`, le bouton retour plantait (`onBack` inexistant), `mode=password-reset` jamais lu. Architecture unifiée (React Navigation uniquement) ; `LoginScreen` navigue désormais au lieu d'un rendu direct.
- « Mot de passe oublié » ne menait nulle part : aucun écran ni endpoint pour définir un nouveau mot de passe après l'OTP. Ajout de `POST /auth/password/reset` (vérifie l'OTP et fixe le mot de passe en une opération atomique, sans ouvrir de session, révoque les sessions existantes) + écran `ResetNewPasswordScreen` + propagation du `purpose` OTP (login/register/password_reset) de bout en bout.

### Corrigé — KYC transporteur (absent)
- `TransporterKYCScreen` créé et relié au navigateur. Le backend était déjà agnostique au rôle (`KYC_DOCUMENT_TYPES` incluait déjà `permis`/`assurance`) — seul l'écran manquait.
- `VehicleScreen` créé (`vehicle_type`/`vehicle_plate` uniquement — aucune colonne marque/modèle n'existe en base, non inventée). Ajout du endpoint backend manquant `GET/PATCH /transporter/profile` (n'existait pas du tout auparavant, write-only via `.../availability`).

### Corrigé — dashboards et mapping
- Dashboard vendeur : lisait `data.metrics.sales/revenue/products_count` (n'a jamais existé) au lieu de `data.product_count/order_count/gross_sales_xof` (forme réelle) — chaque carte affichait « — » en permanence.
- Dashboard transporteur : même bug (`data.stats.active_missions` vs `data.active_missions` à plat). Découverte additionnelle : le switch de disponibilité envoyait `'ONLINE'/'OFFLINE'` alors que le backend n'accepte que du minuscule — chaque bascule échouait silencieusement.

### Corrigé — navigation orpheline (découverte non documentée par les sessions précédentes)
`Profil`, `Sécurité` et `Notifications` étaient enregistrés dans les navigateurs Vendeur et Transporteur mais **aucun bouton nulle part n'y menait** (pas de tab bar pour ces rôles). Ajout des accès dans les deux dashboards + transformation de `ProfileScreen` (seul écran fiable pour tous les rôles) en hub avec raccourcis adaptés au rôle.

### Corrigé — sécurité / sessions
- `SecurityScreen` lisait `item.last_seen_at`/`item.platform`, des champs qui n'ont jamais existé côté backend (la vraie forme est `last_used_at`, sans marqueur de session courante).
- Le mécanisme de marquage de session courante existait à moitié côté backend (`sessionIdFromRequest`, jamais appelé). Complété de bout en bout : `issueSession` renvoie `session_id`, le client API l'envoie en en-tête `x-session-id`, `GET /auth/sessions` l'utilise pour marquer `current`.
- Bouton « Déconnexion de tous les appareils » ajouté — l'endpoint `POST /auth/sessions/logout-all` existait déjà sans aucun point d'entrée dans l'UI.

### Corrigé — boutique vendeur (perte de données)
L'écran boutique ne chargeait jamais la boutique existante avant affichage ; comme chaque champ (adresse incluse) est renvoyé tel quel à chaque soumission, rouvrir l'écran pour changer un seul champ écrasait silencieusement le reste avec des valeurs vides. Préchargement ajouté (`GET /vendor/shop`, déjà utilisable en édition côté backend, seul le frontend ne s'en servait pas) avec distinction premher-onboarding / modification (chaque vendeur a déjà une ligne `vendors` dès l'inscription, avec seulement `shop_name` rempli).

### Corrigé — Admin KYC (priorité critique)
L'admin approuvait/rejetait un document KYC sans jamais le voir — aucune prévisualisation nulle part entre la liste et les boutons Approuver/Rejeter. Le mécanisme sécurisé (jeton signé de 300s, audité) existait déjà côté backend sans aucun appelant. Prévisualisation ajoutée (image ; repli honnête si le fichier n'est pas une image, le backend ne conservant pas le type MIME d'origine).

### Vérifié conforme, aucune correction nécessaire
- Push token (`NotificationsProvider`) : déjà best-effort, try/catch, aucune UI ne prétend un succès. La route backend existe réellement (contrairement à ce qu'indiquait la Session 6 — corrigé ici : elle était déjà présente dans le dernier commit avant cette session, `registered:false` explicite).
- `TwoFactorAuthScreen`, `VerifyEmailScreen`, `DepositScreen` : déjà honnêtes (aucun faux succès simulé), corrigés par une session précédente non documentée précisément sur ce point. Lien « Renvoyer » mort réparé sur les deux premiers.

### Connu, non corrigé (voir RAPPORT_AUDIT_SESSION7.md pour le détail)
- Variantes produits : backend prêt (`GET/POST/PUT/DELETE /vendor/products/:id/variants`, table `product_variants`), aucune UI frontend. Non construit faute de temps — décision consciente plutôt qu'implémentation précipitée.
- `kyc_file_access_logs` toujours non alimentée (le contrôle d'accès lui-même est sain : jetons signés + `audit()` générique).
- `socialApi.comments()`, activation multi-rôle UI, connecteur mobile money réel : inchangé depuis les sessions précédentes.
- Aucune exécution réelle possible (pas de réseau, pas de PostgreSQL, pas de `npm install` dans cet environnement) — vérifié par lecture de code, correspondance de schéma, et un correctif ciblé de la méthode de vérification syntaxique en cours de session (voir rapport, section H).

## Session 8 — Recommandations Bloc4 (architecture, UX, fonctionnalités commerciales)

Suite directe de la Session 7. Le document "LIVI_Bloc4_Architecture_v2" et les
recommandations UX transmis en cours de conversation ont été appliqués au
vrai codebase (pas au prototype no-code, écarté après clarification).

### Découverte majeure — corrigée
Le ledger comptable double-entrée (`ledger_accounts`/`ledger_transactions`/
`ledger_entries`, instructions partenaire idempotentes, libération auto à
72h) existait déjà, construit par une session antérieure, et respecte déjà
le modèle "LIVI jamais dépositaire des fonds" du document Bloc4. Non
reconstruit — audité puis complété uniquement sur les vrais manques : taux
de commission (0% -> 3%), et logique de répercussion commission (absente).

### Bugs critiques trouvés et corrigés (non liés au Bloc4, découverts en
### travaillant sur ces fonctionnalités)
- **`shipping_fee_xof` entièrement fourni par le client**, jamais vérifié
  côté serveur (défaut 0) — le checkout l'envoyait même à 0 en dur, et
  initiait le paiement avec le sous-total seul (sans frais de livraison).
- **Tous les prix affichaient 0 FCFA** dans tout le parcours acheteur
  (catalogue, fiche produit, panier, sous-total) : `item.price` n'a jamais
  existé côté backend (`price_xof`/`display_price_xof`).
- Admin pouvait approuver/rejeter un document KYC sans jamais le voir —
  aucune prévisualisation nulle part.

### Fonctionnalités commerciales ajoutées (migrations 038, 039)
- Commission confirmée à 3%, répercutable ou absorbée par choix du vendeur
  (`vendors.commission_passthrough`), cohérent catalogue <-> panier <->
  commande <-> libération escrow.
- Frais de livraison par distance réelle (Haversine), backend seul autorité,
  règle admin-configurable (`delivery_fee_rules`), aperçu avant paiement
  (`POST /orders/quote`).
- Adresses avec repères locaux (quartier, type de repère, description).
- Fenêtre de litige de 10 minutes après livraison, backend source de
  vérité, minuterie visible désactivant le bouton à expiration.
- Notation généralisée Acheteur<->Vendeur<->Transporteur (6 sens),
  toujours liée à une commande livrée réelle ; réputation affichée
  (fiche produit, dashboards vendeur/transporteur).
- Attribution des missions transporteur repensée : pool ouvert (Session 7)
  remplacé par une vraie attribution séquentielle par proximité, minuterie
  de 5 minutes visible, réattribution automatique au refus/à l'expiration
  (job planifié 30s), un transporteur ne peut jamais avoir deux missions
  actives. Adresse de collecte/livraison + frais désormais visibles côté
  transporteur (absents avant). Position transporteur "au repos" envoyée
  automatiquement (n'existait nulle part avant).
- Variantes produits utilisables de bout en bout : création vendeur,
  sélection acheteur, panier par ligne produit+variante, commande —
  les routes backend existaient depuis longtemps sans aucun appelant.
- Lien produit partageable (deep-linking `livi://product/:id`, config
  React Navigation manquante ajoutée) — à vérifier sur appareil réel,
  non testable dans cet environnement.

### Connu, non fait
- Lecture vidéo réelle du feed : le feed charge de vraies données
  (like/comment/share fonctionnels), mais `expo-av`/`expo-video` n'est
  même pas une dépendance du projet — pas de lecture vidéo effective.
  Non ajouté cette session : une nouvelle dépendance native ne peut pas
  être testée dans cet environnement sans réseau.
- Attractivité visuelle pure (animations, transitions, micro-interactions) :
  non travaillée — nécessite de voir le rendu réel de l'app, impossible
  ici.

## Session 9 — Suppression OTP/SMS de l'inscription/connexion + 3 bugs systémiques

Rapport complet : `RAPPORT_AUDIT_SESSION9_AUTH.md`. Répond au "prompt
maître" d'audit complet transmis en début de conversation ; périmètre de
cette session limité à l'authentification (le prompt maître couvre 66
sections, le reste reste à traiter en sessions ultérieures).

### Corrigé — authentification (decision définitive du prompt maître)
Inscription et connexion étaient **entièrement basées sur OTP, sans aucun
mot de passe** (aucun champ mot de passe n'existait sur `RegisterScreen`
ni `LoginScreen`) — confirmé en lisant le code, pas supposé. Conséquence
réelle : un compte fraîchement inscrit avait `password_hash=NULL` et ne
pouvait plus jamais se reconnecter une fois sa session expirée. Réécrit de
bout en bout : inscription = nom+prénom+téléphone+mot de
passe+confirmation → compte créé et session ouverte immédiatement, sans
OTP ; connexion = téléphone+mot de passe, sans OTP. OTP conservé
uniquement pour "mot de passe oublié" (usage légitime distinct) et pour
la vérification des moyens de paiement mobile money (sans rapport). Au
passage : inscription rendue transactionnelle (était 4-5 requêtes SQL
séquentielles sans transaction), téléphone normalisé avant comparaison
(n'existait nulle part avant), slug vendeur `ON CONFLICT DO NOTHING`
remplacé par un slug résistant aux collisions + erreur explicite (un
compte vendeur pouvait se retrouver sans ligne `vendors`), minimum mot de
passe unifié à 10 caractères (était 8 à l'inscription, 10 à la
réinitialisation).

### Corrigé — 3 bugs systémiques (trouvés en auditant le fichier ci-dessus)
- `HttpError` avait ses paramètres `(status, message, details, code)` alors
  que les 202 sites d'appel du projet passent tous un code en 3ᵉ position :
  `error.code` valait `'INTERNAL_ERROR'` sur **toutes** les erreurs
  non-500 de l'API, sans exception. Ordre corrigé, aucun site d'appel à
  modifier.
- Le handler d'erreur global renvoyait 500 sur **toute** erreur de
  validation zod (`ZodError` n'a pas de `.status`) sur **toutes** les
  routes du projet, au lieu de 400. Détection dédiée ajoutée.
- 16 migrations (009 à 031) contenaient un `BEGIN;`/`COMMIT;` SQL interne
  en plus de la transaction déjà ouverte par `migrate.js` — le `COMMIT;`
  interne validait la transaction du runner en avance, cassant
  l'atomicité entre migration appliquée et enregistrement dans
  `schema_migrations`. Retirés (sans effet sur une base où ces migrations
  sont déjà appliquées, `migrate.js` suit l'état par nom de fichier).

### Vérifié réellement (pas seulement affirmé)
`node --check` sur les 5 fichiers backend modifiés : PASS. Nouveau fichier
de tests (13 tests, zéro dépendance externe, réellement exécuté via
`node --test`) : 13/13 PASS. Suite de tests existante réexécutée après
modification : 157/168 PASS, les 5 échecs individuellement diagnostiqués
et confirmés sans rapport avec cette session (2 dépendances npm absentes
de ce bac à sable, 3 échecs préexistants sur des sujets non touchés).

### Non exécuté
Comme les sessions précédentes : pas d'accès réseau (`npm install` échoue,
403 confirmé), donc aucune vraie requête HTTP ni PostgreSQL. `tsc --noEmit`
toujours BLOCKED côté frontend (mêmes causes que dans
`AUDIT_CORRESPONDANCE_HTML_MOBILE.md`) — fichiers `.tsx` vérifiés par
relecture, pas par compilation. Comptes existants créés avant cette
session : `password_hash=NULL`, se rétablissent via "mot de passe oublié"
(OTP conservé pour ce flux) — à quantifier après déploiement.

## Session 10 — Commission critique, escrow, concurrence paiement, permissions KYC

Rapport complet : `RAPPORT_AUDIT_SESSION10_FINANCE_KYC.md`. Suite de la
Session 9, sections 21-25 et 32 du prompt maître.

### Corrigé — commission (bug financier confirmé, pas théorique)
Pour un vendeur en `commission_passthrough=true` (base 10 000 XOF, 3%),
`releaseEscrow` réappliquait le taux de commission sur le montant DÉJÀ
majoré payé par l'acheteur (10 300) au lieu du prix de base du vendeur —
le vendeur recevait 9 991 XOF au lieu des 10 000 promis. Confirmé en
traçant les vrais chiffres dans `routes/orders.js`/`services/finance.js`,
pas supposé. Corrigé : le montant net vendeur garanti est calculé une
fois à la création de la commande et lu directement au release
(`vendor_net_amount_snapshot`, migration `040_v55_commission_snapshot.sql`).
Au passage : le taux de commission est désormais TOUJOURS capturé à la
création (avant : seulement pour les vendeurs en passthrough), pour qu'un
changement de taux pendant qu'une commande reste en escrow ne modifie plus
silencieusement ce que le vendeur reçoit.

### Corrigé — race condition payment/init (section 24)
Le verrou `SELECT...FOR UPDATE` s'exécutait dans un `pool.query()`
autonome (auto-commit, verrou relâché immédiatement), l'`UPDATE` réel
avait lieu ensuite dans une transaction séparée — deux appels simultanés
pouvaient générer deux références de paiement concurrentes. Tout regroupé
dans une seule transaction ; rendu idempotent au passage.

### Corrigé — permissions documents KYC (section 32)
`POST /documents/:id/access-token` n'a aucune garde admin (accessible à
tout utilisateur pour son propre document) mais générait un jeton avec
`role:'admin'` codé en dur. Le binding sur l'id du document empêche
aujourd'hui l'exploitation directe (vérifié en traçant l'attaque), mais
c'est une protection incidente, pas voulue pour ce jeton. Retiré ; seule
la route admin (déjà protégée par `requireRoles('admin')`) émet
désormais `role:'admin'`.

### Ajouté — escrow lifecycle centralisé (section 23)
6 fichiers géraient chacun leur propre garde de transition ad hoc pour
`escrow_transactions.status` (contrairement aux commandes, qui ont déjà
`orderLifecycle.js`). Chacun vérifié individuellement correct — pas de bug
trouvé, mais absence de source de vérité unique. Ajout de
`services/escrowLifecycle.js` (même patron), câblé dans les 2 endroits
déjà modifiés cette session plutôt que dans tout le code déjà vérifié
correct.

### Vérifié réellement
18 nouveaux tests (3 fichiers), tous réellement exécutés via `node --test`,
18/18 PASS — dont un test reproduisant explicitement l'ancien calcul
bugué (9 991 XOF) et l'ancien jeton KYC à `role:'admin'`, pour documenter
la faute exacte plutôt que seulement le résultat final. Suite complète :
175/186 PASS, mêmes 5 échecs préexistants qu'en Session 9 (sans rapport,
déjà diagnostiqués), aucune nouvelle régression.

### Non exécuté
Pas d'accès réseau : la migration 040 n'a pas pu tourner contre une vraie
base (à valider en staging, notamment le backfill sur des escrows réels
déjà `funded`) ; aucun test de concurrence réel (deux requêtes HTTP
simultanées) n'a pu être exécuté.

## Session 11 — Ledger, transport, request_id, CI/health-ready

Rapport complet : `RAPPORT_AUDIT_SESSION11_INFRA.md`. Sections 27-31 et
39-41 du prompt maître.

### Supprimé — code mort dangereux
`services/ledger.js#postLedgerTransaction` ouvrait sa propre transaction
interne (contrairement à `market.js#postBalanced`, utilisé partout
ailleurs et qui participe correctement à la transaction de l'appelant) —
jamais appelé nulle part dans le dépôt (import mort dans
`routes/escrow.js`). Supprimé plutôt que corrigé : `postBalanced` couvre
déjà le même besoin correctement, et laisser ce genre de fonction en place
est un piège pour un futur usage à l'intérieur d'une transaction existante.

### Corrigé — transport
`POST /transporter/location` : position + recherche de mission + insertion
d'événement étaient trois requêtes séquentielles indépendantes — un échec
transitoire entre deux d'entre elles pouvait laisser la position à jour
sans événement correspondant. Regroupé en une transaction. Dispatch et
acceptation de mission relus intégralement : le modèle d'acceptation
atomique déjà en place protège correctement contre deux transporteurs
acceptant la même mission — confirmé correct, rien à changer.

### Vérifié correct, rien à changer
`request_id` (section 31) : recherche complète de `req.id` dans tout le
dépôt, aucune occurrence — `res.locals.requestId` déjà utilisé de façon
cohérente partout. Cette préoccupation du prompt maître ne s'applique pas
à l'état actuel du code.

### Corrigé — CI invisible pour GitHub Actions
`backend/livi/.github/workflows/ci.yml` existait, complet et correct, mais
GitHub Actions ne scanne que `.github/workflows/` à la racine du dépôt —
ce pipeline n'avait donc jamais tourné sur aucun push ni PR. Déplacé vers
`.github/workflows/backend-ci.yml` avec `working-directory: backend/livi`
ajouté aux deux jobs.

### Régression trouvée et corrigée dans la foulée
Le déplacement ci-dessus a fait échouer 6 tests
(`v44_ci_cd_preparation.test.js`, `v45_staging_environment.test.js`) qui
vérifiaient le contenu du fichier CI à son ANCIEN chemin — exactement
l'emplacement invisible pour GitHub Actions. Détecté immédiatement par la
réexécution complète de la suite après le déplacement, pas ignoré. Corrigé
en mettant à jour les tests vers le nouveau chemin correct, pas en
annulant le déplacement — le chemin qu'ils vérifiaient était le bug.

### Corrigé — health/ready
`/health` interrogeait la base de données : un incident PostgreSQL
transitoire aurait pu faire croire à l'orchestrateur que le processus
était mort et le redémarrer inutilement. `/health` simplifié (ne dépend
plus que du processus) ; nouveau `/ready` (DB, migrations appliquées,
schéma à jour via la colonne ajoutée par la migration 040).

### Non exécuté
Lockfile (section 41) : toujours bloqué, pas d'accès réseau (confirmé de
nouveau) — déjà correctement documenté comme tel dans `ci.yml`/`Dockerfile`
par une session précédente. `docs/V43_BACKUP_RESTORE_DR.md` référencé par
le CI et un test mais absent du dépôt — nécessite des procédures
spécifiques à Supabase non vérifiables ici, à traiter séparément. Workflow
CI jamais exécuté sur un vrai GitHub (pas d'accès). `/ready` jamais appelé
contre une vraie base.

### Vérifié réellement
`node --check` PASS sur tous les fichiers touchés. YAML du workflow
relocalisé réellement parsé avec PyYAML (valide, working-directory
confirmé sur les deux jobs). Suite complète réexécutée à chaque étape :
175/186 PASS en fin de session, mêmes 5 échecs préexistants qu'en Session
10, aucune régression nette (la régression transitoire de 6 tests a été
détectée et corrigée dans cette même session, pas laissée de côté).

## Session 12 — Conflit de slug produit, durabilité du stockage KYC

Rapport complet : `RAPPORT_AUDIT_SESSION12_PRODUITS_KYC_STORAGE.md`.
Sections 18 et 33 du prompt maître.

### Corrigé — conflit de slug produit (bug confirmé, pas théorique)
`products.slug` est `UNIQUE NOT NULL` GLOBALEMENT (pas par vendeur).
`POST /vendor/products` n'avait aucune gestion de conflit sur l'INSERT —
deux vendeurs différents nommant un produit de façon identique (noms
courants : "T-shirt bleu") auraient déclenché une violation Postgres
brute remontée en 500 générique. Corrigé : `try/catch` détectant le code
`23505`, renvoie désormais `409 PRODUCT_SLUG_ALREADY_EXISTS` explicite.

### Documenté — durabilité du stockage KYC (section 33)
Confirmé : documents KYC stockés sur disque local (`multer dest`), aucune
dépendance vers un stockage objet nulle part dans le dépôt. Sur Render sans
disque persistant, un redéploiement efface ces fichiers pendant que les
lignes DB (y compris documents déjà validés) restent en place. Ajouté :
avertissement explicite au démarrage en production, et
`docs/KYC_STORAGE_DURABILITY.md` avec un plan de migration concret vers
Supabase Storage. Aucune intégration réelle écrite (nécessite des
identifiants réels que je n'ai pas) — pas de faux toggle
`STORAGE_PROVIDER=s3` ajouté non plus, un réglage qui ne fonctionne pas
serait pire qu'un avertissement honnête.

### Vérifié réellement
`node --check` PASS (a détecté une faute de frappe dans un commentaire
avant qu'elle ne devienne un problème — corrigée). Suite complète :
175/186 PASS, mêmes 5 échecs préexistants, aucune régression.

### À vérifier après déploiement
Sur la base réelle : des comptes `role='vendor'` sans ligne `vendors`
correspondante existent-ils (hérités d'avant la correction Session 9) ?
Migration effective du stockage KYC vers Supabase Storage, dans un
environnement avec accès réel.

## Session 13 — Validation type de document KYC, correction d'une erreur de la Session 11

Rapport complet : `RAPPORT_AUDIT_SESSION13_KYC_REQUESTID.md`. Sections 34
et 31 (à nouveau) du prompt maître.

### Corrigé — validation du type de document KYC
`POST /users/me/kyc` (route réellement utilisée par le frontend)
acceptait n'importe quelle chaîne comme `document_type`, sans validation
applicative — une migration antérieure (034) avait déjà noté ce point
précis comme "hors périmètre migrations strict" pour une session
ultérieure. Fermé : import de `KYC_DOCUMENT_TYPES` (déjà existant dans
`kyc.js` mais jamais appliqué par la route réelle) et rejet en 422 avant
insertion.

### Corrigé — erreur trouvée dans mon propre travail de Session 11
En réauditant le transport, j'ai trouvé 5 occurrences réelles de `req.id`
(jamais défini nulle part dans le projet) dans `delivery.js`/
`compatibility.js`, causant `request_id=NULL` dans les journaux de
validation de preuve de livraison. La Session 11 avait conclu à tort
qu'aucune occurrence n'existait — la commande de recherche utilisée
excluait par erreur des lignes entières contenant à la fois `req.id` ET
`req.ip` (le motif d'exclusion `grep -v` opère sur la ligne complète, pas
sur l'occurrence isolée), et ces 5 lignes contiennent justement les deux.
Corrigé (`res.locals.requestId`, cohérent avec le reste du projet) et
documenté sans minimisation dans le rapport de session : la conclusion de
la Session 11 était fausse, pas seulement incomplète.

### Vérifié réellement
3 nouveaux tests (`kyc_document_type_validation.test.js`), tous exécutés,
3/3 PASS — dont un qui parse la vraie contrainte CHECK de la migration 034
et la compare à la constante applicative pour empêcher toute divergence
future. Suite complète : 178/189 PASS, mêmes 5 échecs préexistants,
aucune régression. Reste du flux de preuve de livraison
(`deliveryProof.js`) relu intégralement, aucun autre bug trouvé.

## Session 14 — Vérification et fusion du correctif catégorie/photos/vidéo

Rapport complet : `RAPPORT_AUDIT_SESSION14_MERGE_CATEGORIE_PHOTOS_VIDEO.md`.
Un fichier séparé (`LIVI_Correctifs_Categorie_Photos_Video.zip`), produit
indépendamment contre l'état post-Session-8 du dépôt, a été transmis pour
vérification et fusion.

### Vérifié avant fusion (pas accepté sur la base du README fourni)
Chaque affirmation du correctif a été vérifiée directement dans le
schéma/code réel : `categories`/`products.category_id`/`product_media`
existaient déjà (aucune migration de schéma nécessaire, juste jamais
exposés) ; `GET /products/:productId/media/:mediaId` servait déjà les
fichiers mais aucune réponse catalogue ne le référençait ; les écrans
`VideoManager`/`CreatorTools`/`LiveDashboard` étaient déjà fonctionnels
mais inatteignables ; l'ancien upload vidéo stockait bien le chemin disque
du serveur comme URL (bug réel, confirmé dans le code avant correctif) ;
l'ancien feed ouvrait bien un lien externe au lieu de lire en application.
Toutes les affirmations vérifiables se sont révélées exactes.

### Conflit trouvé et résolu
La migration fournie (`040_v54_seed_categories.sql`) entrait en collision
avec `040_v55_commission_snapshot.sql` (Session 10) — deux travaux
indépendants avaient choisi le même numéro "suivant disponible" sans se
connaître. Renumérotée en `041_v54_seed_categories.sql`, contenu
inchangé.

### Fusion manuelle, pas un remplacement de fichiers
Le README du correctif recommandait de copier les fichiers par-dessus
ceux du projet. Suivi tel quel, cela aurait effacé les corrections des
Sessions 11-13 sur `routes/compatibility.js` (validation KYC, request_id,
conflit de slug, transaction transporteur) puisque ce fichier est touché
des deux côtés. À la place : diff ligne à ligne, puis application
manuelle des seuls ajouts du correctif par-dessus la version déjà
corrigée. Les fichiers frontend modifiés (jamais touchés par les Sessions
9-13, vérifié par diff avant copie) ont pu être copiés directement.

### Résultat
Catégories produit (route + seed + formulaire vendeur), photos produit
enfin affichées (catalogue, fiche produit, galerie), description produit
éditable, vidéos vendeur réellement liées au feed et lisibles en
application (`expo-video` remplace les liens externes), navigation vers
Mes vidéos/Creator Tools/Live réparée.

### Vérifié réellement
Nouveau fichier de tests (10 tests, approche par inspection de source),
couvrant à la fois la nouvelle fonctionnalité et la survie des correctifs
précédents dans les mêmes fichiers — 10/10 PASS après correction de 2
tests dont la fenêtre de découpage était trop courte (trouvé et corrigé
avant de faire confiance aux résultats). Suite complète : 188/199 PASS,
mêmes 5 échecs préexistants, aucune régression.

### Non exécuté
`npx expo install expo-video` (pas de réseau) — version et API exactes à
confirmer dans un environnement réel, comme le correctif original le
signalait déjà lui-même. Migration 041 jamais exécutée contre une vraie
base. Rendu réel de la galerie photo/lecteur vidéo non testable ici.

## Session 15 — Notifications, administration (vérifiées), conflit SKU variante (corrigé)

Rapport complet : `RAPPORT_AUDIT_SESSION15_NOTIF_ADMIN_VARIANTS.md`.

### Vérifié correct, rien à changer
Notifications (`routes/notifications.js`, `NotificationsProvider.tsx`) :
pagination, unread_count, read-all déjà corrects (sessions antérieures) ;
push-token renvoie honnêtement `external_provider_required:true` plutôt
que de simuler un enregistrement réel. Administration : garde globale
`requireAuth+requireRoles('admin')` confirmée sur `admin.js` ; flux KYC
admin (AdminKycReviewScreen → 3 endpoints kyc.js) tracé de bout en bout,
correspondance exacte ; SupportCenterScreen confirmé être un placeholder
assumé (le composant dit lui-même explicitement de ne pas simuler l'API
support absente) plutôt qu'un bug.

### Corrigé — conflit SKU de variante
Même classe de bug que les sections 12/18 déjà corrigées (slug produit,
slug vendeur) : `product_variants` a un index `UNIQUE(product_id, sku)`
sans aucune gestion de conflit sur les routes de création/modification.
Un SKU dupliqué pour le même produit déclenchait une 500 générique.
Corrigé : `try/catch` sur les deux routes, `409
VARIANT_SKU_ALREADY_EXISTS`.

### Non exhaustif
5 des 9 écrans admin n'ont pas été tracés endpoint par endpoint dans
cette session (AdminFinanceScreen, AdminPayoutsQueueScreen,
PlatformAnalyticsScreen, AdminIntegrityScreen, AdminReconciliationScreen).

### Vérifié réellement
Suite complète : 188/199 PASS, mêmes 5 échecs préexistants, aucune
régression. Pas de nouveau test dédié cette session (signalé, pas caché).

## Session 16 — Audit complet des 5 écrans admin restants (aucun bug trouvé)

Rapport complet : `RAPPORT_AUDIT_SESSION16_ADMIN_COMPLET.md`. Ferme le
point laissé ouvert en Session 15 (5 écrans admin non tracés).

### Fausse alerte initiale résolue
`adminApi.ts` liste 11 endpoints génériques sous un commentaire
suggérant qu'ils seraient "assumés" plutôt que confirmés. Une recherche
limitée à `routes/admin.js` ne les trouvait pas — élargie à tout le
dossier routes, les 11 existent bien dans `routes/compatibility.js`,
correctement gardés par rôle admin. Documenté pour éviter qu'une future
session reproduise la même fausse alerte.

### Vérifié, aucun bug trouvé
AdminFinanceScreen, AdminPayoutsQueueScreen, PlatformAnalyticsScreen,
AdminIntegrityScreen, AdminReconciliationScreen : les 9 écrans admin au
total (5 ici + 4 en Session 15) correspondent tous à des endpoints réels,
correctement gardés. `refundOrder` reconfirmé protégé contre le double
remboursement. `users.email` (colonne jointe par la requête payouts
admin) confirmée existante depuis 001_initial.sql.

### Non exécuté
`services/reconciliation.js` non relu ligne à ligne au-delà de son point
d'entrée. Aucun appel HTTP réel possible dans ce bac à sable.

## Session 17 — Audit systématique de l'interconnexion entre écrans

Rapport complet : `RAPPORT_AUDIT_SESSION17_NAVIGATION_INTERCONNEXION.md`.
Demandé explicitement : généraliser le bug d'écrans orphelins trouvé dans
le correctif catégorie/photos/vidéo (Session 14) à tout le projet.

### Méthode
Extraction des 85 noms d'écran déclarés dans les 5 navigateurs, recherche
de chaque nom comme chaîne littérale n'importe où ailleurs dans le code
(pas seulement comme argument direct de `navigate(...)`, car plusieurs
écrans utilisent un tableau `[label, cible].map()` avec une cible
variable — une recherche plus étroite aurait produit 75 faux positifs
sur 85). Chaque candidat restant vérifié manuellement.

### Corrigé — panneau admin entier inatteignable (sévère)
`AdminNavigator` listait "Profile" en premier écran (React Navigation
prend le premier enfant comme route par défaut) au lieu de
"AdminDashboard", et `ProfileScreen`'s `ROLE_LINKS.admin` était un
tableau vide. Un administrateur se connectant atterrissait sur Profil
avec pour seules options Sécurité/Notifications — aucun chemin vers
AdminDashboard, qui contient pourtant 18 liens vers tous les autres
écrans admin (tous vérifiés fonctionnels en Sessions 15-16). Le panneau
complet était construit, correct, et invisible. Corrigé : AdminDashboard
déplacé en premier, ROLE_LINKS.admin peuplé en filet de sécurité.

### Corrigé — navigation cassée vers le détail d'un litige (admin)
`DisputesScreen.tsx` (partagé Buyer/Seller/Admin) appelle
`navigate('DisputeDetails', ...)` en dur. Buyer et Seller enregistrent
cette destination sous ce nom exact ; Admin seul l'enregistrait sous
"AdminDisputeDetails" — taper un litige côté admin appelait une
navigation sans cible. Renommé pour matcher les deux autres navigateurs.

### Corrigé — écran disponibilité transporteur inatteignable (mineur)
Impact limité (le dashboard a déjà un interrupteur en ligne pour le même
effet) — lien ajouté par cohérence.

### Trouvé, signalé, pas corrigé (décision produit nécessaire)
Deposit (aucun bouton nulle part n'y mène, y compris depuis un
EscrowCenterScreen sans aucune interaction) ; LiveShops (aucune
référence) ; TwoFactorAuthScreen/VerifyEmailScreen (vestiges probables
d'une conception auth antérieure au flux OTP déjà remplacé en Session 9 —
pas supprimés unilatéralement, sujet sensible) ; EscrowCenter (alias
redondant inoffensif du même écran déjà atteint sous le nom "Escrow").

### Vérifié réellement
Nouveau fichier de tests (5 tests, approche par inspection de source),
5/5 PASS après correction d'un bug dans mon propre test (regex tronquant
un tableau imbriqué — trouvé et corrigé avant de faire confiance au
résultat). Suite complète : 193/204 PASS, mêmes 5 échecs préexistants,
aucune régression.

## Session 18 — Décisions tranchées sur les 4 points laissés ouverts en Session 17

Rapport complet : `RAPPORT_AUDIT_SESSION18_DECISIONS_ECRANS.md`. Demandé
explicitement : trancher plutôt que laisser ouvert.

### Supprimé — TwoFactorAuthScreen, VerifyEmailScreen
Les deux sont des placeholders honnêtes (chaque bouton affiche
explicitement "attend le contrat backend dédié, aucun succès fictif").
Aucun support backend nulle part, totalement inatteignables, et
contredisent l'objectif explicite du prompt maître (auth simple
téléphone+mot de passe, sans étape supplémentaire — déjà mis en œuvre
Session 9). Supprimés plutôt que câblés ou laissés en l'état.

### Nettoyé — 3 alias redondants (EscrowCenter/EscrowTransactions/EscrowDisputes)
Pointaient vers des composants déjà atteignables sous un autre nom
(Escrow/Transactions/Disputes). Supprimés de BuyerNavigator. Corollaire
réel trouvé en creusant EscrowDisputes : un acheteur pouvait créer un
litige mais n'avait ensuite aucun moyen de revoir la liste de tous ses
litiges — EscrowCenterScreen (qui n'avait aucun élément interactif
malgré des appels API réels) a reçu ce lien manquant.

### Lié — Deposit (conservé, rendu atteignable)
Même type de placeholder honnête que 2FA/Email, mais fonctionnalité
wallet symétrique à Withdraw (déjà fonctionnel), pas une fonctionnalité
d'auth contraire à un objectif du prompt maître. Lien ajouté depuis
WalletScreen.

### Lié — LiveShops (fonctionnalité réelle, corrigée)
Contrairement à tout le reste de cette session : pas un placeholder — vraie
API (GET /live/active, table live_shops réelle), chargement/erreur/vide
gérés. Même classe de bug que VideoManager/CreatorTools/LiveDashboard :
fonctionnalité complète sans porte d'entrée. Bannière ajoutée en tête du
feed social.

### Vérifié réellement
6 nouveaux tests, 6/6 PASS au premier essai. Suite complète : 199/210
PASS, mêmes 5 échecs préexistants, aucune régression. Vérifié qu'aucun
import ne devient orphelin après les suppressions.

## Session 19 — Contrat des réponses API : bug confirmé sur le total commande vendeur

Rapport complet : `RAPPORT_AUDIT_SESSION19_CONTRAT_API_COMMANDES.md`.
Section 49, suite à la demande de vérifier d'autres décalages de champ
comme celui des photos produit (Session 14).

### Corrigé — total toujours à 0 FCFA côté vendeur
`GET /vendor/orders/:id` fait `SELECT o.*` (colonne réelle :
`total_amount`, aucune colonne `total` dans le schéma). L'écran lisait
`order.total ?? 0` — repli systématiquement déclenché. Un vendeur voyait
toujours "0 FCFA" sur ses commandes, peu importe le montant réel. Même
famille que le bug item.price/price_xof déjà corrigé (Session 8).
Corrigé : `total_amount` lu en priorité.

### Corrigé — articles de commande absents côté vendeur
Le même endpoint ne renvoyait jamais les lignes de commande,
contrairement à l'équivalent acheteur. Un vendeur acceptant/préparant une
commande n'avait aucun moyen de voir quels produits préparer. Corrigé :
articles inclus (jointure produits pour le nom), affichés à l'écran.

### Vérifié réellement
5 nouveaux tests, 5/5 PASS, dont un qui vérifie directement dans le
schéma SQL qu'aucune colonne "total" (bare) n'existe. Suite complète :
204/215 PASS, mêmes 5 échecs préexistants, aucune régression.

### Non exhaustif
disputesApi.ts, ratingsApi.ts, transporterApi.ts, socialApi.ts non
vérifiés dans cette session.

## Session 20 — Fin de l'audit du contrat API (aucun nouveau bug)

Rapport complet : `RAPPORT_AUDIT_SESSION20_CONTRAT_API_FIN.md`. Suite de
la Session 19 — les 4 clients API restants (disputes, ratings,
transporter, social) vérifiés.

### Vérifié correct, aucun bug trouvé
`disputesApi.ts` (déjà bien couvert par un correctif V37 antérieur sur la
confusion id-litige/id-escrow) ; `ratingsApi.ts` (correspondance exacte
champ par champ) ; `transporterApi.ts` (PATCH availability vérifié
correspondre exactement à l'enum backend) ; `socialApi.ts` (GET /feed
correspond exactement au type FeedItem, confirme au passage la bonne
intégration du correctif vidéo de Session 14).

### Conclusion de l'audit du contrat API
Sur 7 clients API vérifiés à travers les Sessions 19-20, un seul bug réel
trouvé (total commande vendeur, Session 19). Signalé honnêtement : tous
les clients API du projet n'ont pas été vérifiés au même niveau de détail
(buyerApi, profileApi, escrowApi, authApi, catalogueApi et d'autres
restent non couverts par ce passage) — le périmètre demandé
(généraliser le bug photos produit) est traité par un échantillon
représentatif, pas une garantie d'exhaustivité totale.

### Aucune modification de code cette session
Session de vérification pure.

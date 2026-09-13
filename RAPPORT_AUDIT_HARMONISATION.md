# Audit & harmonisation frontend/backend — LIVI

**Base de travail :** deux fichiers ont été fournis. `livi-apk-main.zip` et `livi-apk-main-html-parity.zip` contiennent le **même backend, octet pour octet** (aucune différence — vérifié par diff récursif complet). La seconde archive ajoute 9 écrans frontend et un audit de parité HTML↔Mobile déjà réalisé (`AUDIT_CORRESPONDANCE_HTML_MOBILE.md`). C'est donc un sur-ensemble strict de la première : tout le travail ci-dessous a été fait sur `livi-apk-main-html-parity.zip`, qui est la version la plus à jour des deux.

**Ce que ce rapport n'est pas :** vu la taille réelle du projet (190 endpoints backend, 69 écrans frontend, ~9 350 lignes de code applicatif hors migrations/tests/scripts), une seule session ne peut pas produire un audit ligne-par-ligne exhaustif des 31 sections de la mission avec tests d'exécution réels — le bac à sable n'a pas d'accès réseau, donc je n'ai pas pu lancer `npm install`, démarrer le serveur, ni exécuter les 30 scripts de test déjà présents (`backend/livi/tests/v16` à `v45`) contre une vraie base Postgres. Ce qui suit est un audit **basé sur la lecture réelle du code**, avec extraction automatisée puis vérification manuelle systématique — pas une estimation.

---

## A. Audit

### Constat de départ : le projet est déjà très mature

Le backend porte des migrations jusqu'à `033_v46_frontend_backend_unification.sql` / `033_v46_architecture_alignment.sql`, et des commentaires de code datés « V47 » sur des corrections précises (`walletApi.ts`, `escrow.js`). Cela veut dire qu'un travail d'audit très proche de celui demandé ici a **déjà été fait, plusieurs fois**, par le passé. Le format d'erreur `{success, error:{code,message}, request_id}` demandé en section 18 de la mission est déjà implémenté à l'identique des deux côtés. La machine à états des commandes existe déjà et est documentée (`backend/livi/backend/docs/V32_STATE_TRANSITIONS.md`, `V33_FORBIDDEN_TRANSITIONS.md`) : `pending_payment → payment_pending → paid → preparing → shipping → delivered → completed`, avec `cancelled/refunded/disputed` comme états de correction. Aucune donnée fictive (`const products = [...]`, `mockData`, etc.) n'a été trouvée dans le frontend — la source de vérité est déjà unique.

Je le précise pour éviter de refaire un travail déjà fait, et pour que le reste du rapport se concentre sur ce qui est **réellement** encore à corriger.

### Le problème systémique n°1 : deux implémentations parallèles pour plusieurs domaines

C'est la découverte la plus importante de cet audit. Le backend a un fichier `compatibility.js` (mounté à la racine, donc **prioritaire** sur tous les autres routeurs) qui, malgré son nom, contient 99 des 190 endpoints — ce n'est pas de la « compatibilité », c'est l'implémentation principale de pans entiers de LIVI (vendor, transporter, wallet, social, live, une partie de l'admin). Il a visiblement grandi au fur et à mesure qu'on branchait le frontend, pendant que les fichiers dédiés (`addresses.js`, `kyc.js`, `delivery.js`, la route `POST` de `products.js`) restaient figés à un stade antérieur.

Conséquence vérifiée sur le code réel, domaine par domaine :

| Domaine | Fichier dédié (non utilisé par le frontend) | Ce que le frontend appelle réellement |
|---|---|---|
| Adresses | `addresses.js` — `GET/POST /addresses`, `DELETE /addresses/:id` (pas de UPDATE) | `compatibility.js` — `/users/me/addresses` (GET/POST/PUT/DELETE) |
| Création produit | `products.js` — `POST /products` | `compatibility.js` — `POST /vendor/products` |
| Retrait vendeur/transporteur | `compatibility.js` — `/vendor/payouts/request`, `/transporter/wallet/payout` | `payouts.js` — `POST /payouts` (unifié, avec palier KYC) |
| Wallet | `compatibility.js` — `/wallet`, `/wallet/transactions`, `/wallet/withdraw` (stub 501) | `escrow.js` + `payouts.js` — `/escrow/balance`, `/escrow/transactions`, `/payouts` |
| Retrait (2ᵉ occurrence) | `escrow.js` — `POST /escrow/withdraw` (stub 501, même message que `/wallet/withdraw`) | `payouts.js` — `POST /payouts` |
| Confirmation réception + libération escrow | `delivery.js` — `POST /:id/confirm-reception`, `POST /:id/release-escrow` (12 des 14 routes du fichier sont mortes) | `compatibility.js` — `POST /orders/:id/confirm-receipt` |
| Documents KYC | `kyc.js` — `POST /documents` (validation stricte par enum) | `compatibility.js` — `POST /users/me/kyc` (libre, sans validation d'enum) |
| Statut KYC | `kyc.js` — `GET /mine` (avec en-tête `no-store` et liste de colonnes explicite) | **Était masqué par un doublon** — voir correction n°1 ci-dessous |

Rien de tout ça n'est cassé pour l'utilisateur final : dans presque tous les cas, la version réellement utilisée (`compatibility.js` ou `payouts.js`) fonctionne. Le problème est un problème de dette et de sécurité latente :
- Deux vendeurs qui liraient le code pourraient légitimement modifier la mauvaise version.
- `/vendor/payouts/request` et `/transporter/wallet/payout` contournent le palier KYC que `payouts.js` impose — ils sont morts aujourd'hui, mais restent une porte dérobée si quelqu'un les rebranche par erreur.
- `kyc.js` valide le type de document par une liste fermée (`cni, passport, permis, assurance, business_registration, tax_document, other`), `compatibility.js` accepte n'importe quelle chaîne. Le chemin réellement utilisé est celui **sans** validation.

**Recommandation :** ne pas tout réécrire (la mission le déconseille explicitement, section 29). Plutôt : sur chaque paire, garder l'implémentation utilisée, supprimer ou rediriger la version morte, et faire remonter la validation d'enum de `kyc.js` vers le endpoint réellement appelé. C'est un travail mécanique et à faible risque, mais qui touche 8 fichiers — je propose de le faire dans une prochaine passe une fois que vous aurez confirmé la priorité (section D ci-dessous).

### Bug réel trouvé et corrigé cette session : statut KYC vendeur toujours faux

`SellerKYCScreen.tsx` appelait `sellerKycApi.me()` → `GET /users/me`, et lisait `me.kyc` / `me.verification`. **Ce champ n'existe pas** dans la réponse de `/users/me` (vérifié dans `users.js` : elle renvoie `id, phone, name, role, status, roles[], role_details[]`, rien d'autre). Résultat concret : l'écran affichait en permanence « Non vérifié » et « pending » sur chaque document, **même après approbation réelle côté backend**. Le vrai statut existe bien, à `GET /kyc/mine` — mais rien dans le frontend ne l'appelait.

En creusant, `GET /kyc/mine` existait en fait **deux fois** : une version correcte dans `kyc.js` (en-tête anti-cache pour des documents d'identité, sélection explicite des colonnes), et une version dans `compatibility.js` — mounté avant `kyc.js` dans `routes/index.js`, donc **prioritaire**, sans les protections de la première. Autrement dit, même en la corrigeant côté frontend, on serait tombé sur la version la moins sûre des deux.

### Autres observations (non corrigées cette session, priorité plus basse)

- Le motif de redirection HTTP interne (307) utilisé par `/transporter/missions/:id/pickup` et `.../deliver` pour rediriger vers `/deliveries/:id/pickup-proof/verify` fonctionne selon la sémantique HTTP standard (redirection 307 = méthode et corps préservés), mais je n'ai pas pu le tester en conditions réelles (pas d'accès réseau dans ce bac à sable). C'est un point que je recommande de vérifier sur un vrai appareil avant mise en production — un appel de service direct serait plus robuste qu'un aller-retour HTTP interne.
- La confirmation de paiement réelle (`POST /escrow/payment/confirm`) est volontairement bloquée hors environnement de staging (`allowStagingTestHelpers`), en attendant un vrai partenaire mobile money — c'est documenté honnêtement dans `.env.example`, pas un bug d'harmonisation.
- 18 endpoints admin (réconciliation, finance, validation de paiements) existent côté backend mais ne semblent pas exposés dans l'app mobile admin — probablement volontaire (outils réservés à une équipe ops/finance), à confirmer avec vous.
- La gestion multi-rôles cumulatifs (`/users/me/roles`, migration v46 — un même compte peut être acheteur + vendeur + transporteur) est prête côté backend mais je n'ai trouvé aucun écran frontend pour l'activer.

---

## B. Corrections effectuées

### Correction 1 — Statut KYC vendeur toujours incorrect

- **Fichiers :** `backend/livi/src/routes/compatibility.js`, `frontend/livi/src/features/seller/sellerKycApi.ts`, `frontend/livi/src/screens/seller/SellerKYCScreen.tsx`
- **Cause :** le frontend lisait un champ (`me.kyc`/`me.verification`) qui n'existe sur aucune réponse backend réelle ; le vrai endpoint (`GET /kyc/mine`) n'était jamais appelé, et sa version « propre » dans `kyc.js` était de toute façon masquée par un doublon dans `compatibility.js`.
- **Correction :** suppression du doublon `GET /kyc/mine` dans `compatibility.js` (la version de `kyc.js` — plus sûre — prend le relais automatiquement) ; ajout de `sellerKycApi.status()` qui appelle `/kyc/mine` ; réécriture de `SellerKYCScreen` pour lire le vrai tableau de documents (`document_type`, `status`, `rejection_reason`) et calculer un statut global cohérent (Vérifié / À corriger / En cours / Non vérifié).
- **Impact :** un vendeur voit maintenant son vrai statut KYC (approuvé, rejeté avec motif, en attente) au lieu d'un texte figé. Aucun autre écran n'appelait l'ancien endpoint dupliqué — aucun risque de régression identifié ailleurs.
- **Test effectué :** relecture ligne à ligne du fichier corrigé et de la requête SQL sous-jacente pour confirmer la correspondance des champs (`document_type` envoyé à l'upload = `document_type` relu à l'affichage). Je n'ai **pas** pu exécuter l'app (pas de réseau/BDD dans ce bac à sable) — un test manuel sur un compte vendeur réel reste nécessaire avant déploiement.

### Correction 2 — Incohérence résiduelle sur la lecture d'une transaction escrow

- **Fichier :** `frontend/livi/src/features/escrow/escrowApi.ts`
- **Cause :** `transaction(id)` utilisait encore `/escrow/transactions?transaction_id=...`, un paramètre que le backend ignore totalement (il renvoie toujours la même liste de 100 lignes). Le même bug avait déjà été corrigé dans `walletApi.ts` (commentaire « V47 » explicite dans ce fichier) mais pas répercuté ici.
- **Correction :** alignement sur `GET /escrow/transactions/:id`, la route dédiée qui existe déjà côté backend.
- **Impact :** aucun écran n'appelle actuellement `escrowApi.transaction()` (`EscrowCenterScreen` n'utilise que `dashboard()`, `balance()`, `transactions()` la liste) — ce n'était donc pas un bug visible aujourd'hui, mais une bombe à retardement si cette méthode est branchée plus tard sans qu'on se souvienne du premier correctif.
- **Test effectué :** vérification que la route backend `/escrow/transactions/:id` existe bien et suit le format de réponse standard.

Les fichiers corrigés sont dans `CORRECTIONS_KYC_ESCROW.zip`, avec les mêmes chemins que dans votre dépôt — à copier directement par-dessus.

---

## C. Matrice frontend ↔ backend

Fichier joint : **`MATRICE_FRONTEND_BACKEND.csv`** (203 lignes). Construite par extraction automatique de tous les appels `apiRequest(...)`/`uploadFile(...)` du frontend et de toutes les routes Express du backend, puis recoupement, puis vérification manuelle de chaque cas ambigu (fichiers `compatibility.js`, `escrow.js`, `delivery.js`, `kyc.js`, `products.js`, `addresses.js`, `orders.js` lus intégralement).

Répartition :

| Statut | Nombre | Signification |
|---|---|---|
| `MATCHED` | 124 | Appel frontend → route backend confirmée, correspondance directe |
| `MATCHED_DYNAMIC` | 11 | Passe par le sélecteur générique de l'admin (`/admin/:resource`) — cohérence forte mais non vérifiable statiquement à 100 % |
| `MATCHED_INDIRECT` | 2 | Atteint via une redirection HTTP interne (`pickup`/`delivery-proof/verify`) |
| `DEAD_CODE_DUPLICATE` | 30 | Route backend fonctionnelle mais totalement inutilisée, doublonnée ailleurs (détail en section A) |
| `ADMIN_UI_GAP` | 20 | Route backend prête, aucun écran mobile ne l'utilise (outils admin/finance) |
| `INCOMPLETE_FEATURE` | 9 | Route backend prête, fonctionnalité pas encore construite côté UI (variantes produit, rôles multiples, etc.) |
| `NO_CALLER_EXPECTED` | 7 | Normal de n'avoir aucun appelant frontend (health check, webhooks partenaire, téléchargement direct de fichier) |

---

## D. Parcours — état honnête

Je n'ai pas exécuté l'application (pas de réseau/BDD disponible ici), donc rien ci-dessous n'est un test de bout en bout réel — c'est une lecture de code.

| Parcours | Statut | Détail |
|---|---|---|
| ACHETEUR (catalogue → panier → checkout → paiement → confirmation) | **Cohérent en lecture de code** | Chaîne API complète retracée, statuts cohérents. Pas exécuté. |
| VENDEUR (produits → commandes → retrait) | **1 bug trouvé et corrigé** (statut KYC) | Le reste retracé et cohérent. |
| TRANSPORTEUR (missions → QR/PIN → livraison → commission) | **Cohérent en lecture de code**, un point à vérifier en conditions réelles | Le motif de redirection 307 (voir section A) mérite un test sur appareil. |
| ADMIN | **Non audité en profondeur** | Seuls `dashboard` et le CRUD générique ont été vérifiés. |
| AUTH | **Cohérent** | JWT + refresh + sessions, rôles clairement séparés (`client/vendor/transporter/admin`). |
| PAIEMENT / ESCROW | **Cohérent, dépendance externe documentée** | La confirmation réelle attend un partenaire mobile money non encore branché — c'est assumé dans `.env.example`, pas un oubli. |
| WALLET | **Cohérent après correction 2** | |
| LIVRAISON | **Doublon important identifié** (voir `delivery.js` en section A) | Fonctionne via `compatibility.js`, pas via le fichier dédié. |
| QR/PIN | **Cohérent**, génération et vérification bien côté backend | Le frontend ne peut jamais déclarer un colis récupéré sans validation serveur — conforme à la mission. |
| NOTIFICATIONS, CHAT, DISPUTES, SOCIAL/LIVE | **Non audités en profondeur** dans cette session | Les appels API existent et matchent (voir CSV), mais je n'ai pas relu la logique métier de ces domaines en détail. |

---

## E. État final (chiffres réels, pas estimés)

- Écrans frontend : **69**
- Endpoints backend distincts : **190**
- Appels API distincts identifiés côté frontend : **~135** (`apiRequest` + `uploadFile`)
- Endpoints réellement appelés (`MATCHED` + `MATCHED_DYNAMIC` + `MATCHED_INDIRECT`) : **137**
- Endpoints backend sans appelant, dont **30 sont des doublons morts** à nettoyer, **20** sont des outils admin/finance pas encore en UI, **9** sont des fonctionnalités pas encore construites côté UI, et **7** n'ont normalement pas besoin d'appelant (health, webhooks, téléchargements directs)
- Données fictives trouvées dans le frontend : **0** (recherche explicite de `mockData`, `FAKE_`, `const orders/products = [...]` — aucune occurrence)
- Bugs réels confirmés et corrigés cette session : **2** (statut KYC vendeur — impact utilisateur réel ; paramètre de requête ignoré côté escrow — actuellement inoffensif mais latent)
- Problèmes bloquants restants identifiés : **0** trouvé qui empêcherait un parcours de fonctionner aujourd'hui, en dehors de ce qui a déjà été corrigé

---

## Et maintenant ?

Ce que j'ai couvert en profondeur : architecture générale, auth, commandes, escrow/wallet/payouts, KYC, adresses, upload de médias, QR/PIN. Ce que je n'ai **pas** encore audité en détail : chat, disputes, notifications, social/live, et le CRUD admin générique. Vu la taille du projet, je propose qu'on avance par lot plutôt que d'essayer de tout faire d'un coup — dites-moi par où continuer.

# RAPPORT_UXUI_SESSION21 — Audit, cartographie et diagnostic

**Mission** : refonte UX/UI complète de LIVI ("LIVI 2.0"), à partir du projet réel (`livi-apk-main-sessions9-20-final.zip`).
**Périmètre** : frontend uniquement (React Native / Expo). La logique métier backend n'est ni auditée ni modifiée.
**Méthode** : lecture exhaustive du code réel, croisée avec les migrations SQL backend pour vérifier chaque affirmation. Aucun test compilé n'a pu être exécuté au sens classique (pas de `node_modules`, pas d'accès réseau dans cet environnement) — voir §H du rapport d'implémentation pour la méthode de vérification effectivement utilisée (elle a évolué en cours de session, voir note en fin de document).
**Continuité** : cette session poursuit la numérotation des `RAPPORT_AUDIT_SESSIONxx` déjà présents dans le dépôt (sessions 9 à 20, focalisées sur la fiabilité backend/fonctionnelle). Celle-ci est la première dédiée à l'UX/UI.

---

## Étape A — Audit

### Stack confirmée
- **Frontend** : React Native 0.81.5, React 19.1, Expo SDK 54, React Navigation v7 (native-stack + bottom-tabs), TypeScript strict. Pas de librairie de composants UI (NativeBase, RN Paper…) : design system maison dans `src/design/`. Pas de state manager global (Redux/Zustand) : React Context par domaine (Auth, Wallet, Cart, Notifications).
- **Backend** : Node/Express + PostgreSQL, 41 migrations. Logique d'escrow, commission, KYC, preuves de livraison chiffrées (AES-256-GCM) déjà auditée et durcie sur 20 sessions précédentes — **mature, pas un prototype**.
- **Identité de marque confirmée** (`assets/branding/`) : logo colis ailé doré sur fond marine, baseline *« Relier l'Afrique, un colis à la fois »*. Positionnement panafricain logistique + marketplace, paiement en FCFA/XOF. Palette déjà en place : marine `#080F1A` + or `#C9971C`, polices Syne (titres) + Plus Jakarta Sans (texte) — un socle déjà cohérent avec la demande « bleu + or, mieux exploité ».

### Inventaire réel
- **73 écrans** répartis en 5 navigateurs (Root, Buyer, Seller, Transporter, Admin).
- **Design system existant avant refonte** : 10 composants (`Button`, `Card`, `TextField`, `Badge`, `Screen`, `ProofDisplay`, `CountdownTimer`, `RatingPrompt`, `ReputationBadge`, `VideoPlayer`). Solide mais minimal : aucun `ProductCard`, `OrderCard`, état vide, skeleton, ni registre de statuts — chaque écran réinventait ses propres cartes et listes.
- **Aucun lorem ipsum, aucune donnée mock, aucun `TODO`/`FIXME`** trouvé dans le frontend (vérifié par recherche exhaustive) — signal positif, cohérent avec le travail des sessions précédentes.
- **Endpoints réels mais inexploités avant cette session** : `/products/search`, `/products/featured`, `/products/trending`, `/categories` existaient côté backend et frontend (`catalogueApi.ts`, `categoriesApi.ts`) sans qu'aucun écran ne les appelle.

---

## Étape B — Cartographie

### Rôles et navigateurs (avant refonte)
| Rôle | Navigation persistante | Écran d'entrée réel |
|---|---|---|
| Acheteur | Bottom tabs (Feed / Catalogue / Orders / Messages / Profile) | `FeedScreen` (flux vidéo social) |
| Vendeur | Aucune — stack pur | `SellerDashboardScreen` |
| Transporteur | Aucune — stack pur | `TransporterDashboardScreen` |
| Admin | Aucune — stack pur (déjà corrigé en session 17 pour démarrer sur le dashboard) | `AdminDashboardScreen` |

Seul l'acheteur avait une bottom tab bar. C'est la première incohérence structurelle du produit.

### Parcours réels par rôle (vérifiés dans le code, pas supposés)
- **Acheteur** : Catalogue → Produit → Panier → Checkout (devis serveur réel, création de commande, init paiement) → Suivi commande → Confirmation réception (PIN) → Avis. Circuit complet et fonctionnel.
- **Vendeur** : Produits/Inventaire → Commande reçue → Preuve de retrait (`SellerPickupProof`) → Statistiques → Versement. Fonctionnel, avec upload vidéo/Live en plus (fonctionnalité social-commerce réelle, pas un gadget).
- **Transporteur** : Missions (attribution par proximité, séquentielle, fenêtre de ~5 min avant réattribution — migration `039_v54_mission_dispatch.sql`) → Acceptation → Suivi/carte → Validation QR/PIN → Gain. Circuit complet.

---

## Étape C — Diagnostic (constats numérotés)

### 🔴 C0 — Bug critique : listes vides en permanence (PRIORITÉ ABSOLUE)
`apiRequest()` (`services/api/client.ts`) déballe systématiquement l'enveloppe backend `{success, data, request_id}` et renvoie `data` directement (commenté explicitement dans le fichier). Or la quasi-totalité des routes de liste du backend font `ok(res, rows)` avec `rows` déjà un **tableau brut** (`routes/orders.js`, `routes/products.js`, `routes/compatibility.js` pour `/vendor/products`, `/vendor/orders`, `/users/me/wishlist`…). De nombreux écrans lisaient pourtant `réponse?.orders ?? réponse?.data ?? []` — sur un tableau, ces deux clés valent `undefined`, donc **le code retombait toujours sur `[]`, même avec de vraies données.**

**Écrans confirmés touchés et corrigés cette session** : commandes acheteur (`OrdersScreen`), wishlist (`WishlistScreen`), produits et commandes vendeur (`SellerProductsScreen`, `SellerOrdersScreen`), adresses (`AddressesScreen`), moyens de paiement (`PaymentMethodsScreen`), remboursements (`RefundsScreen`), centre de protection (`EscrowCenterScreen`), inventaire vendeur (`InventoryScreen`), historique et missions transporteur (`DeliveryHistoryScreen`, `MissionsScreen`), et **`CheckoutScreen`** — le plus grave de tous, voir addendum 2 du rapport stratégie/implémentation : le bouton de paiement était structurellement toujours désactivé. Plus le nouveau `HomeScreen`/`CatalogueScreen` construits en tenant compte du bug dès le départ. Le Wallet lui-même avait un bug apparenté mais distinct — voir C0-quater.

Feuille de route priorité 1 entièrement traitée cette session.

Correctif appliqué : `src/services/api/normalize.ts`, une fonction unique (`normalizeList`) qui vérifie **d'abord** si la réponse est déjà un tableau avant de chercher une clé imbriquée. C'est un bug de correction de données, pas une préférence de design — il a été traité avant toute autre refonte visuelle car aucune hiérarchie ne compte si l'écran affiche "aucune commande" à un acheteur qui en a réellement.

### 🔴 C0-bis / C0-ter — Champs renommés côté backend jamais suivis côté frontend
Même famille de bug, déjà partiellement documentée dans le code lui-même pour `price` vs `price_xof` (`catalogueApi.ts`) :
- **`order.total` n'existe pas** — la vraie colonne SQL est `total_amount` (`migrations/001_initial.sql`). `OrderCard` (nouveau), `OrderDetailsScreen` et `SellerOrdersScreen` affichaient donc 0 FCFA pour chaque commande. Corrigé (`total_amount ?? total` partout, type `Order` mis à jour).
- **`SellerProduct.price` n'existe pas** — même bug que côté acheteur, jamais reporté côté vendeur. `SellerProductsScreen` affichait 0 FCFA pour chaque produit. Corrigé (`price_xof ?? price`).
- **`user.first_name` n'existe pas** — la table `users` n'a qu'une colonne `name` (`PATCH /users/me` le confirme). Un des brouillons de cette session utilisait `.first_name` par réflexe ; corrigé en `.name` avant livraison, mentionné ici pour que la prochaine session vérifie s'il subsiste ailleurs.

### 🔴 C0-quater — Le Wallet lui-même lisait des champs qui n'existent pas (découvert en corrigeant C6)
Même famille que C0-bis/C0-ter, sur l'écran le plus stratégique de la mission. `GET /escrow/balance` (`routes/escrow.js`) ne renvoie jamais `balance`, `available_balance` ni `pending_balance` — les vrais champs sont `available_amount` / `locked_amount` / `owed_total` (vendeur, transporteur) ou `available_amount` (toujours `'0'`) / `locked_amount` / `active_order_count` (acheteur, qui n'a structurellement aucun solde retirable). La première version de `WalletScreen.tsx` livrée cette session affichait donc "0 FCFA" disponible pour tout le monde. Corrigé avant livraison finale — détail complet dans `RAPPORT_UXUI_SESSION21_STRATEGIE_ET_IMPLEMENTATION.md`, addendum.

### 🟡 C10 — Champs fantômes disséminés : un motif systémique, pas un cas isolé
Troisième famille de la lignée C0-bis/ter/quater, mais celle-ci touche le plus grand nombre d'écrans. `RefundsScreen` lisait `reference`/`reason`/`created_at`, absents de la requête réelle (`escrow_transactions` ne renvoie que `id, order_id, amount, shipping_fee, status, refunded_at`). `MissionsScreen`/`DeliveryHistoryScreen` lisaient `reference`, absent de `shipments` (le vrai identifiant lisible est `tracking_code`). **Plus grave et plus large** : `order.payment_status` et `order.delivery_status` — lus dans `OrderDetailsScreen` (3 badges), `SellerOrderDetailsScreen` (3 lignes) — et `mission.pickup_status`/`mission.delivery_status` dans `MissionDetailsScreen`, **n'existent nulle part dans le backend** : ni colonne SQL sur `orders`, ni alias dans aucune route (recherche exhaustive sur `migrations/*.sql` et `src/routes/*.js`). Ces champs affichaient "—" sur *toutes* les commandes et missions, sans exception, depuis le début. Aucun de ces cas ne cassait l'écran (repli gracieux sur un tiret ou un id tronqué), mais présentait comme "information manquante au cas par cas" ce qui était en réalité "champ qui ne peut structurellement jamais exister" — corrigés à l'occasion du passage sur ces écrans, remplacés par le seul statut réel (`order.status` / `mission.status`) via `StatusBadge`.

**Recommandation pour toute session future** : avant d'ajouter un champ à un type frontend, vérifier son existence réelle dans la requête SQL de la route correspondante plutôt que de faire confiance au nom qui "semble logique".

### 🟠 C1 — `BuyerDashboardScreen` : écran "Accueil" réel, complet, mais totalement inatteignable
Enregistré dans `BuyerNavigator` sous le nom `BuyerDashboard` (titre : *« Accueil »*), avec de vrais appels serveur (stats, commandes actives, notifications, lives). **Aucune navigation, nulle part dans tout le dépôt, ne pointe vers lui** (vérifié par recherche exhaustive sur `frontend/` et `backend/`). Ni les audits de navigation des sessions précédentes (session 17) ne l'avaient signalé. Écran supprimé cette session, son contenu utile refondu dans le nouveau `HomeScreen`.

### 🟠 C2 — L'accueil réel de l'acheteur était un pur flux social
`FeedScreen` (flux vidéo vertical façon TikTok, avec achat inline) était l'onglet d'accueil réel (`initialRouteName="Feed"`). Aucune recherche, aucune catégorie, aucun aperçu de commande, aucun wallet visible. Un acheteur ouvrant l'app ne voyait ni son panier en cours, ni où chercher un produit précis.

### 🟠 C3 — Incohérence de navigation entre rôles
Seul l'acheteur avait des bottom tabs. Vendeur, transporteur et admin naviguaient en pile pure — sans point d'ancrage permanent.

### 🟠 C4 — Le Wallet, non prioritaire structurellement, a poussé `ProfileScreen` à devenir un hub de secours
Commentaire du code lui-même (avant refonte) : *"this screen is the ONLY reliably-reachable screen for buyers… one of the few places consistently linked from their dashboards."* Wallet, KYC, Véhicule, Boutique s'y sont accumulés comme raccourcis faute d'un meilleur endroit — symptôme direct de C3, pas un choix de design déclaré.

### 🟠 C5 — Dashboards vendeur/transporteur : liste plate sans hiérarchie
`SellerDashboardScreen` : 3 cartes de stats + **13 liens de navigation à plat**, tous au même niveau visuel (Produits, Inventaire, Commandes, Wallet, Paiements, Statistiques, Messages, KYC, Boutique, Vidéos, Creator Tools, Live, Profil, Sécurité, Notifications). Aucune priorisation, aucun signal "nécessite une action".

### 🟡 C6 — Wallet et Escrow Center dupliquent la même réalité financière sans lien explicite
Les deux écrans lisent en partie le même solde (`GET /escrow/balance`, via `walletApi.getWallet` et `escrowApi.balance/dashboard`) et affichent chacun leur propre "disponible / en attente" sans se référencer l'un l'autre.

### 🟡 C7 — Catalogue n'exploitait aucun des vrais endpoints de découverte
`CatalogueScreen` appelait uniquement `catalogueApi.list()` : pas de recherche, pas de catégories, pas de favoris — alors que `/products/search`, `/products/featured`, `/products/trending`, `/categories` existent et fonctionnent réellement côté backend. *Nuance backend à noter (hors périmètre frontend, à consigner pour l'équipe backend)* : `/products/featured` et `/products/trending` exécutent exactement la même requête SQL (les 20 produits actifs les plus récents) — aucune distinction réelle entre les deux pour l'instant, et ces deux routes ne recalculent pas `display_price_xof` (prix avec commission-passthrough) contrairement à `GET /products` — un acheteur pourrait exceptionnellement voir un prix légèrement différent entre la sélection d'accueil et la fiche produit pour les vendeurs en `commission_passthrough=true`. Signalé, non corrigé (backend hors périmètre).

### 🟡 C8 — Incohérence de vocabulaire des statuts, y compris dans le design system lui-même
`escrowStatusColor` (dans `theme.ts`) utilisait des clés (`pending`, `locked`) ne correspondant à **aucun** statut réel du backend (`awaiting_payment`, `payment_pending`, `funded`, `released`, `disputed`, `refunded`, `cancelled` — vérifiés dans `migrations/034_v50_status_enum_integrity.sql`). Cet export n'était d'ailleurs importé nulle part — probablement pourquoi l'écart n'avait jamais été remarqué. Par ailleurs, `TransactionsScreen` affichait `{item.type} · {item.status}` bruts, valeurs techniques directement visibles par l'utilisateur (ex. valeurs telles que retournées par la base, jamais traduites).

### 🟡 C9 — Formatage monétaire dupliqué et incohérent
Au moins 4 implémentations différentes de "formater un montant en FCFA" trouvées (`WalletScreen`, `TransactionsScreen`, `SellerDashboardScreen`, `SellerProductsScreen`), certaines avec `Intl.NumberFormat('fr-FR')`, d'autres avec `.toLocaleString()` sans locale explicite (dépend alors de la locale de l'appareil).

### 🟢 Points positifs à préserver tels quels
- Checkout : devis calculé serveur (adresse → frais de port), création de commande + initialisation de paiement réels, pas de simulation.
- `DepositScreen` : état honnête ("non disponible pour l'instant") plutôt qu'un dépôt simulé qui ferait croire à une opération réelle.
- `OrderDetailsScreen` : fenêtre de litige de 10 minutes, confirmation par PIN, notation vendeur **et** transporteur — logique déjà riche, seule la présentation à plat restait à améliorer.
- `PlatformAnalyticsScreen` (admin) : affiche le JSON brut de l'API avec les underscores remplacés par des espaces — non retouché cette session (admin = périmètre Niveau 3, priorité basse), mais consigné pour la suite.

---

*(Suite : stratégie, design system et détail de l'implémentation dans RAPPORT_UXUI_SESSION21_STRATEGIE_ET_IMPLEMENTATION.md)*

# RAPPORT_UXUI_SESSION21 — Stratégie, design system, implémentation

*(Suite de RAPPORT_UXUI_SESSION21_AUDIT.md)*

---

## Étape D — Stratégie

### Principe directeur appliqué
Aucune fonctionnalité réelle n'a été supprimée. Chaque déplacement corrige un constat précis du diagnostic (C1 à C9), pas une préférence esthétique. Là où une donnée manquait pour aller plus loin (ex. filtrage catalogue par catégorie côté serveur, absent de l'API), la fonctionnalité a été construite honnêtement avec ce qui existe (filtrage côté client sur des données réelles) plutôt que simulée.

### Nouvelle architecture de navigation
**Acheteur** — 5 onglets : **Accueil** (nouveau, remplace Feed) / **Catalogue** / **Commandes** / **Wallet** (nouveau) / **Profil**. Feed devient un écran de pile complet, atteignable depuis l'accueil ("Découvrir en vidéo → Voir tout") : rien n'est perdu, sa place change. Messages passe d'onglet à icône contextuelle (moins prioritaire que le portefeuille pour une marketplace — voir C4).

**Vendeur** — 5 onglets, même grammaire que l'acheteur pour la cohérence inter-rôles (règle §56 de la mission) : **Dashboard** / **Commandes** / **Produits** / **Wallet** / **Profil**. Vidéos, Live, Creator Tools, Statistiques, Versements, Boutique, KYC, Messages restent accessibles en un tap depuis un Dashboard désormais groupé (voir Étape F).

**Transporteur** — 4 onglets (une zone de moins à valeur égale que vendeur) : **Dashboard** / **Missions** / **Wallet** / **Profil**. Suivi, carte, QR/PIN, historique, revenus, véhicule, KYC restent à un tap du Dashboard, regroupés par moment du métier plutôt qu'à plat.

**Admin** — non retouché structurellement cette session (stack déjà corrigé en session 17, priorité Niveau 3 assumée — voir roadmap).

*Détail technique* : les onglets Wallet/Commandes/Produits/Profil réutilisent volontairement le même nom de route que l'écran de pile équivalent (déjà présent avant cette refonte, ex. `Wallet`, `Orders`). React Navigation résout alors vers le navigateur le plus proche de l'appelant : depuis un onglet, l'appel garde la tab bar ; depuis un flow en pile (Checkout, Payouts…), il pousse un écran plein. Aucun appel `navigate(...)` existant n'a dû être modifié pour ce changement — vérifié par recherche exhaustive avant modification.

### Nouvel accueil acheteur (résout C1 + C2)
Recherche → commande en cours (si active) → 4 raccourcis (Wallet, Protection, Commandes, Favoris) → catégories → sélection de produits (endpoints réels enfin exploités, C7) → découverte vidéo (contenu de Feed, en aperçu horizontal plutôt qu'en plein écran). Chaque appel réseau est indépendant (`Promise.allSettled`) : un endpoint en échec n'efface plus tout l'écran, contrairement à l'ancien `BuyerDashboard`.

### Wallet traité comme un produit à part entière (résout C4 + C6)
Solde disponible en évidence, solde en attente **expliqué** ("fonds encore protégés le temps que vos commandes en cours se terminent") plutôt que juste affiché, aperçu des 5 dernières transactions avec statut traduit (résout C8), lien direct vers "Protection" (Escrow) plutôt que deux totaux concurrents non reliés.

### Dashboards vendeur/transporteur regroupés par intention (résout C5)
Vendeur : *Contenu & Live* / *Développer ma boutique* / *Finances* / *Support & conformité*. Transporteur : *Livraison en cours* / *Mon activité* / *Mon compte*. Produits/Commandes/Wallet/Profil retirés de ces listes : ils ont désormais leur propre onglet, les y laisser aurait recréé l'incohérence "accessible de 5 façons sans raison" (règle §44).

---

## Étape E — Design system LIVI 2.0

Existant conservé et étendu (pas de réécriture des tokens qui fonctionnaient déjà : couleurs, typographie Syne/Plus Jakarta Sans, spacing, radius, shadow). Ajouts :

- **`src/design/status.ts`** — registre unique des statuts (commande, escrow, livraison, retrait, litige, KYC, mission), avec les vraies valeurs d'enum vérifiées dans les migrations SQL et des libellés FR humains. Corrige C8 à la racine plutôt qu'à chaque écran.
- **`StatusBadge`** — badge de statut unique, branché sur le registre ci-dessus.
- **`Money` / `formatMoney()`** — formateur monétaire unique. Corrige C9.
- **`ProductCard`**, **`OrderCard`** — cartes réutilisables, chacune avec ses champs réels documentés en commentaire (évite qu'un futur écran réintroduise un bug `price` vs `price_xof`).
- **`EmptyState`** — état vide standard (icône, titre, description, action optionnelle). Plus jamais de page blanche ni de `<Text>Aucune donnée.</Text>` isolé.
- **`Skeleton`** — bloc de chargement animé, remplace les `ActivityIndicator` plein écran qui faisaient disparaître toute la mise en page pendant le chargement.
- **`SectionHeader`**, **`ActionRow`**, **`StatCard`**, **`QuickAction`**, **`SearchBar`** — vocabulaire visuel commun pour les regroupements, listes d'actions, tuiles de raccourci et statistiques des dashboards.
- **`src/services/api/normalize.ts`** — `normalizeList()`, le correctif de C0.

Tous exportés depuis `src/design/components/index.ts`.

---

## Étape F — Refonte : écrans livrés cette session

| Écran | Nature du changement |
|---|---|
| `screens/buyer/HomeScreen.tsx` | **Nouveau.** Remplace Feed comme accueil ; fusionne le contenu utile de BuyerDashboard. |
| `screens/buyer/CatalogueScreen.tsx` | Refonte complète : recherche serveur débattue, catégories (filtrage client, voir C7), favoris réels, `ProductCard`. |
| `screens/buyer/OrdersScreen.tsx` | Bug C0 corrigé + `OrderCard`/`EmptyState`/`Skeleton`. |
| `screens/buyer/WishlistScreen.tsx` | Bug C0 corrigé + états vide/chargement standardisés. |
| `screens/buyer/OrderDetailsScreen.tsx` | Bug C0-bis corrigé (montant total). Reste sinon inchangé (déjà riche — PIN, litige, notation). |
| `screens/wallet/WalletScreen.tsx` | Refonte complète : disponible/en attente expliqués, aperçu transactions, `StatusBadge`. |
| `screens/seller/SellerDashboardScreen.tsx` | Refonte complète : 4 sections au lieu de 13 liens à plat. |
| `screens/seller/SellerOrdersScreen.tsx` | Bugs C0 + C0-bis corrigés + `OrderCard`. |
| `screens/seller/SellerProductsScreen.tsx` | Bugs C0 + prix corrigés + présentation en liste avec vignette. |
| `screens/transporter/TransporterDashboardScreen.tsx` | Refonte complète : 3 sections, toggle de disponibilité et ping de position **inchangés** (logique métier déjà correcte). |
| `screens/profile/ProfileScreen.tsx` | Retrait des raccourcis Wallet désormais redondants avec l'onglet ; `ActionRow`/`SectionHeader`. |
| `navigation/BuyerNavigator.tsx`, `SellerNavigator.tsx`, `TransporterNavigator.tsx` | Ajout des bottom tabs (voir Étape D). |
| `screens/buyer/AddressesScreen.tsx`, `PaymentMethodsScreen.tsx`, `RefundsScreen.tsx` | Bug C0 corrigé (feuille de route priorité 1). `RefundsScreen` avait en plus trois champs fantômes (`reference`, `reason`, `created_at` n'existent pas sur `escrow_transactions`) — retirés plutôt que laissés éternellement à "—". |
| `screens/buyer/EscrowCenterScreen.tsx` | Bug C0 + **C0-quater** corrigés (voir addendum ci-dessous). Lien explicite vers Wallet pour vendeur/transporteur (résout C6). |
| `screens/seller/InventoryScreen.tsx` | Bug C0 corrigé. |
| `screens/transporter/DeliveryHistoryScreen.tsx`, `MissionsScreen.tsx` | Bug C0 corrigé ; `reference` (inexistant sur `shipments`) remplacé par `tracking_code` (réel). Toute la logique métier de `MissionsScreen` (offre 5 minutes, minuteur, accepter/refuser) laissée strictement inchangée — déjà correcte. |

### Addendum — Constat C0-quater (découvert et corrigé après la livraison initiale du Wallet)

En finissant de corriger `EscrowCenterScreen`, la vérification de `GET /escrow/balance` (`routes/escrow.js`) a révélé que **le premier jet de `WalletScreen.tsx` livré cette session contenait le même bug qu'il corrigeait ailleurs** : le type `Wallet` déclarait `balance`, `available_balance`, `pending_balance` — trois champs que cet endpoint ne renvoie **jamais**. Les vrais champs :
- vendeur/transporteur : `{ currency, available_amount, locked_amount, owed_total }`
- acheteur : `{ currency, available_amount: '0' (fixe), locked_amount, active_order_count }`

Un acheteur n'a structurellement aucun solde retirable — ses fonds sont soit à venir, soit protégés en escrow, jamais détenus par lui. `available_amount` vaut donc toujours `'0'` pour ce rôle côté serveur : ce n'est pas un bug backend, c'est le modèle métier réel. `WalletScreen` distingue maintenant les deux cas plutôt que d'afficher la même carte "solde disponible" à tout le monde — l'acheteur voit "Fonds actuellement protégés" (`locked_amount`), le vendeur/transporteur voit "Solde disponible" (`available_amount`, le vrai solde retirable). `HomeScreen` (aperçu wallet) a reçu la même correction. `TransporterDashboardScreen` et `PayoutsScreen` ont été vérifiés à part : ils utilisaient déjà les bons champs (endpoints différents, `/transporter/wallet` et un alias construit dans `sellerApi.payouts()`), aucune correction nécessaire.

Ce constat est ajouté au registre C0 sous le nom **C0-quater** dans `RAPPORT_UXUI_SESSION21_AUDIT.md` pour toute référence future.

### Addendum 2 — Constat C0 sur `CheckoutScreen` : le bug le plus grave trouvé cette session

`checkoutApi.addresses()` et `checkoutApi.paymentMethods()` appellent les mêmes routes que `AddressesScreen`/`PaymentMethodsScreen` (`/users/me/addresses`, `/users/me/payment-methods`), donc le même bug C0 s'y appliquait. Sur cet écran précis, la conséquence dépasse largement un simple état vide mal géré : le bouton **« Payer et sécuriser la commande »** porte `disabled={!addresses.length || !payments.length}` — avec `addresses`/`payments` toujours vides à cause du bug, **ce bouton ne pouvait structurellement jamais être activé**, quel que soit le nombre d'adresses ou de moyens de paiement réellement enregistrés par l'acheteur. Corrigé avec `normalizeList()`. Ajout au passage : un lien "+ Ajouter une adresse / un moyen de paiement" quand la liste est réellement vide (au lieu d'un bouton silencieusement bloqué sans explication), et le bloc d'explication de la protection des fonds prévu au §18 de la mission.

### Addendum 3 — Gap backend réel : impossible d'afficher le nom du vendeur sur la fiche produit

Le §15 de la mission demande que la fiche produit réponde à *« Qui le vend ? »*. Vérification faite : `GET /products/:id` (`routes/products.js`) ne sélectionne que `p.vendor_id` (un UUID), jamais de nom de boutique. Aucune route publique de type `GET /vendors/:id` n'existe pour résoudre ce nom côté client. Impossible d'afficher une identité de vendeur sans l'inventer — non fait, conformément à la règle *"réinventer l'expérience oui, inventer le produit non"*. **Recommandation pour l'équipe backend** (hors périmètre de cette session, frontend uniquement) : exposer un endpoint public minimal du type `GET /vendors/:id` (nom de boutique, ville, éventuellement note) permettrait de résoudre à la fois ce manque sur la fiche produit et l'absence de regroupement par vendeur dans le panier (§17 de la mission, non traité pour la même raison).

**Supprimé** : `screens/buyer/BuyerDashboardScreen.tsx` (son contenu vit désormais dans `HomeScreen.tsx` ; vérifié irréférencé avant suppression — voir C1).

---

## Étape H — Vérification

Contrainte de départ confirmée identique à celle des sessions précédentes : ni `node_modules`, ni accès réseau dans cet environnement. **Découverte faite en cours de session** : `tsc` (TypeScript) est en réalité disponible globalement (`~/.npm-global/bin/tsc`), ce qui n'avait apparemment pas été exploité par les sessions précédentes. Sans les types du projet (React Native, Expo, React Navigation ne sont pas installés), un typecheck complet reste impossible — mais faire tourner `tsc` fichier par fichier avec des options minimales permet de détecter les **erreurs de syntaxe réelles** (TS1xxx/TS17xxx), en filtrant le bruit attendu (modules introuvables). Méthode validée sur un fichier volontairement cassé avant usage (voir historique de session). Les 52 fichiers créés ou modifiés cette session (audit, design system, les 3 rôles réels, et une passe ciblée sur l'admin) ont été vérifiés de cette façon : **zéro erreur de syntaxe détectée**. Cela ne remplace pas un vrai `expo start` ni un build EAS — cela garantit seulement que chaque fichier est syntaxiquement valide, ce qu'une simple relecture ne peut pas garantir avec certitude.

Chaque nom de champ utilisé (statuts, montants, noms d'utilisateur…) a été vérifié contre le schéma SQL réel plutôt que supposé — c'est ainsi que C0-bis et C0-ter ont été découverts. Chaque composant importé a été vérifié comme réellement exporté (recherche croisée import ↔ export, zéro écart).

## Étape I — Nettoyage

`BuyerDashboardScreen.tsx` supprimé (voir C1). Aucune autre suppression cette session : le reste du code non retouché n'a pas été jugé "sûr à supprimer" sans l'avoir audité aussi précisément que ce qui a été livré — mieux vaut le lister en roadmap que le supprimer à l'aveugle (règle §43 de la mission).

---

## Feuille de route — ce qui reste, par priorité

Cette refonte couvre les écrans à plus fort effet de levier (accueil, wallet, catalogue, les deux dashboards, commandes, profil, navigation) et corrige les bugs qui auraient invalidé n'importe quelle refonte visuelle par-dessus. Elle ne couvre pas encore l'intégralité des 73 écrans — voici l'ordre recommandé pour la suite.

**Priorité 1 — étendre le correctif C0/C0-bis (mécanique, faible risque, fort impact)**
✅ Fait cette session : `AddressesScreen`, `PaymentMethodsScreen`, `RefundsScreen`, `EscrowCenterScreen`, `InventoryScreen`, `DeliveryHistoryScreen`, `MissionsScreen`, **`CheckoutScreen`** (le plus grave de tous — voir addendum 2 ci-dessous : le bouton de paiement était structurellement toujours désactivé).
Priorité 1 entièrement traitée.

**Priorité 2 — écrans Niveau 1 restants**
✅ Fait cette session : `ProductScreen` (protection des fonds ajoutée ; pas de nom de vendeur affiché — voir addendum 3, gap backend réel), `CartScreen` (cohérence de formatage), `QRValidationScreen` (transporteur — dump JSON brut retiré, états distincts traitement/succès/erreur avec les 3 vrais codes d'erreur backend, action de suite vers la mission).
Restant : `EscrowCenterScreen` déjà traité en priorité 1. `BuyerQRValidationScreen`/confirmation PIN acheteur — déjà géré correctement dans `OrderDetailsScreen`, aucune action requise.

**Priorité 3 — Niveau 2**
✅ Fait cette session : `TransactionsScreen`/`TransactionDetailsScreen` (`StatusBadge`+`Money`, 4e formateur monétaire dupliqué éliminé), `SellerOrderDetailsScreen` et `OrderDetailsScreen` (constat C10 étendu — `payment_status`/`delivery_status` n'existent pas, retirés), `MissionDetailsScreen` (même correction pour `pickup_status`/`delivery_status`), `NotificationsScreen`/`SecurityScreen` (polish léger, ces deux écrans étaient déjà solides fonctionnellement). Bonus : la saisie d'un UUID produit à la main pour laisser un avis (`OrderDetailsScreen`) remplacée par une sélection parmi les articles réels de la commande.
Restant : `PayoutsScreen`/`WishlistScreen` — déjà corrects fonctionnellement, migration purement cosmétique vers `StatusBadge`/`Money`/`EmptyState`, non urgente.

**Priorité 4 — Admin (Niveau 3, traité à la hauteur de son périmètre)**
✅ Fait cette session : `GET /admin/dashboard` cartographié (`{users, orders, paid_orders, gross_order_value}` — 4 compteurs, rien d'autre) ; `AdminDashboardScreen` (StatCard réelles + 18 raccourcis regroupés en 4 catégories, même vocabulaire que les dashboards vendeur/transporteur) et `PlatformAnalyticsScreen` (même dump JSON brut retiré — découverte au passage : les deux écrans appelaient déjà le même endpoint, donc affichaient déjà la même donnée sous deux habillages différents ; non fusionnés en un seul écran pour rester prudent sur la restructuration de navigation admin, mais tous deux corrigés) ; `AdminResourceScreen` (le composant générique derrière 18 écrans admin — clés lisibles, dates formatées).

**Volontairement non traité** : `AdminFinanceScreen`, `AdminReconciliationScreen`, `AdminKycReviewScreen`, `AdminPayoutsQueueScreen`, `AdminIntegrityScreen`, `SupportCenterScreen` — aucun bug C0 détecté par recherche ciblée, mais chacun mériterait une revue individuelle avant retouche (outillage interne spécialisé, Niveau 3 assumé comme la priorité la plus basse de la mission depuis le début de cette session).

**Priorité 5 — nettoyage final**
Une fois chaque écran passé en revue, repérer les styles/couleurs legacy réellement orphelins (`theme.ts` conserve un export `theme` legacy pour compatibilité ascendante — à vérifier écran par écran avant de le retirer).

---

*Fin du rapport. Session suivante : reprendre à la Priorité 1 de la feuille de route ci-dessus, en conservant la même discipline de vérification (schéma SQL réel avant tout champ utilisé, `tsc` fichier par fichier avant livraison).*

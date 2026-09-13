# Session 17 — Audit systématique de l'interconnexion entre écrans

Demandé explicitement : généraliser la classe de bug trouvée dans
`LIVI_Correctifs_Categorie_Photos_Video.zip` (Session 14) — des écrans
entièrement fonctionnels mais inatteignables faute de lien de navigation
(`VideoManager`/`CreatorTools`/`LiveDashboard`) — et vérifier
méthodiquement s'il en existe d'autres.

## A. Méthode

1. Extraction de tous les noms d'écran déclarés dans les 5 navigateurs
   (`RootNavigator`, `BuyerNavigator`, `SellerNavigator`,
   `TransporterNavigator`, `AdminNavigator`) — 85 au total.
2. Recherche de chaque nom comme cible de navigation ailleurs dans le
   code — **pas seulement `navigation.navigate('Nom')` littéral**, car
   plusieurs écrans (SellerDashboard, TransporterDashboard, Profile)
   utilisent un tableau de données `[label, cible].map(...)` avec
   `navigate(target)` où `target` est une variable. Une recherche limitée
   aux appels littéraux aurait produit une liste de faux positifs
   massive (75 sur 85) — corrigé en recherchant chaque nom comme chaîne
   littérale n'importe où dans le code (tableaux compris), pas seulement
   comme argument direct de `navigate(`.
3. Chaque candidat restant vérifié manuellement (lecture du fichier
   source réel), pas seulement compté.

## B. Bugs confirmés et corrigés

### 1. Le panneau admin entier était inatteignable (sévère)

**Deux causes cumulées, dans deux fichiers différents :**

- `AdminNavigator.tsx` déclarait `"Profile"` en premier écran de sa pile.
  React Navigation utilise par défaut le premier enfant comme route
  initiale — exactement comme `SellerNavigator` (`SellerDashboard` en
  premier) et `TransporterNavigator` (`Dashboard` en premier), sauf que
  pour l'admin, ce premier écran était `Profile`, pas `AdminDashboard`.
- `ProfileScreen.tsx` (`ROLE_LINKS`) définit les raccourcis de navigation
  affichés sur cet écran par rôle — `admin: []`, un tableau **vide**.

**Conséquence réelle** : un administrateur qui se connecte atterrit sur
l'écran Profil, avec pour seules options "Sécurité" et "Notifications" —
**aucun chemin découvrable vers `AdminDashboard`**, qui contient
pourtant lui-même 18 liens vers absolument tous les autres écrans admin
(utilisateurs, vendeurs, transporteurs, commandes, paiements, escrow,
retraits, litiges, KYC, produits, missions, finance, réconciliation,
intégrité, analytics, logs, support) — tous vérifiés fonctionnels en
Sessions 15 et 16. Le panneau d'administration au complet était
construit, correct, et totalement invisible depuis l'interface.

**Corrigé** : `AdminDashboard` déplacé en premier dans
`AdminNavigator.tsx` (devient l'écran d'atterrissage, cohérent avec
Seller/Transporter) ; `ROLE_LINKS.admin` peuplé avec un lien de secours
vers `AdminDashboard`, pour qu'un administrateur arrivant sur Profil par
un autre chemin ne se retrouve pas non plus bloqué.

### 2. Navigation cassée vers le détail d'un litige, côté admin

`DisputesScreen.tsx` (composant partagé par Buyer/Seller/Admin) contient
un appel figé : `navigation.navigate('DisputeDetails', {...})`.
`BuyerNavigator` et `SellerNavigator` enregistrent tous les deux cette
destination sous le nom exact `"DisputeDetails"` — `AdminNavigator` seul
l'enregistrait sous `"AdminDisputeDetails"`. Conséquence : taper sur un
litige depuis la liste admin appelait une navigation vers un nom d'écran
non enregistré dans cette pile. Corrigé en renommant vers
`"DisputeDetails"`, cohérent avec les deux autres navigateurs, sans
toucher au composant partagé (dont l'usage était déjà correct pour
Buyer/Seller).

### 3. Écran de disponibilité transporteur inatteignable (mineur)

`AvailabilityScreen` enregistré dans `TransporterNavigator` mais jamais
lié depuis nulle part. Impact limité : le tableau de bord transporteur
propose déjà un interrupteur en ligne pour le même effet (disponible/hors
ligne), donc la fonction n'était pas absente — seul l'écran dédié
(53 lignes, contenu minimal) était orphelin. Ajouté aux raccourcis du
tableau de bord par prudence/cohérence.

## C. Trouvé, non corrigé — nécessite une décision produit, pas un simple lien manquant

- **`Deposit`** (dépôt Mobile Money, `BuyerNavigator`) : aucun écran ne
  navigue vers lui, y compris `EscrowCenterScreen` qui n'a strictement
  aucun bouton (`Pressable`/`onPress`) — écran purement informationnel en
  l'état. Si le dépôt est censé être initiable depuis l'escrow ou le
  wallet, il manque un bouton explicite ; je ne l'ai pas ajouté moi-même
  car je ne connais pas le flux métier voulu (montant, provider, retour).
- **`LiveShops`** (`BuyerNavigator`) : aucune référence trouvée. À
  vérifier si la fonctionnalité "live shopping" est censée déjà être
  exposée quelque part dans le feed/l'accueil.
- **`TwoFactorAuthScreen`**, **`VerifyEmailScreen`** (`RootNavigator`,
  pile d'authentification) : aucune référence nulle part, y compris dans
  `RegisterScreen`/`LoginScreen` réécrits en Session 9. Semblent
  vestigiaux d'une conception d'authentification antérieure (2FA /
  vérification email) abandonnée avant même le flux OTP que la Session 9
  a remplacé. Je ne les ai pas supprimés unilatéralement : une
  authentification est sensible, et retirer un écran pourrait masquer une
  intention produit encore valide que je ne connais pas.
- **`EscrowCenter`** (`BuyerNavigator`) : alias redondant — le même
  composant (`EscrowCenterScreen`) est aussi enregistré sous `"Escrow"`,
  qui lui est bien atteint depuis `BuyerDashboardScreen`. Inoffensif
  (juste une route en double, jamais empruntée), pas corrigé par
  prudence de ne pas toucher à un nommage sans savoir lequel des deux
  l'équipe préfère garder à terme.

## D. Vérifié réellement

- Nouveau fichier `tests/navigation_interconnection.test.js` (5 tests,
  approche par inspection de source) — **5/5 PASS réellement exécutés**
  après correction d'un bug dans mon propre test (une regex qui
  s'arrêtait au premier `]` rencontré, tronquant la capture d'un tableau
  imbriqué — trouvé et corrigé avant de faire confiance au résultat).
- Suite complète réexécutée : **193/204 PASS**, mêmes 5 échecs
  préexistants, aucune régression.
- `tsc --noEmit` toujours **BLOCKED** dans ce bac à sable (`node_modules`
  frontend absent, comme toutes les sessions précédentes) — les 3
  fichiers `.tsx` modifiés vérifiés par relecture précise et par les tests
  d'inspection de source ci-dessus, pas par compilation réelle.

## E. NON exécuté / à vérifier après déploiement

- Rendu réel de la navigation admin dans un environnement Expo réel —
  confirmer visuellement que `AdminDashboard` s'affiche bien à la
  connexion et que la navigation vers un litige fonctionne.
- Décision produit sur les 5 points de la section C.

## F. Fichiers modifiés

| Fichier | Modification | Impact |
|---|---|---|
| `frontend/livi/src/navigation/AdminNavigator.tsx` | `AdminDashboard` déplacé en premier ; `AdminDisputeDetails`→`DisputeDetails`. | Panneau admin entier rendu atteignable ; navigation vers un litige réparée. |
| `frontend/livi/src/screens/profile/ProfileScreen.tsx` | `ROLE_LINKS.admin` peuplé (était vide). | Filet de sécurité si un admin atterrit sur Profil par un autre chemin. |
| `frontend/livi/src/screens/transporter/TransporterDashboardScreen.tsx` | Lien vers `Availability` ajouté. | Écran dédié rendu atteignable. |
| `backend/livi/tests/navigation_interconnection.test.js` | **Nouveau**, 5 tests réels. | Empêche ces 3 correctifs de régresser silencieusement. |

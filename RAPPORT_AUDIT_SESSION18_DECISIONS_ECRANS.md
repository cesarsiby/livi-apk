# Session 18 — Décisions tranchées sur les 4 points laissés ouverts en Session 17

Demandé explicitement : trancher plutôt que laisser ouvert. Chaque
décision ci-dessous a été prise après lecture complète du fichier
concerné, pas devinée.

## A. Supprimé — `TwoFactorAuthScreen`, `VerifyEmailScreen`

**Investigation** : les deux écrans, une fois lus intégralement, se sont
révélés être des placeholders honnêtes — chaque bouton affiche
explicitement une alerte du type *"La vérification 2FA attend le contrat
backend dédié ; aucun succès fictif n'est déclenché"*. Confirmé
qu'aucun endpoint backend de 2FA ou de vérification email par code
n'existe nulle part (`email_verified` existe comme simple colonne de
données, sans flux de confirmation associé).

**Décision : supprimés** (fichiers + registrations dans
`RootNavigator.tsx`), pas conservés en l'état ni câblés. Trois raisons
convergentes :
1. Totalement inatteignables (confirmé par recherche complète, comme les
   15 autres candidats de la Session 17).
2. Aucun support backend, à aucun degré.
3. Contredisent directement l'objectif explicite du prompt maître pour
   LIVI : authentification simple téléphone + mot de passe, sans étape de
   vérification supplémentaire (sections 3–8, déjà mises en œuvre en
   Session 9). Les construire reviendrait à réintroduire une friction que
   l'audit a précisément pour objectif de retirer.

Différence avec `SupportCenterScreen` (Sessions 15–16, conservé) : ce
dernier est atteignable (lié depuis `AdminDashboard`) et sert un rôle
admin où "pas encore construit, affiché honnêtement" a du sens
opérationnel. Ici, ni l'un ni l'autre.

## B. Nettoyé — alias redondants `EscrowCenter`, `EscrowTransactions`, `EscrowDisputes`

Les trois pointaient vers des composants déjà atteignables sous un autre
nom (`Escrow`, `Transactions`, `Disputes` respectivement) — confirmé par
recherche complète avant suppression, pas supposé. Supprimés de
`BuyerNavigator.tsx` ; les noms canoniques restent inchangés.

Corollaire réel derrière `EscrowDisputes` : un acheteur pouvait créer un
litige et atterrissait directement sur son détail
(`navigation.replace('DisputeDetails', ...)`, confirmé dans
`CreateDisputeScreen.tsx`), mais n'avait ensuite **aucun moyen de revoir
la liste de tous ses litiges**. `EscrowCenterScreen.tsx` (qui n'avait
jusqu'ici strictement aucun élément interactif, malgré des appels API
réels) a reçu le lien manquant vers `Disputes`.

## C. Lié — `Deposit` (conservé tel quel, rendu atteignable)

`DepositScreen` est le même type de placeholder honnête que 2FA/Email
("Aucun dépôt fictif n'est créé côté mobile"). Différence décisive avec
2FA/Email : ce n'est pas une fonctionnalité d'authentification contraire
à un objectif du prompt maître, c'est une fonctionnalité de wallet
symétrique à `Withdraw` (déjà pleinement fonctionnel). Décision : lien
ajouté depuis `WalletScreen`, juste avant "Demander un retrait" — rend le
placeholder honnête découvrable, sans jamais prétendre que le dépôt
fonctionne réellement.

## D. Lié — `LiveShops` (fonctionnalité réelle, corrigée)

**Différence de nature avec tout le reste de cette session** :
`LiveShopsScreen` n'est pas un placeholder — il appelle une vraie API
(`liveApi.active()` → `GET /live/active`, confirmé existant dans
`compatibility.js`, interrogeant une vraie table `live_shops`), avec
chargement/erreur/vide gérés et navigation correcte vers le détail
(`LiveShop`). C'est exactement la même classe de bug que
VideoManager/CreatorTools/LiveDashboard (Session 14/17) :
fonctionnalité complète, backend réel, aucune porte d'entrée. Décision :
bannière ajoutée en tête du feed social (`FeedScreen`), lieu le plus
cohérent thématiquement pour découvrir du contenu "live".

## E. Vérifié réellement

- Nouveau fichier `tests/orphan_screen_decisions.test.js` (6 tests,
  approche par inspection de source) — **6/6 PASS réellement exécutés**
  au premier essai.
- Suite complète réexécutée : **199/210 PASS**, mêmes 5 échecs
  préexistants, aucune régression.
- Vérifié qu'aucun import ne devient orphelin après les suppressions
  (`EscrowCenterScreen`, `TransactionsScreen`, `DisputesScreen` toujours
  utilisés exactement 2 fois chacun dans `BuyerNavigator.tsx` : import +
  la registration canonique restante).
- `tsc --noEmit` toujours **BLOCKED** dans ce bac à sable — les 5
  fichiers `.tsx` modifiés vérifiés par relecture précise et par les
  tests d'inspection de source, pas par compilation réelle. Deux tokens
  de thème utilisés dans mes ajouts (`fontSize.md`, `radius.lg`) vérifiés
  existants dans `design/theme.ts` avant utilisation, pas supposés.

## F. NON exécuté

Rendu réel de la bannière Live Shopping, du lien Dépôt, et du lien
Litiges dans un environnement Expo réel — non vérifiable ici.

## G. Fichiers modifiés

| Fichier | Modification | Impact |
|---|---|---|
| `frontend/livi/src/screens/auth/TwoFactorAuthScreen.tsx` | **Supprimé.** | Retire un écran mort contraire à l'objectif d'auth simplifiée. |
| `frontend/livi/src/screens/auth/VerifyEmailScreen.tsx` | **Supprimé.** | Idem. |
| `frontend/livi/src/navigation/RootNavigator.tsx` | Retrait des 2 imports + registrations correspondantes. | Cohérence avec les suppressions ci-dessus. |
| `frontend/livi/src/navigation/BuyerNavigator.tsx` | Retrait de 3 alias redondants (EscrowCenter/EscrowTransactions/EscrowDisputes). | Nettoyage, noms canoniques inchangés. |
| `frontend/livi/src/screens/buyer/EscrowCenterScreen.tsx` | `navigation` accepté ; lien vers Disputes ajouté. | Ferme le vrai manque laissé par le retrait d'EscrowDisputes. |
| `frontend/livi/src/screens/wallet/WalletScreen.tsx` | Lien vers Deposit ajouté. | Placeholder honnête rendu découvrable. |
| `frontend/livi/src/screens/social/FeedScreen.tsx` | Bannière Live Shopping ajoutée. | Fonctionnalité réelle rendue découvrable. |
| `backend/livi/tests/orphan_screen_decisions.test.js` | **Nouveau**, 6 tests réels. | Empêche ces 4 décisions de régresser silencieusement. |

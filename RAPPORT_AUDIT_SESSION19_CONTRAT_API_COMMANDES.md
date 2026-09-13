# Session 19 — Contrat des réponses API : bug confirmé sur le total commande vendeur

Suite de la Session 18. Section 49 du prompt maître : recherche
systématique d'autres décalages de nom de champ comme celui déjà trouvé
sur les photos produit (Session 14).

## A. Méthode

Vérification fichier par fichier des clients API frontend
(`checkoutApi.ts`, `walletApi.ts`, `sellerApi.ts`) contre les réponses
backend réelles (lecture directe des `SELECT`, pas des suppositions).
`checkoutApi.ts` et `walletApi.ts` : contrat déjà correct, y compris du
code défensif bien pensé (`order?.total_amount ?? quote?.total_xof ??
subtotal`) et des commentaires `V47`/`V36` documentant des vérifications
déjà faites par des sessions antérieures contre les vraies routes.

## B. Bug confirmé — total de commande toujours affiché à 0 FCFA côté vendeur

`GET /vendor/orders/:id` fait `SELECT o.*` sur la table `orders`, dont la
colonne réelle est `total_amount` — il n'existe **aucune** colonne
`total` dans le schéma (vérifié directement dans
`migrations/001_initial.sql`, pas supposé). `SellerOrderDetailsScreen.tsx`
lisait `order.total` avec un simple repli `?? 0` — ce repli était donc
**systématiquement déclenché**, quel que soit le montant réel de la
commande. Un vendeur consultant le détail d'une commande voyait toujours
"0 FCFA", peu importe le montant réel.

**Même famille de bug** que le décalage `item.price`/`price_xof` déjà
corrigé lors d'une session antérieure (mentionné dans
`CHANGELOG_SESSION.md`, Session 8) — un nom de champ qui diverge entre ce
que la base contient réellement et ce que l'écran lit, sans qu'aucune
erreur ne se déclenche (juste un repli silencieux vers 0).

**Corrigé** : `order.total_amount ?? order.total ?? 0` (le vrai champ en
premier, l'ancien nom conservé en repli par prudence, `0` en dernier
recours).

## C. Deuxième problème trouvé en creusant le même endpoint — articles de commande absents

`GET /vendor/orders/:id` ne renvoyait jamais les lignes de commande
(`order_items`), contrairement à l'équivalent acheteur (`GET
/orders/:id`, qui les inclut déjà via une sous-requête). Conséquence
réelle : **un vendeur acceptant ou préparant une commande n'avait aucun
moyen de voir quels produits ou quantités préparer** — seulement le
statut et (avant le correctif B) un total à 0. Confirmé en lisant
l'écran en entier, pas supposé à partir du type déclaré.

**Corrigé** : la requête backend inclut désormais les articles
(jointure avec `products` pour le nom, pas seulement l'id) ; l'écran
affiche la liste "Articles à préparer" avec quantité et sous-total par
ligne.

## D. Vérifié réellement

- `node --check` PASS sur `routes/compatibility.js`.
- Nouveau fichier `tests/api_contract_seller_orders.test.js` (5 tests,
  approche par inspection de source) — **5/5 PASS**, dont un test qui
  vérifie directement dans le schéma SQL qu'aucune colonne `total` (bare)
  n'existe, pour que ce test échoue bruyamment si jamais quelqu'un en
  ajoutait une par erreur en pensant réparer autre chose.
- Suite complète réexécutée : **204/215 PASS**, mêmes 5 échecs
  préexistants, aucune régression.

## E. NON exécuté

Rendu réel de la liste d'articles dans un environnement Expo réel — non
vérifiable ici. Les autres clients API (`disputesApi.ts`, `ratingsApi.ts`,
`transporterApi.ts`, `socialApi.ts`, etc.) n'ont pas été vérifiés dans
cette session — signalé comme non exhaustif plutôt que déclaré complet.

## F. Fichiers modifiés

| Fichier | Modification | Impact |
|---|---|---|
| `backend/livi/src/routes/compatibility.js` | `GET /vendor/orders/:id` inclut désormais les articles de la commande. | Le vendeur peut enfin voir quoi préparer. |
| `frontend/livi/src/features/seller/sellerApi.ts` | Type `SellerOrder` corrigé (`total_amount`, `items` typés). | Contrat aligné sur la réalité du backend. |
| `frontend/livi/src/screens/seller/SellerOrderDetailsScreen.tsx` | Lecture de `total_amount` en priorité ; affichage des articles. | Total réel affiché ; articles visibles. |
| `backend/livi/tests/api_contract_seller_orders.test.js` | **Nouveau**, 5 tests réels. | Empêche ces deux régressions de revenir silencieusement. |

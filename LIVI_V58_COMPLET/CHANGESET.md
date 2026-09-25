# LIVI V59 — changeset consolidé

## Backend

- `migrations/045_v59_coherence.sql` : séparation de la garantie interville, base explicite de conservation, moyen de paiement lié à l’escrow.
- `src/services/preparation.js` : horloge de préparation commune à tous les succès de paiement.
- `src/services/logisticsTiming.js` : préparation, péremption, garantie 10 % sans minimum de garantie, coût de transport interville.
- `src/routes/delivery.js` : preuve de livraison distincte de la libération de l’escrow.
- `src/routes/compatibility.js` : confirmation acheteur authentifiée, protection contre le pickup urbain d’un colis interville, cycle partenaire interville et garantie.
- `src/routes/escrow.js` et `src/routes/webhooks.js` : moyen de paiement contrôlé et démarrage de préparation unifié.
- `src/services/orderCancellation.js` : restauration correcte du stock des variantes.
- `src/routes/orders.js` : rejet précoce des paniers multi-vendeurs.

## Frontend

- `BuyerQRValidationScreen.tsx` : le QR/PIN de remise est présenté une seule fois au transporteur/partenaire ; la confirmation acheteur est séparée.
- `SellerProductLogisticsScreen.tsx` : base de conservation explicite.
- `AdminIntercityScreen.tsx` : coût opérationnel distinct de la garantie.

## Règles V59

1. Préparation : 1/2/3/4/12/24 h.
2. Le transit démarre uniquement au pickup physique.
3. `delivered` et `completed` sont distincts.
4. Le QR/PIN de remise est à usage unique.
5. Garantie interville : 10 % de la valeur marchandise, sans minimum de garantie.
6. Transport interville facturé : carburant + minimum de livraison 1 000 XOF + charges configurées.
7. La garantie est séparée de l’escrow acheteur et suit son propre cycle.
8. Une perte interville ouvre une réclamation de garantie ; aucune écriture comptable de garantie n’est fabriquée dans l’escrow acheteur.
9. Les périssables utilisent une base explicite : récolte, production, conditionnement ou préparation.

# LIVI V59 — paquet de corrections et d’intégration

Ce paquet applique V57, V58 puis V59. Le point d’entrée recommandé est `apply_livi_v57_v59.py`, exécuté depuis la racine d’un checkout local de `livi-apk`.

## Corrections V59

- Préparation : 1 h, 2 h, 3 h, 4 h, 12 h ou 24 h ; « prêt » ne démarre pas le transit.
- Transit : démarre uniquement à la prise en charge physique du colis.
- Livraison : `delivered` est distinct de `completed`; l’escrow reste financé jusqu’à confirmation acheteur ou auto-libération existante.
- Preuves : le QR/PIN de remise est à usage unique ; la confirmation acheteur est une action authentifiée séparée.
- Panier multi-vendeurs : refusé dès le devis, car une commande reste liée à un seul vendeur.
- Stock : restauration distincte du stock produit et du stock de variante.
- Paiement : le moyen de paiement doit appartenir à l’acheteur et être vérifié.
- Interville : le transporteur urbain ne peut pas récupérer une expédition interville.
- Garantie interville : 10 % de la valeur marchandise, sans minimum de garantie, séparée du montant payé par l’acheteur.
- Transport interville facturé : carburant + minimum de livraison 1 000 XOF + charges configurées.
- Perte interville : la garantie suit un cycle séparé ; aucune écriture n’est injectée dans l’escrow acheteur pour fabriquer un remboursement.
- Périssables : base de conservation explicite (récolte, production, emballage, préparation).

## Exécution

```bash
python /chemin/du/paquet/apply_livi_v57_v59.py /chemin/du/checkout/livi-apk
```

Le patcher est volontairement strict : si une ancre de code attendue n’existe pas ou apparaît plusieurs fois, il s’arrête au lieu de modifier silencieusement une autre logique.

## Validation effectuée

La syntaxe des patchers Python et des modules JavaScript ajoutés est vérifiée. Les calculs de préparation, conservation et garantie sont testés en isolation. Le build Expo complet, les migrations PostgreSQL réelles, les tests d’appareil et la CI GitHub n’ont pas été exécutés ici.

## GitHub

L’intégration GitHub disponible dans cette session autorise la lecture du dépôt mais refuse les écritures avec HTTP 403 `Resource not accessible by integration`. Aucun commit/push V59 n’est donc déclaré.

## Intégrations externes

Le financement réel de la garantie et le règlement de la compagnie interville nécessitent un contrat API/webhook fournisseur authentifié. Les routes d’administration V59 enregistrent les confirmations de règlement ; elles ne simulent pas un paiement externe inexistant.

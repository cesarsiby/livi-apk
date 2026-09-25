# LIVI V59 — manifeste de correction

## Entrée d'application

`apply_livi_v57_v59.py` est le seul point d'entrée recommandé. Il applique V57, V58, la finalisation V58 puis V59 dans cet ordre, avec arrêt en cas d'ancre divergente.

## Corrections V59 vérifiables

- préparation vendeur : horloge déclenchée par le paiement, puis état « prêt » sans démarrage du transit ;
- pickup physique : seul événement déclenchant `shipping` et l'ETA de transit ;
- livraison : `delivered` sans libération immédiate de l'escrow ;
- confirmation acheteur : action authentifiée distincte de la preuve QR/PIN à usage unique ;
- interville : exclusion du dispatcher urbain et parcours partenaire dédié ;
- garantie partenaire : 10 % de la valeur marchandise, sans minimum de garantie, hors montant acheteur ;
- transport interville : carburant + minimum 1 000 XOF + charges configurées ;
- perte interville : réclamation de garantie indépendante de l'escrow acheteur ;
- périssables : base de départ explicite, avec traitement particulier lorsque la base est la préparation ;
- paniers multi-vendeurs : rejet dès le devis ;
- stock de variantes : restauration sur `product_variants.stock_qty` ;
- moyen de paiement : appartenance à l'acheteur et statut vérifié ;
- tous les succès de paiement : même démarrage de préparation.

## Validation

Validés ici : syntaxe Python des patchers, syntaxe JavaScript des modules ajoutés et tests isolés de calcul logistique. Non validés ici : exécution PostgreSQL réelle, installation des dépendances, typecheck/build Expo complet, tests appareil et pipeline CI complet.

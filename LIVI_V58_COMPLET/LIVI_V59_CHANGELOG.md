# LIVI V59 — corrections appliquées au paquet local

V59 corrige les incohérences métier, financières et de cycle de vie identifiées après l’audit V58.

## Corrections critiques

- La déclaration « prêt » du vendeur n’envoie plus artificiellement la commande en transport : elle reste `preparing` avec `prepared_at`.
- Le transit commence uniquement lors de la preuve de prise en charge physique.
- La preuve de livraison place la commande à `delivered` sans libérer l’escrow.
- La confirmation de réception acheteur ne réutilise plus le même QR/PIN déjà consommé par le transporteur.
- Le devis rejette les paniers multi-vendeurs dès le devis, en cohérence avec la règle backend « une commande = un vendeur ».
- Le stock de variante doit être restauré sur `product_variants.stock_qty` lors d’une annulation.
- Le moyen de paiement est désormais contrôlé par propriétaire/statut et associé à l’escrow.
- Les chemins de succès de paiement utilisent le même service de démarrage de préparation.

## Interville

- Le coût opérationnel du transport et la garantie de 10 % sont séparés.
- La garantie de 10 % appartient au partenaire et n’est pas ajoutée au montant payé par l’acheteur.
- Le minimum de garantie de 1000 FCFA ajouté dans V58 est supprimé : aucun minimum de garantie n’a été défini.
- Le calcul de la garantie est arrondi au FCFA entier supérieur.
- Le cycle de garantie est tracé indépendamment de l’escrow acheteur.
- Le flux de perte ne poste plus l’ancienne écriture comptable déséquilibrée liée à la garantie.
- Les étapes interville dépendent d’une confirmation externe réelle du financement de la garantie ; aucune intégration partenaire inexistante n’est prétendue comme opérationnelle.

## Agriculture / périssables

- Ajout d’un type explicite de référence de durée de conservation : récolte, production, emballage ou préparation.
- Le calcul de péremption tient compte de ce point de départ au lieu de soustraire systématiquement la préparation lorsqu’elle constitue elle-même le début de la durée de conservation.
- Les métadonnées incomplètes ne doivent pas être traitées comme valides simplement pour rester visibles.

## Limite d’exécution

Ce paquet est préparé localement. L’intégration GitHub de cette session refuse les écritures avec HTTP 403 « Resource not accessible by integration ». Aucun commit/push n’est donc déclaré ici.

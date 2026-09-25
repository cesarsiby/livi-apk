# LIVI — fichiers de correction manuelle V60

Ces fichiers corrigent les trois incohérences critiques suivantes :

1. Le bouton vendeur « prêt » ne fait plus passer la commande à `shipping`.
   `shipping` commence à l'enlèvement physique du colis.
2. La validation de livraison par le transporteur passe à `delivered` sans libérer immédiatement l'escrow.
   La confirmation acheteur reste une action séparée.
3. L'annulation restaure le stock au bon niveau lorsqu'une ligne utilise `product_variant_id`.
4. L'écran acheteur n'affiche plus et ne réutilise plus le QR/PIN de preuve de remise.

## Fichiers à remplacer

- `backend/livi/src/routes/delivery.js`
- `backend/livi/src/services/orderCancellation.js`
- `frontend/livi/src/screens/buyer/BuyerQRValidationScreen.tsx`

## Modification supplémentaire obligatoire dans `compatibility.js`

Le paquet contient aussi `tools/patch_compatibility_v60.py`.
Ce script effectue uniquement deux remplacements ciblés dans le fichier existant :

- `/vendor/orders/:id/ready` : conserve `preparing` et crée/propose la mission sans passer en `shipping`.
- `/orders/:id/confirm-receipt` : exige un shipment `delivered` et ne consomme plus le `buyer_delivery` proof.

À exécuter depuis la racine du dépôt :

    python3 tools/patch_compatibility_v60.py backend/livi/src/routes/compatibility.js

Le script refuse de modifier le fichier s'il ne retrouve pas exactement les blocs attendus.

## Vérification

    node --check backend/livi/src/routes/delivery.js
    node --check backend/livi/src/services/orderCancellation.js
    git diff --check

Puis, côté backend :

    cd backend/livi
    npm test

Ne supprimez aucune migration existante. Les migrations V57–V59 restent nécessaires.

# LIVI V59 — AUDIT DES INCOHÉRENCES, AMBIGUÏTÉS ET TROUS LOGIQUES

Référence auditée : dépôt `cesarsiby/livi-apk`, branche `main`, commit `a38b77cd13eb099db5d53ad7fef8470b17d3b3fd`, plus les préparations locales V57/V58.

## 1. Conclusion générale

Le modèle LIVI est globalement structuré, mais quatre concepts sont actuellement mélangés alors qu’ils doivent être strictement séparés :

1. la préparation du vendeur ;
2. la prise en charge physique du colis ;
3. le transit jusqu’au destinataire ou au point partenaire ;
4. la garantie interville apportée par le partenaire logistique.

Le code V57/V58 couvre une grande partie du vocabulaire nécessaire, mais plusieurs champs et transitions ne portent pas encore exactement le sens métier annoncé.

La règle de référence à retenir est :

**Commande payée → préparation minimale annoncée → produit prêt → attente de prise en charge → prise en charge physique → transit → arrivée → remise au destinataire → délai de contestation → libération définitive des fonds.**

Le mot « shipping/en livraison » ne doit pas apparaître avant la prise en charge physique.

---

## 2. Problèmes critiques à corriger avant intégration définitive

### C01 — Le code confond « prêt » et « en livraison »

Dans le flux vendeur actuel, `POST /vendor/orders/:id/ready` fait passer la commande à `shipping` au moment où le vendeur annonce qu’elle est prête.

C’est contraire au modèle métier demandé : le délai de transport doit commencer **à la récupération physique**.

Conséquence : l’acheteur peut croire que le colis est déjà en transit alors que le transporteur ou le partenaire ne l’a pas encore récupéré.

Correction : conserver l’état commande `preparing` avec `prepared_at` renseigné, ou introduire explicitement un état `ready_for_pickup`. Le passage à `shipping` doit être effectué uniquement sur la preuve de prise en charge réelle.

### C02 — La fenêtre de litige de 10 minutes est actuellement court-circuitée

Le code actuel de `verifyDeliveryProof()` marque la livraison, libère l’escrow puis passe la commande à `completed` dans le même flux.

Or le module de litiges autorise le litige post-livraison sur `delivered` et applique une fenêtre de 10 minutes basée sur `delivered_at`.

Une commande qui passe immédiatement à `completed` ne peut donc plus ouvrir ce litige.

Correction cible :

`delivered` = remise prouvée, escrow encore bloqué ;

`completed` = confirmation acheteur ou auto-release sans litige après le délai prévu.

Le scheduler d’auto-release de 72 h peut rester la sécurité longue durée, mais il ne doit pas rendre inutile la fenêtre courte de contestation.

### C03 — Le même code de livraison est conceptuellement utilisé deux fois

Le système crée un `buyer_delivery` proof puis le transporteur le consomme pour déclarer la livraison.

L’écran acheteur présente ensuite ce même code et demande à l’acheteur de l’utiliser pour confirmer la réception.

Un proof est justement prévu comme consommable unique. Le flux mélange donc :

- preuve de remise du colis au transporteur ;
- preuve de livraison au destinataire ;
- confirmation utilisateur finale.

Correction cible : la preuve `buyer_delivery` est consommée lors de la remise réelle par le transporteur/partenaire. Le bouton « Confirmer réception » de l’acheteur doit être une action authentifiée distincte, sans réutiliser la même preuve, ou utiliser une seconde preuve explicitement dédiée à l’accusé de réception.

### C04 — La garantie interville de 10 % n’a pas encore une sémantique comptable correcte

La préparation V58 traite actuellement la garantie comme une composante du `shipping_fee` payé dans l’escrow de l’acheteur.

Le besoin métier exprimé distingue pourtant :

- le prix opérationnel du transport ;
- la garantie de sécurité de 10 % supportée par la compagnie de transport.

La modélisation correcte doit donc distinguer les deux.

Interprétation sécurisée à retenir tant qu’aucune autre règle contractuelle n’est écrite : **la compagnie partenaire apporte la garantie de 10 % à titre de sûreté ; elle n’est pas automatiquement ajoutée au frais de transport payé par l’acheteur.**

Cette distinction est indispensable pour savoir qui doit avancer les fonds et qui les récupère ensuite.

### C05 — La garantie possède actuellement un minimum de 1 000 XOF alors que ce minimum n’a pas été défini pour elle

La règle V58 définit `guarantee_bps = 1000` mais aussi `minimum_guarantee_xof = 1000`.

La règle utilisateur précise un minimum de 1 000 XOF pour le **transport**, pas explicitement pour la garantie.

Exemple : marchandise à 500 XOF → le code calcule actuellement 1 000 XOF de garantie, soit 200 % de la valeur.

Cela ne correspond pas à « 10 % de la valeur ».

Correction : garantie = 10 % de la valeur du colis, avec une règle d’arrondi explicitement définie ; ne pas ajouter de plancher 1 000 XOF sans décision métier séparée.

### C06 — En cas de perte, une écriture comptable V58 est déséquilibrée

Le flux local `mark-lost` tente une écriture avec :

- clearing : `-garantie` ;
- client : `+garantie` ;
- shipping : `+garantie`.

La somme n’est pas nulle.

`postBalanced()` rejettera donc cette écriture avec `LEDGER_UNBALANCED`.

Il faut supprimer la troisième ligne et surtout définir correctement l’origine de la garantie : si elle est financée par le partenaire, son obligation doit être suivie dans un compte/registre partenaire distinct.

### C07 — La garantie n’a pas de cycle complet « tenue → restitution au partenaire / indemnisation acheteur »

Une garantie partenaire ne doit pas seulement exister au moment d’une perte.

Il manque le cycle normal :

`partner_funded → held → released_to_partner` si le colis est livré ;

ou

`partner_funded → held → paid_to_buyer` en cas de perte reconnue.

Sans ce cycle, le système sait potentiellement « rembourser » une garantie mais ne sait pas correctement la restituer à la compagnie après une livraison normale.

### C08 — La garantie ne doit pas être déduite du remboursement transport de l’acheteur

Dans V58, `shipping_fee` sert à la fois à représenter le transport et indirectement la garantie, puis les remboursements tentent de retrancher la garantie déjà reversée.

Cela devient inutilement complexe et masque la véritable provenance de la garantie.

Correction cible :

- `customer_transport_charge_xof` = frais opérationnels payés par l’acheteur ;
- `partner_guarantee_xof` = sûreté de la compagnie ;
- `partner_guarantee_status` = held/released/paid_to_buyer ;
- `partner_guarantee_funding_reference` = référence externe ou interne ;
- la garantie ne participe pas à `order.total_amount` de l’acheteur si elle est réellement financée par le partenaire.

---

## 3. Périssables et agriculture : trous métier importants

### A01 — Un produit agricole ne devrait pas porter une seule date d’expiration pour tout son stock

Le stock actuel est au niveau `products.stock`, alors que la conservation est au niveau produit.

Un vendeur peut pourtant avoir :

- lot récolté lundi ;
- lot récolté mercredi ;
- deux dates d’expiration différentes.

Avec un simple `shelf_life_reference_at` sur le produit, LIVI ne sait pas quel lot est réellement expédié.

Correction cible : créer des **lots/batches de stock** avec au minimum : lot, quantité disponible, date/heure de référence, durée de conservation, expiration calculée, et état.

Pour les périssables, la sortie de stock devrait privilégier le lot qui expire le plus tôt lorsque cela correspond à la politique de stock : principe FEFO.

### A02 — La base de la durée de conservation n’est pas suffisamment définie

V58 utilise `shelf_life_reference_at` mais recueille aussi `production_date` et `harvest_date`.

Ce sont trois concepts distincts.

Exemples :

- produit agricole brut : référence = récolte ;
- produit fabriqué : référence = production ;
- produit conditionné : référence = conditionnement ;
- plat fabriqué à la commande : référence = préparation.

Il faut donc un champ explicite du type `shelf_life_reference_type` plutôt que de laisser une date libre décider silencieusement du sens.

### A03 — Pour un produit préparé à la commande, la durée de conservation peut commencer après la préparation

Le calcul actuel additionne systématiquement la préparation et le transit à une durée de conservation déjà commencée.

Ce n’est pas toujours logique.

Si la conservation commence après préparation, il faut calculer :

`durée disponible après préparation >= attente réelle + transit`.

Si elle commence à la récolte/production, il faut au contraire tenir compte de toute la durée écoulée avant la prise en charge.

### A04 — La revalidation des périssables au paiement manque

Un produit peut être ajouté au panier, la commande créée, puis le paiement confirmé plus tard.

La durée restante peut avoir changé pendant cet intervalle.

La compatibilité doit donc être revérifiée à la confirmation financière, pas seulement au quote/create.

### A05 — La revalidation manque également pendant l’attente de prise en charge

Le calcul actuel « préparation + transit max » n’intègre pas le temps réel d’attente entre la commande, la préparation et la récupération.

Cela est particulièrement critique pour :

- une offre transporteur expirée ;
- plusieurs réassignations ;
- une attente au dépôt partenaire ;
- une immobilisation exceptionnelle du colis.

La règle cible doit intégrer le temps d’attente effectif et prévoir un recontrôle à chaque étape physique.

### A06 — Les produits périssables incomplets peuvent encore apparaître dans le catalogue

La condition V58 de visibilité autorise le cas : « périssable avec référence absente ».

Le produit peut alors être visible puis être rejeté plus tard au quote.

Correction : un produit périssable actif doit être visible et commandable uniquement si ses métadonnées de conservation obligatoires sont complètes.

### A07 — Les dates agricoles devraient être contrôlées

`harvest_date` et `production_date` sont des `date`, tandis que `shelf_life_reference_at` est un timestamp.

Il faut empêcher les dates futures incohérentes et définir une relation métier claire entre elles.

### A08 — L’unité de stock reste entière

V58 ajoute `unit` sous forme de texte, mais `stock` et les paliers de quantité restent entiers.

Pour l’agriculture, cela peut bloquer des quantités telles que :

- 0,5 kg ;
- 1,5 litre ;
- 2,25 kg.

Il faut soit une quantité décimale structurée, soit une unité minimale explicite avec une précision de quantité.

### A09 — Les conditions de conservation sont uniquement du texte libre

`storage_conditions` est utile mais insuffisant pour une future logique automatisée.

Le modèle peut évoluer vers des caractéristiques structurées : mode de conservation, besoin de chaîne du froid, plage de température si nécessaire, emballage, contraintes de transport.

Aucune valeur scientifique ne doit être inventée dans le code : ces paramètres doivent être renseignés/configurés selon les règles métier réelles de LIVI.

### A10 — Les phénomènes de qualité/lot ne sont pas modélisés

Pour les denrées agricoles et produits périssables, le produit devrait pouvoir rattacher une commande au lot effectivement expédié. Cela permet la traçabilité, les litiges qualité et les rappels éventuels.

---

## 4. Préparation vendeur : incohérences de vocabulaire

### B01 — « Minimum » ne veut pas dire « au plus tard »

Le besoin métier parle de délai **minimal** : 1 h, 2 h, 3 h, 4 h, 12 h ou 24 h.

Certaines interfaces V58 affichent cependant « Prête au plus tard » ou « Échéance ».

C’est faux sémantiquement.

Il faut afficher :

- « Préparation minimale : 4 h » ;
- « Le vendeur pourra déclarer le produit prêt à partir de 4 h après la confirmation du paiement ».

### B02 — Le point de départ du chronomètre doit être explicite

La solution actuelle fait démarrer le temps lors de la confirmation financière du paiement.

C’est le choix opérationnel le plus cohérent pour éviter de faire travailler un vendeur sur une commande impayée, mais l’interface doit le dire clairement.

La phrase acheteur cible est donc :

**« Préparation minimale : 4 h après confirmation du paiement. »**

### B03 — Plusieurs produits d’un même vendeur

Le calcul actuel utilise le maximum des temps de préparation.

C’est cohérent seulement si LIVI suppose que le vendeur peut préparer les produits en parallèle.

Il faut documenter cette règle ; sinon un vendeur qui prépare séquentiellement les articles aura une promesse incorrecte.

### B04 — Une préparation peut devenir en retard sans seuil supérieur

Un délai minimal ne fournit pas de date limite maximale.

Si le vendeur dépasse 4 h, LIVI doit pouvoir signaler :

`preparation_overdue_at = preparation_ready_at`.

LIVI ne doit pas inventer une durée maximale ; elle peut toutefois surveiller le dépassement du minimum annoncé et l’exposer comme SLA en retard.

---

## 5. Transport urbain

### U01 — Les frais urbains ont des valeurs semées non validées

La migration 038 insère :

- base 500 XOF ;
- 150 XOF/km ;
- plafond 5 000 XOF.

Le commentaire du code reconnaît lui-même que ces valeurs doivent être validées.

Elles ne doivent donc pas être traitées comme une vérité métier définitive.

Correction : règle admin obligatoire avant utilisation ou valeurs issues d’une politique de tarification réellement validée.

### U02 — Le délai urbain est configuré mais non initialisé

V58 ne préremplit pas de règles de transit urbain.

C’est cohérent avec l’interdiction d’inventer des délais, mais il faut alors empêcher le déploiement en production sans configuration explicite ou fournir une procédure d’initialisation administrative clairement obligatoire.

### U03 — Les règles de distance peuvent se chevaucher

Une règle 0–5 km et une autre 3–10 km peuvent toutes deux correspondre à une distance.

Le moteur prend une règle selon un ordre technique, ce qui cache un conflit de configuration.

L’administration doit soit empêcher les chevauchements, soit afficher explicitement les conflits.

---

## 6. Interville : architecture à clarifier

### I01 — Le partenaire n’a pas encore de véritable surface opérationnelle

Le modèle s’appuie sur `partners` comme registre externe et fournit des actions admin pour :

- créer un partenaire ;
- créer des points ;
- créer des routes ;
- enregistrer une prise en charge ;
- enregistrer une arrivée ;
- déclarer une perte.

Cela signifie que, pour l’instant, l’exploitation interville est essentiellement **admin-opérée**.

Ce n’est pas une intégration partenaire complète.

Pour une intégration réelle, il faudra un adaptateur API/webhook partenaire authentifié, avec idempotence, références externes et accusés de réception.

### I02 — La preuve de prise en charge partenaire arrive trop tard

Le handler V58 `partner-pickup` crée les preuves au moment de la prise en charge, alors qu’une preuve servant à sécuriser cette prise en charge doit exister avant l’acte de remise.

Il faut créer la preuve attendue avant le pickup et la consommer lors du handoff réel.

### I03 — Le début du transit interville doit être le pickup réel

C’est la règle de chronométrage centrale.

L’ETA interville doit être calculée à partir de `partner_picked_up_at`, pas à partir du moment où l’admin sélectionne le partenaire ou crée l’expédition.

### I04 — Les routes gardent plusieurs vérités tarifaires

`fee_xof` coexiste avec :

- `fuel_cost_xof` ;
- `operating_charges_xof` ;
- `partner_service_fee_xof`.

Le code V58 choisit parfois la somme des composants, parfois `fee_xof`.

Cela ouvre la porte à une liaison où deux montants différents représentent officiellement le même transport.

Correction : une seule source de vérité. Exemple :

`transport_cost = max(1000, fuel + operating_charges + partner_service_fee)`.

`fee_xof` peut être supprimé ou devenir uniquement un champ calculé historique.

### I05 — Le minimum de 1 000 XOF appartient au coût opérationnel

Il faut conserver cette règle séparée de la garantie de 10 %.

### I06 — Les lieux de départ/arrivée peuvent être arbitraires

Une route est définie par deux villes mais pas forcément par deux points physiques précis.

Si une compagnie possède plusieurs dépôts dans une même ville, le code prend le premier qui convient.

Une route interville devrait idéalement référencer explicitement son point de départ et son point d’arrivée, ou permettre une sélection déterministe.

### I07 — Les horaires de départ des compagnies ne sont pas représentés

Un transit « 12–24 h » n’est pas suffisant si la compagnie a des départs quotidiens à heures fixes.

Ce n’est pas indispensable pour la première version, mais il ne faut pas présenter une ETA continue comme exacte si le transport dépend d’un calendrier.

### I08 — L’interville actuel est dépôt/retrait, pas livraison porte-à-porte

Le modèle V58 sélectionne un `partner_location` de retrait.

Il ne réalise pas encore la dernière livraison au domicile régional.

La documentation doit donc dire explicitement :

**Interville = acheminement vers un point partenaire de retrait**, sauf si un second transport local est effectivement ajouté.

---

## 7. Panier, produits, prix

### P01 — Le quote peut être incohérent avec la création de commande pour plusieurs vendeurs

Le backend impose une commande pour un seul vendeur.

Le panier mobile, lui, accepte actuellement des produits de vendeurs différents.

Le quote peut être calculé selon le premier vendeur, puis la création de commande échouer parce que le panier mélange plusieurs vendeurs.

Correction nécessaire :

- soit le panier interdit plusieurs vendeurs ;
- soit le checkout scinde automatiquement en plusieurs commandes.

C’est une décision d’architecture majeure à figer.

### P02 — Les paliers de quantité sont au niveau produit, mais les variantes ont leurs propres prix

Un produit peut avoir :

- variante rouge = 10 000 XOF ;
- variante bleue = 12 000 XOF ;
- palier produit >=10 = 9 000 XOF.

Le moteur V57 peut appliquer 9 000 XOF à une variante sans concept de palier de variante.

Correction : les paliers doivent être liés soit à la variante, soit explicitement au produit sans prix variant. La règle doit être unique.

### P03 — Le panier n’affiche pas nécessairement le prix de palier réellement utilisé

Le serveur calcule le prix correct, mais le panier conserve son propre subtotal local.

Le client peut donc voir un montant différent jusqu’au checkout.

Le principe cible : le panier peut estimer localement, mais le quote serveur doit être affiché comme montant final de référence et les paliers doivent être visibles.

### P04 — Les paliers n’imposent pas forcément une logique de prix décroissant

Si LIVI définit les paliers comme « prix de volume », il est logique qu’un palier supérieur ne puisse pas augmenter le prix unitaire sans raison.

Il faut soit imposer une monotonie décroissante, soit expliciter qu’un vendeur peut librement définir des prix par tranche.

### P05 — Création active d’un produit et minimum de 3 photos

La mise à jour active vérifie le minimum de photos, mais la création initiale doit appliquer exactement la même règle.

Sinon un vendeur peut potentiellement créer directement un produit `active` avec zéro photo.

### P06 — Catégories V57 et catégories existantes ne sont pas canoniques

Le dépôt contient déjà 10 catégories dans la migration 041 ; V57 propose un nouvel ensemble de 16 catégories.

Les slugs étant différents, les deux ensembles peuvent coexister.

On obtient alors par exemple des concepts proches comme :

- Vêtements & Mode ;
- Mode & Vêtements.

Correction : choisir une taxonomie canonique et faire une migration de rapprochement au lieu d’empiler les catégories.

### P07 — La catégorie principale historique et les catégories multiples doivent rester cohérentes

`products.category_id` existe encore pour compatibilité et `product_categories` pour le multi-classement.

Il faut définir explicitement :

- une catégorie principale obligatoire ;
- zéro ou plusieurs catégories secondaires ;
- la colonne historique pointe toujours vers la principale.

---

## 8. Stock et variantes

### S01 — La restauration de stock des commandes annulées ne traite pas correctement les variantes

Le stock des variantes vit dans `product_variants.stock_qty`, tandis que `restoreStockOnce()` restaure `products.stock` à partir de `order_items.quantity`.

Pour une commande d’une variante, cela peut augmenter le stock produit général alors que le stock de la variante reste diminué.

C’est une incohérence d’inventaire réelle.

Correction : restaurer sur `product_variants.stock_qty` lorsque `product_variant_id` est renseigné ; sinon sur `products.stock`.

### S02 — Le modèle de stock agricole doit passer au lot

Voir A01 : produit → stock global n’est pas suffisant pour plusieurs récoltes/productions simultanées.

---

## 9. Paiement et escrow

### F01 — `payment_method_id` est demandé par le frontend mais ignoré lors de la création de commande

Le checkout transmet un `paymentMethodId`, mais `checkoutApi.createOrder()` ne l’envoie pas réellement dans le body.

Le paiement est ensuite initialisé séparément.

Ce n’est pas forcément dangereux, mais la signature API donne l’impression que la commande est liée au moyen de paiement alors que ce n’est pas le cas.

Il faut soit retirer le paramètre de `createOrder`, soit le persister/valider réellement.

### F02 — Le backend ne valide pas le moyen de paiement dans `payment/init`

Le `payment_method_id` envoyé au backend n’est pas utilisé par `routes/escrow.js`.

La méthode peut donc être totalement déconnectée du paiement réellement initié.

Pour une intégration financière réelle, le serveur doit vérifier : propriétaire, statut, opérateur/provider compatible et état.

### F03 — Il n’existe pas encore de véritable paiement externe pour l’interville

Le système possède un registre `partner_instructions` et un chemin webhook, mais sans fournisseur réel configuré il ne faut pas le présenter comme un paiement interville finalisé de bout en bout.

### F04 — Les commandes impayées peuvent retenir du stock trop longtemps

Le stock est réservé dès la création de commande.

Aucun mécanisme clairement visible dans le dépôt actuel ne purge automatiquement les commandes `pending_payment` abandonnées avant démarrage du paiement.

Il faut une durée de réservation administrable et un job de restitution du stock, sans inventer une valeur fixe dans le code.

---

## 10. Rôles et identité

### R01 — Le projet possède à la fois `users.role` et `user_roles`

Le modèle multi-rôle existe, mais le `RootNavigator` choisit encore le profil uniquement via `session.user.role`.

Une personne ayant plusieurs rôles enregistrés n’a pas encore un vrai sélecteur de profil côté application.

Ce n’est pas un problème de base de données uniquement : c’est un problème de navigation et de modèle mental.

### R02 — Ajouter un rôle ne change pas automatiquement le rôle courant

`POST /users/me/roles` ajoute une appartenance mais ne définit pas de stratégie pour choisir le rôle actif.

Il faut distinguer :

- rôles détenus ;
- rôle courant/sessionnel.

---

## 11. Sécurité et exploitation

### SEC01 — Le logout ne révoque pas immédiatement le jeton d’accès

Le logout révoque le refresh token mais ne modifie pas `auth_version`.

Un access token déjà émis peut donc rester utilisable jusqu’à son expiration.

Ce n’est pas toujours anormal, mais il faut décider si LIVI veut un logout immédiat côté sécurité et, si oui, incrémenter une version de session ou mettre en place une révocation d’accès.

### SEC02 — Le compteur d’échecs de connexion n’est pas atomique

Le login lit d’abord le compteur puis l’incrémente par une requête séparée.

Sous des tentatives réellement concurrentes, deux requêtes peuvent lire la même valeur et perdre un incrément.

La protection globale `rate-limit` réduit le risque mais ne remplace pas un mécanisme atomique si le compteur par utilisateur doit être fiable.

### SEC03 — Stockage local des fichiers KYC

Le dépôt documente lui-même que le stockage local n’est pas durable sans disque persistant approprié.

Pour une production Render, ce point doit être résolu avant de considérer le KYC comme pleinement opérationnel.

### SEC04 — Les écrans admin utilisent des retours très larges

Plusieurs endpoints admin retournent des colonnes presque complètes (`SELECT *`).

Pour l’administration, il est préférable d’exposer seulement les champs nécessaires à chaque écran afin de réduire la surface PII et les risques de fuite accidentelle côté mobile.

---

## 12. Notifications et UX

### UX01 — Les types backend ne correspondent pas exactement aux icônes frontend

Le backend utilise des types tels que `payment_succeeded`, `mission_offer`, `escrow_auto_released`, etc.

L’UI `NotificationsScreen` reconnaît surtout des valeurs génériques exactes telles que `ORDER`, `PAYMENT`, `ESCROW`, `DELIVERY`.

Une notification réelle peut donc tomber dans l’icône générique alors qu’une catégorie plus précise serait attendue.

### UX02 — Le suivi interville a besoin de ses propres états lisibles

Le suivi ne doit pas présenter un déplacement local classique quand le colis est réellement :

`prêt → remis au partenaire → en transit interville → arrivé au dépôt → disponible au retrait → retiré`.

### UX03 — La promesse acheteur doit réunir les trois horloges

L’acheteur doit voir séparément :

- préparation minimale ;
- attente jusqu’à la prise en charge ;
- transit ;
- ETA globale calculée à partir des timestamps réels.

---

## 13. CI : problème réel du dépôt actuel

La dernière exécution GitHub Actions disponible pour le commit `a38b77cd13eb099db5d53ad7fef8470b17d3b3fd` échoue pendant `actions/setup-node` parce que l’étape utilise `cache: npm` mais aucun `package-lock.json`, `npm-shrinkwrap.json` ou `yarn.lock` n’est présent dans le dépôt.

Les tests suivants sont donc ignorés.

Cela donne une fausse impression de « tests verts/non exécutés » : le pipeline échoue avant la vérification de syntaxe et la suite de tests.

Correction recommandée : ajouter et maintenir un lockfile approprié, puis faire dépendre le cache de ce lockfile.

---

## 14. Architecture de référence recommandée

### Commande urbaine

`commande créée` → `paiement confirmé` → `preparing` → `prepared_at atteint` → `ready for pickup` → `transporteur assigné` → `pickup prouvé` → `shipping` → `arrived` → `delivered` → `fenêtre de contestation` → `completed`.

### Commande interville

`commande créée` → `paiement confirmé` → `preparing` → `préparée` → `partenaire assigné` → `garantie partenaire financée` → `pickup partenaire prouvé` → `transit interville` → `arrivée dépôt` → `retrait acheteur prouvé` → `fenêtre de contestation` → `completed`.

### Garantie interville

`partner_funded` → `held` → soit `released_to_partner` si livraison réussie, soit `paid_to_buyer` si perte reconnue.

### Périssable

Le moteur doit calculer l’expiration à partir du lot et du type de référence de conservation, puis revalider la compatibilité :

- au panier/quote ;
- à la confirmation du paiement ;
- avant prise en charge ;
- à la remise au partenaire ;
- et avant remise finale si le retard a rendu le produit incompatible.

---

## 15. Priorité de correction V59

**P0 — bloquant métier/finance**

C01, C02, C03, C04, C05, C06, C07, C08, A01, A03, A04, A05, P01, S01.

**P1 — fortement recommandé avant production**

A02, A06, A08, B01, B02, B03, I01, I02, I03, I04, I06, F02, F04, R01, SEC03, CI.

**P2 — consolidation/qualité UX et évolutivité**

A07, A09, A10, U03, I07, I08, P03, P04, P05, P06, P07, R02, SEC01, SEC02, SEC04, UX01, UX02, UX03.

---

## 16. Règle métier V59 à figer

La formulation de référence à mettre dans le code, le backend, le frontend et les documents est :

> **Le vendeur annonce un délai minimal de préparation de 1 h, 2 h, 3 h, 4 h, 12 h ou 24 h. Le délai commence à la confirmation du paiement. Pendant cette période, le vendeur prépare la marchandise. Le délai de livraison ne commence qu’au moment de la prise en charge physique du colis. Pour l’interville, le partenaire logistique fournit une garantie de sécurité égale à 10 % de la valeur de la marchandise ; cette garantie est comptablement séparée du prix opérationnel du transport. Le coût opérationnel du transport est calculé selon les coûts réels configurés (carburant, charges, service partenaire) avec un minimum de 1 000 XOF. La garantie est restituée au partenaire après livraison ou versée à l’acheteur lorsqu’une perte reconnue ouvre droit à indemnisation.**

Cette séparation doit devenir la source de vérité de la prochaine correction du code.

## 17. Seconde passe — incohérences supplémentaires trouvées

### C09 — Le chemin de paiement de développement ne déclenche pas nécessairement la même horloge de préparation

Le webhook de paiement et le raccourci de confirmation financière de développement ne doivent pas posséder deux implémentations différentes du passage `payment_pending -> paid` + démarrage de préparation. Le démarrage du SLA de préparation doit être attaché à un service unique appelé par tout événement financier validé.

Sinon, le comportement peut différer entre staging et production alors que les deux représentent le même événement métier : paiement confirmé.

### C10 — `pending_payment` réserve du stock mais n’a pas de politique d’expiration complète

Le stock est décrémenté lors de la création de la commande, avant le paiement final. Le système doit distinguer explicitement : stock réservé, paiement en attente, commande abandonnée, restitution du stock.

Une commande abandonnée ne doit pas immobiliser indéfiniment le stock, surtout pour les produits agricoles et les produits à stock limité.

### C11 — Le délai de préparation est associé au produit mais pas encore au lot réel

Pour un produit standard, un SLA de préparation au niveau produit est cohérent.

Pour un produit agricole préparé depuis plusieurs lots, la préparation peut cependant dépendre du lot choisi. Le modèle final doit conserver : SLA commercial du produit + données physiques du lot.

### C12 — La logique de prix par quantité doit être compatible avec les variantes

V57 ajoute des paliers au niveau `product_id`, tandis que les variantes disposent de leur propre prix.

Pour un produit « T-shirt », par exemple, un prix de volume global peut entrer en conflit avec un prix de variante « XXL ».

La source de vérité doit être explicite : soit palier par variante, soit palier produit uniquement si aucune variante n'est sélectionnée, soit politique de priorité documentée.

### P08 — Arrondi de commission non spécifié et potentiellement divergent

La commission est actuellement calculée par unité puis multipliée par la quantité.

Mathématiquement, ceci peut différer d'une commission calculée sur le montant total de ligne.

Exemple théorique à 3 % : une unité à 333 XOF produit 9 XOF après division entière, alors que 10 unités donnent 3 330 XOF et une commission globale de 99 XOF. La méthode par unité donne 90 XOF.

Le choix doit être explicite et testé. Pour une logique financière, la méthode ligne par ligne est généralement plus lisible que la méthode unité par unité lorsqu'il n'existe pas de règle commerciale imposant l'inverse.

### P09 — L'affichage catalogue et le prix final peuvent dériver après un changement de commission

Le catalogue calcule `display_price_xof` avec la commission active au moment de l'affichage, alors qu'une commande utilise un snapshot de commission au moment de sa création.

Le quote serveur reste la source de vérité, mais l'utilisateur peut voir un prix catalogue différent du prix d'une commande créée juste après un changement administratif de taux.

Il faut indiquer la nature de la valeur affichée et laisser le quote serveur trancher le montant transactionnel.

### I09 — L'intégration d'une compagnie interville n'est pas encore une intégration partenaire de bout en bout

Le registre `partners` et les opérations administratives existent, mais le dépôt actuel ne contient pas encore un contrat de transporteur externe complet : authentification partenaire, signature de requêtes, accusé de réception, confirmation pickup, confirmation arrivée, déclaration de perte et confirmation financière de garantie.

Il faut donc distinguer dans la documentation « gestion interne d'un partenaire » et « intégration API de partenaire ».

### I10 — Le départ interville n'est pas modélisé avec un calendrier de départ

Un délai de 12 heures ne signifie pas forcément une livraison dans 12 heures si la compagnie ne part qu'à des horaires fixes.

Le modèle actuel route + min/max de transit ne couvre pas encore les jours/heures de départ, jours fériés, fréquence ou prochaine rotation.

L'ETA interville doit pouvoir intégrer le prochain départ réel lorsque le partenaire fonctionne en rotation.

### I11 — La route interville mélange trois niveaux de donnée

Le modèle possède simultanément : ville d'origine, ville de destination et points physiques partenaires.

Le niveau transactionnel final doit pointer vers les points physiques réellement sélectionnés ; les villes servent alors de contexte de recherche, pas de source unique de vérité.

### I12 — Le coût de transport interville doit rester explicable

Le modèle `fuel_cost_xof + operating_charges_xof + partner_service_fee_xof` est plus traçable qu'un seul `fee_xof`.

Le champ historique `fee_xof` doit donc devenir soit un total calculé, soit un champ de compatibilité clairement secondaire. Deux totaux concurrents ne doivent jamais pouvoir diverger.

### D04 — Le moment de livraison doit être différent du moment de libération des fonds

`delivered_at`, `delivery_confirmed_at` et `completed_at` ont des significations différentes.

`delivered_at` = remise physique prouvée.

`delivery_confirmed_at` = confirmation explicite de l'acheteur lorsque cette confirmation est requise.

`completed_at` = fin de la transaction financière et commerciale.

La réutilisation de `completed` comme simple synonyme de `delivered` détruit la fenêtre de litige et la gestion de l'escrow.

### D05 — Le statut de perte interville doit avoir un workflow spécifique

Une livraison `lost` ne doit pas automatiquement entrer dans un mécanisme générique où un administrateur pourrait choisir librement « release vendeur » comme pour un litige classique.

Il faut un résultat métier propre : perte reconnue, garantie appelée, traitement du montant de la marchandise, éventuelle récupération/assurance, clôture.

### F05 — Le moyen de paiement et le partenaire financier ne sont pas encore reliés de façon transactionnelle

`payment_method_id` existe côté mobile, mais la route d'initialisation ne l'utilise pas réellement pour vérifier la méthode choisie.

Pour l'interville, la transaction doit conserver la trace du provider réellement utilisé et de la nature du montant : marchandise, transport opérationnel, et éventuellement garantie partenaire séparée.

### F06 — La garantie partenaire ne doit pas être un sous-total client déguisé

Une garantie financée par le partenaire ne doit pas entrer dans le même champ comptable que la somme débitée à l'acheteur.

La transaction doit permettre de répondre séparément aux questions :

« Combien l'acheteur a-t-il payé ? »

« Combien le partenaire doit-il garantir ? »

« Combien le partenaire a-t-il effectivement bloqué ? »

« Combien a été restitué au partenaire ? »

« Combien a été appelé au bénéfice de l'acheteur ? »

### N02 — L'outbox notifications n'est pas une livraison push

`notification_outbox` est bien une file, mais aucune consommation réelle des canaux push/SMS n'a été trouvée dans le backend actuel.

Il faut donc la considérer comme une préparation d'architecture, pas comme une notification externe fonctionnelle.

### N03 — Le suivi de position du transporteur n'est pas encore une ETA dynamique

La position du transporteur est enregistrée et peut alimenter le suivi, mais les écrans utilisent encore des états déclaratifs et des ETA provenant de règles fixes.

Il ne faut pas présenter une ETA calculée comme « temps réel » tant qu'un moteur de route/distance dynamique n'est pas branché.

### R03 — Le système de rôles multiples n'est pas cohérent avec le modèle de navigation

La base peut représenter plusieurs rôles, mais l'application choisit encore un seul `session.user.role` pour construire le navigateur racine.

Le modèle de données dit « multi-rôle » tandis que le modèle d'interface dit « rôle unique ». Le contrat doit être aligné avant d'ajouter davantage de permissions spécifiques.

### SEC05 — Les chemins admin génériques exposent des colonnes inutiles

Les endpoints de ressources administratives reposent encore largement sur `SELECT *`.

Cela augmente la surface de données transportée vers le mobile et rend les évolutions de schéma plus risquées : l'ajout d'une colonne sensible peut automatiquement devenir une donnée exposée.

### SEC06 — Les fichiers sont encore une dépendance d'infrastructure, pas un service métier autonome

Photos, vidéos et documents KYC reposent encore sur le stockage local dans le dépôt actuel.

Le fonctionnement local ne signifie pas que la conservation est durable ou distribuée en production.

### CI01 — Le pipeline actuel ne valide pas le code réellement

Le dernier workflow disponible échoue avant l'installation des dépendances à cause de l'absence de lockfile npm. La syntaxe, les tests et les audits statiques sont donc non exécutés sur cette tentative.

Il faut corriger le pipeline avant d'utiliser « CI verte » comme critère d'acceptation.

## 18. Ordre de correction recommandé après cette seconde passe

1. Corriger le modèle commande/livraison/escrow : C01, C02, C03, D04.
2. Séparer totalement transport opérationnel et garantie partenaire : C04–C08, F05–F06, D05.
3. Introduire les lots agricoles et le moteur de conservation : A01–A06, A08–A10.
4. Corriger l'inventaire variantes et les paliers de prix : S01, P02, P03, C12, P08–P09.
5. Finaliser le moteur de chronométrage : B01–B04, C09–C11, I07–I12, N03.
6. Corriger le panier multi-vendeur ou implémenter un split-order : P01.
7. Finaliser le paiement réel et les intégrations externes : F02, F03, I09, N02.
8. Aligner rôles, permissions et navigation : R01–R02, R03.
9. Durcir stockage, réponses admin et CI : SEC03–SEC06, CI01.

## 19. Conclusion de la seconde passe

Le principal enseignement de cette revue est que LIVI ne doit pas être modélisé comme « une commande + un délai ». Il faut modéliser plusieurs dimensions indépendantes :

- état commercial de la commande ;
- état physique de la marchandise ;
- état du transport ;
- état financier de l'escrow ;
- état de la garantie partenaire ;
- horloge de préparation ;
- horloge de transport ;
- horloge de conservation ;
- responsabilité du vendeur ;
- responsabilité du transporteur/partenaire.

Tant que ces dimensions sont compressées dans les mêmes états ou les mêmes montants, des incohérences réapparaîtront même après plusieurs correctifs ponctuels.

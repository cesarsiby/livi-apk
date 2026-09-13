# Audit QR code & PIN — LIVI

**Mise à jour : les corrections de la section N ont été appliquées** (à votre demande, suite à l'audit initial ci-dessous, qui reste inchangé tel quel comme constat de l'état *avant* correction). Le détail de ce qui a été fait, fichier par fichier, est en fin de document, après la section N originale.

---

Version initiale de l'audit (lecture seule, aucun code modifié à ce stade) : lecture complète du parcours réel, backend puis frontend, fichiers et fonctions exacts à l'appui.

---

## Constat principal (à lire en premier)

Le mécanisme cryptographique de preuve (génération, chiffrement, hachage du PIN, anti-rejeu, limitation des tentatives) est **bien conçu et correct**. Mais **la fonction qui génère réellement un QR/PIN pour une livraison (`createProofs`) n'est appelée nulle part dans tout le backend.** Aucune route, aucun job, aucun trigger ne la déclenche.

Conséquence concrète, vérifiée en remontant toute la chaîne : **aucune commande ne peut aujourd'hui aller au-delà du statut `preparing`/`paid`.** Le Transporteur ne peut jamais valider une prise en charge ni une livraison via les routes prévues à cet effet — pas à cause d'un mauvais PIN, mais parce qu'aucune preuve n'existe jamais en base pour la comparer. Ce n'est donc pas un problème de sécurité du PIN, mais un problème de branchement : la pièce qui crée la preuve n'a jamais été reliée au reste de l'application.

Détail complet en section L.

---

## A. Génération QR

- **Fichier :** `backend/livi/src/services/deliveryProof.js`
- **Fonction :** `makeProofSecret()` (ligne 35), utilisée par `createProofs()` (ligne 44) et `rotateProof()` (ligne 131)
- **Construction :** `randomToken()` (ligne 32) — `crypto.randomBytes(32).toString('base64url')`, un secret aléatoire de 256 bits, généré côté serveur par le module natif `node:crypto` (aucune donnée prévisible n'entre dans sa génération).
- **Contenu du QR :** `qrPayload({proofId, token})` (ligne 40) — un JSON `{"v":1,"app":"LIVI","proof_id":"<uuid>","token":"<le secret aléatoire>"}`. Le QR contient donc le secret en clair (nécessaire pour qu'il soit vérifiable), mais uniquement au moment où il est affiché — jamais stocké en clair côté serveur (voir section J).
- **Enregistrement :** le token n'est jamais stocké tel quel. Deux formes sont conservées dans `shipment_proofs` : un hash SHA-256 (`token_hash`, pour la vérification rapide) et une version chiffrée AES-256-GCM (`secret_ciphertext`/`secret_iv`/`secret_tag`, pour pouvoir ré-afficher le même QR/PIN tant qu'il est valide, sans en créer un nouveau à chaque ouverture d'écran). La clé de chiffrement vient de la variable d'environnement `LIVI_PROOF_ENCRYPTION_KEY` (32 octets, obligatoire — `proofKey()`, ligne 14).
- **Génération réellement déclenchée par :** **rien actuellement.** Voir section L/M.

## B. Génération PIN

- **Même fichier, fonction `pinFromToken(token)`** (ligne 33).
- **Oui, le PIN fait bien 6 chiffres** : `parseInt(sha256(token).slice(0,12), 16) % 1000000`, complété à 6 chiffres avec des zéros (`.padStart(6,'0')`) — bornes 000000 à 999999, toujours 6 caractères.
- **Le PIN n'est pas généré indépendamment du QR** : il est dérivé mathématiquement du même token aléatoire (fonction à sens unique, SHA-256). Un attaquant qui a le PIN ne peut pas remonter au token ; celui qui a le token peut recalculer le PIN — c'est le fonctionnement voulu, cohérent avec le fait que PIN et QR doivent valider la même preuve.
- **Stockage :** `pin_hash = bcrypt.hashSync(pin, 12)` (ligne 7) — jamais en clair. Coût bcrypt 12 (volontairement lent), en plus de la limite de 5 tentatives (section K) — double protection contre le brute-force.
- **Génération réellement déclenchée par :** rien actuellement (même cause que A).

## C. seller_pickup

- **Qui la génère :** personne actuellement (`createProofs()` la créerait, mais n'est jamais appelée — voir constat principal).
- **Qui doit la voir :** le Vendeur, au moment de la remise du colis au Transporteur (déduit de la logique métier : c'est la preuve que CE transporteur a bien récupéré le colis chez CE vendeur).
- **Qui doit la présenter :** le Vendeur.
- **Qui doit scanner/saisir :** le Transporteur.
- **Qui valide :** le backend, jamais le mobile (confirmé : le frontend n'a aucune logique de comparaison, il transmet tel quel — voir `QRValidationScreen.tsx` ligne 33 et `MissionDetailsScreen.tsx`, qui envoient la donnée brute au serveur sans interprétation).
- **Endpoint backend :** `POST /deliveries/:id/pickup-proof/verify` (`backend/livi/src/routes/delivery.js`, ligne 39), atteint depuis le mobile via l'alias `POST /transporter/missions/:id/pickup` (`routes/compatibility.js`, ligne 103, redirection HTTP 307).
- **Écran vendeur pour l'afficher :** **aucun** (voir section E).

## D. buyer_delivery

- **Qui la génère :** personne actuellement (même cause).
- **Qui doit la voir :** l'Acheteur, une fois la commande en livraison.
- **Qui doit la présenter :** l'Acheteur (au Transporteur), ou l'Acheteur peut la saisir lui-même dans son appli.
- **Qui scanne/saisit :** soit le Transporteur (au moment de la remise), soit l'Acheteur lui-même.
- **Qui valide :** le backend. **Deux chemins existent**, avec un écart de rigueur important entre eux :
  1. **Le Transporteur soumet le code** — `POST /deliveries/:id/delivery-proof/verify` (`routes/delivery.js`, ligne 55), alias mobile `POST /transporter/missions/:id/deliver` (`compatibility.js`, ligne 105). Ici la preuve est **obligatoire** : sans `credential`, la requête est rejetée (422 `QR/PIN requis`, vérifié côté mobile ET la vérification cryptographique est de toute façon imposée côté serveur par `consumeProof`).
  2. **L'Acheteur confirme lui-même** — `POST /orders/:id/confirm-receipt` (`compatibility.js`, ligne 64). Ici le code est **optionnel** :
     ```js
     const credential=req.body?.qr_token||req.body?.pin;
     if(credential){ ... await consumeProof(...) ... }
     ```
     (`compatibility.js`, lignes 70-71) — si l'Acheteur n'envoie ni `pin` ni `qr_token`, la vérification de preuve est simplement sautée et le flux continue directement vers la libération de l'escrow. **En l'état actuel, ce chemin ne peut toutefois jamais aboutir non plus** (voir section L, point 2) : il est bloqué par une garde différente, indépendante du PIN.
- **Écran acheteur pour l'afficher (le recevoir) :** aucun. L'écran acheteur existant (`BuyerQRValidationScreen.tsx`) sert à **soumettre** un code, pas à **consulter** celui qui lui serait destiné (section G).

## E. Parcours Vendeur

VENDEUR → commande → préparation → remise au transporteur → preuve `seller_pickup` → validation.

- Écrans vendeur inspectés en entier (`frontend/livi/src/screens/seller/` — 15 fichiers : dashboard, produits, stock, commandes, détail commande, statistiques, KYC, paiements, live, vidéo, messages, onboarding) : **aucun n'affiche ni ne mentionne de QR, PIN, ou preuve de remise.**
- `SellerOrderDetailsScreen.tsx` (l'écran le plus proche candidat) a été vérifié spécifiquement : il n'a aucune référence à un code de remise.
- **Réponse aux 4 questions du brief :**
  - *Où le QR/PIN apparaît :* nulle part côté Vendeur.
  - *Le Vendeur reçoit-il réellement la preuve :* non, aucun écran ni appel API ne la lui expose.
  - *Le frontend affiche-t-il correctement la preuve :* sans objet — il n'y a rien à afficher, la fonctionnalité n'existe pas côté Vendeur.
  - *Le backend valide-t-il correctement la preuve :* la validation (`consumeProof`) est correcte en elle-même (section K), mais elle ne peut jamais réussir puisque rien ne génère la preuve à valider (section L).

## F. Parcours Transporteur

MISSION → acceptation → prise en charge → livraison → preuve → validation.

- **Écran réel de saisie/scan (celui qui fonctionne architecturalement) :** `MissionDetailsScreen.tsx`. Deux sections :
  - *« Prise en charge du colis »* : champ « PIN vendeur » + bouton « Valider la prise en charge » → `transporterApi.pickup(id,{pin})`, et bouton « Scanner le QR vendeur » → scanner caméra intégré → `transporterApi.pickup(id,{qr_token})`.
  - *« Remise à l'acheteur »* : champ « PIN acheteur » + « Confirmer la remise » → `transporterApi.deliver(id,{pin})` ; « Scanner le QR acheteur » → `transporterApi.deliver(id,{qr_token})`.
  - Ces deux fonctions (`frontend/livi/src/features/transporter/transporterApi.ts`, lignes 15 et 17) appellent respectivement `POST /transporter/missions/:id/pickup` et `.../deliver`, qui correspondent exactement au contrat backend (section C/D). **Le contrat frontend↔backend est correct et cohérent** — le problème n'est pas ici.
- **L'écran « QR / PIN » (`QRValidationScreen.tsx`, titre exact `"QR / PIN"` dans le navigateur) :** ce n'est **pas** l'écran de validation de mission. C'est un outil séparé, générique, sans lien avec une mission précise : il appelle `transporterApi.scanQR()` → `POST /transporter/qr/scan` → `POST /deliveries/proof/resolve` (`routes/delivery.js` ligne 23), un endpoint qui **vérifie** une preuve (token/QR valide, non expiré, non utilisé) **sans la consommer** — il ne fait progresser aucun statut. Le résultat brut de l'API est affiché tel quel en JSON à l'écran (`JSON.stringify(result, null, 2)`, ligne 40) : c'est un outil de diagnostic/test, pas une action métier.
- **Cet écran n'est de toute façon jamais atteint dans l'usage normal** : il est bien déclaré dans `TransporterNavigator.tsx` (route `"QRValidation"`), mais **aucun bouton, menu ou lien nulle part dans l'application n'y navigue** (`navigation.navigate('QRValidation')` : zéro résultat dans tout `screens/`). Il en va de même pour la route `"QRScanner"` (le composant `QRScannerScreen.tsx` autonome) : `MissionDetailsScreen.tsx` utilise sa propre caméra intégrée (`QRScannerScreenForMission`, définie localement lignes 130-149 du même fichier) plutôt que de naviguer vers cet écran partagé. Les deux existent, sont enregistrés dans le navigateur, mais sont orphelins.

## G. Parcours Acheteur

COMMANDE → en livraison → arrivée Transporteur → preuve `buyer_delivery` → confirmation.

- **Où l'Acheteur récupère son PIN/QR :** nulle part. Aucun écran, aucun appel API. Le seul écran acheteur lié au sujet, `BuyerQRValidationScreen.tsx`, est un formulaire de **soumission** (scanner ou taper un code puis l'envoyer via `ordersApi.confirmReceipt()`) — il ne consulte ni n'affiche jamais un PIN/QR qui lui serait attribué. Il n'y a donc pas d'écran « Voici votre code de livraison » dans l'appli Acheteur.
- **Le backend expose-t-il ces informations à l'Acheteur :** non. La seule fonction backend capable de resservir un PIN/QR déjà généré est `getActiveProof()` (`deliveryProof.js`, ligne 117) — elle n'est appelée par **aucune route**, donc aucun endpoint GET n'existe pour qu'un Acheteur (ni un Vendeur) consulte son propre code.
- **Le PIN est-il visible uniquement au bon moment / le QR est-il disponible au bon moment :** question sans objet en l'état — il n'est jamais visible du tout, à aucun moment, car il n'est jamais ni généré ni exposé.
- **Ce qui manque précisément :** (1) un déclencheur qui appelle `createProofs()` au bon moment du cycle de vie de la livraison ; (2) un endpoint `GET` (nouveau) qui expose `getActiveProof()` à l'Acheteur pour SA commande (et un équivalent pour le Vendeur) ; (3) un écran Acheteur (et un écran Vendeur) qui affiche ce PIN/QR reçu. Voir section N pour une proposition concrète, non implémentée.

## H. Frontend — fichiers exacts

| Rôle | Écran | Appel(s) API |
|---|---|---|
| Transporteur | `screens/transporter/MissionDetailsScreen.tsx` | `transporterApi.pickup()`, `.deliver()` |
| Transporteur | `screens/transporter/QRValidationScreen.tsx` (orphelin) | `transporterApi.scanQR()` |
| Transporteur | `screens/transporter/QRScannerScreen.tsx` (orphelin, doublon de la caméra inline de MissionDetailsScreen) | — (composant caméra pur) |
| Acheteur | `screens/buyer/BuyerQRValidationScreen.tsx` | `ordersApi.confirmReceipt()` |
| Vendeur | *(aucun)* | *(aucun)* |

Services : `features/transporter/transporterApi.ts`, `features/orders/ordersApi.ts`. Les deux correspondent exactement aux routes backend appelées (noms de champs `pin`/`qr_token` identiques des deux côtés).

## I. Backend — fichiers exacts

| Fichier | Rôle |
|---|---|
| `services/deliveryProof.js` | Cœur cryptographique : `makeProofSecret`, `qrPayload`, `createProofs`, `consumeProof`, `getActiveProof`, `rotateProof` |
| `routes/delivery.js` | 3 routes réellement atteignables : `POST /proof/resolve`, `POST /:id/pickup-proof/verify`, `POST /:id/delivery-proof/verify` (le fichier documente lui-même, lignes 10-20, que 11 autres routes ont été supprimées lors d'un audit précédent car mortes) |
| `routes/compatibility.js` | Alias mobile-facing : `/transporter/missions/:id/{pickup,deliver}`, `/transporter/qr/scan` (redirigent/proxient vers `delivery.js`), et `/orders/:id/confirm-receipt` (logique propre, credential optionnel) |
| `middleware/security.js` | `proofLimiter` — 20 requêtes/10 min par IP+utilisateur sur les 3 routes de `delivery.js` |
| `middleware/auth.js` | `requireAuth`, `requireRoles` — utilisés systématiquement sur ces routes |
| `utils/redaction.js` | Redaction des logs : `pin`, `pin_hash`, `qr_payload`, `qr_secret` explicitement listés comme sensibles |

## J. Base de données

Migration `007_delivery_proofs.sql`, complétée par `008_proof_stability.sql` (colonnes de secret chiffré) et `012_v15_concurrency_guards.sql` (trigger d'immuabilité) :

**Table `shipment_proofs`** — une ligne par (livraison, type de preuve), contrainte `UNIQUE(shipment_id, proof_type)` :
- `token_hash` (char 64, unique) — SHA-256 du token
- `token_hint` (varchar 12) — **anomalie de nommage constatée** : cette colonne est en réalité remplie avec les 2 premiers chiffres du PIN + `'****'` (`secret.pin.slice(0,2) + '****'`, `deliveryProof.js` lignes 67 et 72), pas avec un indice du token comme son nom le suggère. Sans conséquence pratique aujourd'hui : cette colonne n'est lue par aucune route, donc rien n'expose actuellement ce fragment de PIN — mais le nom de colonne est trompeur et mérite clarification si la colonne est utilisée un jour.
- `pin_hash` (char 64) — hash bcrypt du PIN (voir section B ; le `.trim()` dans `verifyPin()` gère correctement le padding que Postgres ajoute aux colonnes `char(n)` plus courtes que 64, ce qui pourrait sinon fausser la comparaison)
- `secret_ciphertext` / `secret_iv` / `secret_tag` (text) — token chiffré AES-256-GCM, ajoutés par la migration 008
- `expires_at` — délai par défaut 24h (`TTL_MINUTES = 24 * 60`, `deliveryProof.js` ligne 5)
- `used_at`, `used_by`, `revoked_at` — état d'utilisation
- `attempts` (défaut 0) / `max_attempts` (défaut 5) — compteur anti-brute-force

**Table `shipment_proof_events`** — journal d'audit : une ligne par tentative (`success`, `invalid`, `expired`, `replayed`, `revoked`, `attempt_limit`), avec acteur, IP, user-agent, request-id.

**Colonnes miroir sur `shipments` :** `pickup_proof_used_at`, `delivery_proof_used_at` (ajoutées par la migration 007, renseignées uniquement par `routes/delivery.js`, jamais par le chemin `confirm-receipt` de l'Acheteur — incohérence mineure de traçabilité, sans impact fonctionnel puisque ce chemin échoue de toute façon avant de les atteindre, voir section L).

**Garde-fou notable :** un trigger Postgres (`proof_used_immutable_guard`, migration 012) interdit au niveau base de données toute modification d'une ligne `shipment_proofs` une fois `used_at` renseigné — même un bug applicatif ne pourrait pas faire rejouer ou altérer une preuve déjà consommée.

## K. Sécurité — réponses point par point

| Question du brief | Réponse |
|---|---|
| PIN généré côté backend ? | Oui, exclusivement (`node:crypto`, jamais côté client) |
| PIN devinable ? | 1 chance sur 1 000 000 par tentative ; 5 tentatives max avant blocage (`PROOF_ATTEMPTS_EXCEEDED`) → ~0,0005 % de réussite avant blocage |
| Secret suffisamment aléatoire ? | Oui — 256 bits (`crypto.randomBytes(32)`), le PIN en est dérivé par SHA-256 |
| QR contient un secret sensible ? | Oui, le token en clair — c'est inhérent au fonctionnement (il faut bien transmettre le secret pour le vérifier), mais il n'est jamais stocké en clair côté serveur |
| PIN stocké en clair ? | Non — bcrypt coût 12 |
| Qui peut récupérer le PIN/QR ? | Personne actuellement via l'API (aucune route ne les expose — voir G) |
| Un utilisateur peut-il récupérer la preuve d'une autre commande ? | Aucune route ne permet de récupérer une preuve par consultation. Sur les routes de *validation*, la propriété est vérifiée avant tout : `/pickup-proof/verify` et `/delivery-proof/verify` comparent `shipments.transporter_id` à l'utilisateur connecté ; `/confirm-receipt` compare `orders.buyer_id` ; `/proof/resolve` fait de même pour le rôle transporteur. Les admins contournent ces vérifications par conception. |
| Le backend vérifie le rôle ? | Oui, `requireRoles(...)` sur chaque route concernée |
| Le backend vérifie le statut de livraison ? | Oui — `/pickup-proof/verify` exige `shipments.status='assigned'` ; `/delivery-proof/verify` exige `'in_transit'` ou `'arrived'` ; `/confirm-receipt` exige `orders.status='delivered'` (via `canBuyerConfirm`) |
| Une preuve déjà utilisée peut-elle être réutilisée ? | Non — vérifié applicativement (`used_at` contrôlé avant toute comparaison) ET au niveau base de données (trigger d'immuabilité, section J) |

## L. Problèmes trouvés

**1. `createProofs()` n'est appelée par aucun code du backend — le système ne génère jamais de preuve.**
- Fichier/fonction : `services/deliveryProof.js`, `createProofs()` (ligne 44). Recherche exhaustive (`grep -rn "createProofs"`) : zéro appelant dans tout `backend/livi/src`.
- Cause : la fonction a été écrite mais jamais reliée à un événement métier (ex. acceptation de mission par le Transporteur).
- Conséquence, vérifiée en remontant toute la chaîne : `consumeProof()` commence systématiquement par `if (!proof) throw ... PROOF_NOT_FOUND` (ligne 92) — donc `POST /pickup-proof/verify` et `POST /delivery-proof/verify` échouent **toujours**, quel que soit le PIN/QR fourni. Comme ce sont les deux seuls endroits du code qui font passer `shipments.status` à `'picked_up'` ou `orders.status` à `'shipping'`/`'delivered'` (vérifié par recherche exhaustive de ces affectations dans tout `routes/` et `services/`), **aucune commande ne peut aujourd'hui dépasser le statut `preparing`/`paid`**. En cascade : `canBuyerConfirm()` (qui exige `order.status==='delivered'`) ne peut jamais être vraie non plus, donc `/orders/:id/confirm-receipt` échoue systématiquement (409) même si son credential est optionnel — le contournement du credential ne change rien, la vraie garde bloquante est ailleurs. Et `autoReleaseEligibleEscrows()` (`services/escrowScheduler.js`), qui ne traite que les commandes déjà `'delivered'`, ne trouve donc jamais de candidat.
- Correction recommandée : section N.

**2. Aucun écran Vendeur pour le `seller_pickup`.**
- Fichier : absent de `screens/seller/` (15 écrans vérifiés un par un, aucun résultat).
- Cause : jamais construit.
- Conséquence : même si (1) était corrigé, le Vendeur n'aurait toujours aucun moyen de voir le PIN/QR à présenter au Transporteur.
- Correction recommandée : section N.

**3. Aucun écran Acheteur pour *consulter* le `buyer_delivery` (l'écran existant ne fait que le *soumettre*).**
- Fichier : `screens/buyer/BuyerQRValidationScreen.tsx` — formulaire de soumission uniquement.
- Cause : même lacune que le point 2, côté Acheteur.
- Conséquence : même une fois (1) corrigé, l'Acheteur n'aurait aucun moyen de voir son propre code pour le communiquer au Transporteur ou le vérifier avant de le saisir.

**4. Aucune route backend n'expose `getActiveProof()`.**
- Fichier/fonction : `services/deliveryProof.js`, `getActiveProof()` (ligne 117) — zéro appelant.
- Conséquence : même en corrigeant 2 et 3 côté écrans, il n'y aurait rien à appeler pour remplir ces écrans.

**5. L'écran nommé « QR / PIN » dans l'app n'est pas l'écran de validation de mission, et n'est de toute façon jamais atteint depuis l'interface.**
- Fichiers : `screens/transporter/QRValidationScreen.tsx` et `QRScannerScreen.tsx`, déclarés dans `navigation/TransporterNavigator.tsx` mais jamais ciblés par un `navigate(...)` ailleurs dans le code.
- Conséquence : aucune (l'écran réellement utilisé, `MissionDetailsScreen.tsx`, fonctionne indépendamment) — mais source de confusion pour la maintenance, et deux implémentations de caméra QR redondantes.

**6. Colonne `token_hint` au contenu trompeur.**
- Fichier : `services/deliveryProof.js`, lignes 67 et 72 — la colonne `token_hint` est remplie avec un fragment du **PIN**, pas du token.
- Conséquence actuelle : aucune (colonne jamais lue par une route). Risque latent : si quelqu'un l'exploite plus tard en pensant qu'elle contient un indice du token, ou l'expose côté API en pensant qu'elle est inoffensive, elle réduirait en réalité l'entropie effective du PIN de 1 000 000 à 10 000 combinaisons pour qui la verrait.

**7. Incohérence mineure de saisie côté Transporteur/Acheteur.**
- Fichiers : `MissionDetailsScreen.tsx` (lignes 82, 104) et `BuyerQRValidationScreen.tsx` (ligne 47) — champs PIN avec `maxLength={8}` alors que le backend génère et attend toujours exactement 6 chiffres.
- Conséquence : cosmétique uniquement (le backend rejette proprement toute valeur incorrecte, quelle que soit sa longueur) ; peut simplement induire l'utilisateur en erreur sur le format attendu.

## M. Éléments manquants (résumé)

- Un déclencheur applicatif qui appelle `createProofs()` — aucun ne existe.
- Une route `GET` qui expose `getActiveProof()` au Vendeur pour `seller_pickup` — n'existe pas.
- Une route `GET` équivalente pour l'Acheteur sur `buyer_delivery` — n'existe pas.
- Un écran Vendeur affichant ce PIN/QR — n'existe pas.
- Un écran Acheteur affichant (et pas seulement soumettant) ce PIN/QR — n'existe pas.

## N. Corrections recommandées (appliquées — voir le détail après cette section)

1. **Brancher `createProofs()`.** L'endroit le plus cohérent avec le cycle de vie actuel est `POST /transporter/missions/:id/accept` (`routes/compatibility.js`, ligne 101) : au moment où le Transporteur accepte la mission, `shipments.status` passe à `'assigned'` — c'est le moment naturel pour générer les deux preuves (`seller_pickup` et `buyer_delivery`) d'un coup, puisque `createProofs()` est déjà conçue pour créer les deux en une seule fois et est idempotente (elle réutilise une preuve encore valide plutôt que d'en recréer une à chaque appel).
2. **Ajouter deux routes de lecture seule** (nouvelles, pas de modification des routes existantes) exposant `getActiveProof()` : une pour le Vendeur (scoping par `vendor_id` sur la commande liée à la livraison), une pour l'Acheteur (scoping par `buyer_id`), toutes deux avec `requireAuth` + vérification de propriété stricte comme sur les routes de validation existantes.
3. **Construire l'écran Vendeur** correspondant (affichage du PIN + QR pour `seller_pickup`, avec le même style que les écrans QR existants côté Transporteur/Acheteur pour rester cohérent visuellement).
4. **Compléter `BuyerQRValidationScreen.tsx`** (ou ajouter un écran dédié) pour afficher le PIN/QR reçu, en plus du formulaire de soumission déjà présent.
5. **Décider du sort de `QRValidationScreen.tsx` et `QRScannerScreen.tsx`** : soit les relier réellement à un point d'entrée utile (par exemple un raccourci générique « scanner un code » accessible depuis le dashboard Transporteur), soit les retirer pour éviter la redondance avec la caméra déjà intégrée dans `MissionDetailsScreen.tsx`.
6. Corrections mineures : renommer ou clarifier `token_hint` (point L.6) ; aligner `maxLength` des champs PIN sur 6 (point L.7).

---

## Corrections appliquées

Les 6 points ci-dessus ont tous été traités. Détail fichier par fichier :

**1. `createProofs()` branchée** — `backend/livi/src/routes/compatibility.js`, route `POST /transporter/missions/:id/accept` : désormais exécutée dans une transaction (`tx(...)`), qui met à jour le statut de la livraison puis appelle `createProofs(c, row.id)`. C'est le correctif qui débloque tout le reste : sans lui, les deux nouvelles routes de lecture (point 2) n'auraient jamais rien eu à retourner.

**2. Deux routes de lecture ajoutées**, dans le même fichier, juste après `confirm-receipt` :
- `GET /orders/:id/pickup-proof` — Vendeur (`requireRoles('vendor','admin')`), vérifie `vendor_id` avant de renvoyer `{pin, qr_payload, expires_at}`.
- `GET /orders/:id/delivery-proof` — Acheteur (`requireRoles('client','admin')`), même principe avec `buyer_id`.
Les deux passent par `getActiveProof()` (jamais par `createProofs()`/`rotateProof()`), donc aucun risque de heurter le trigger d'immuabilité d'une preuve déjà utilisée (section J du rapport) ; les deux utilisent le même `proofLimiter` que les routes de validation existantes, et renvoient `Cache-Control: no-store` puisqu'elles exposent un PIN.

**3. Écran Vendeur créé** — `frontend/livi/src/screens/seller/SellerPickupProofScreen.tsx` (nouveau), enregistré dans `SellerNavigator.tsx`, accessible depuis `SellerOrderDetailsScreen.tsx` via un nouveau bouton « Voir le code de remise ». Gère explicitement le cas où le code n'existe pas encore (409 → message d'attente + bouton Actualiser) plutôt que d'afficher une erreur générique.

**4. `BuyerQRValidationScreen.tsx` complété** — affiche maintenant le code de livraison de l'Acheteur (récupéré via `ordersApi.deliveryProof()`) au-dessus du formulaire de soumission déjà existant, qui reste inchangé et pleinement fonctionnel. L'écran est aussi passé sous `ScrollView` (clavier).

Les deux écrans (3 et 4) réutilisent un nouveau composant partagé, `design/components/ProofDisplay.tsx` (QR + PIN), pour rester visuellement cohérents entre eux. **Le rendu visuel du QR nécessite deux nouvelles dépendances** (`react-native-svg`, `react-native-qrcode-svg`) — aucune bibliothèque de génération de QR n'existait dans le projet (seul `expo-camera`, pour scanner, était présent). Elles ont été ajoutées à `package.json` avec des versions raisonnables, mais **n'ont pas pu être installées ni testées dans cet environnement** (pas d'accès réseau). Avant de reconstruire l'APK : `npm install`, et si `expo-doctor` ou le build signale une incompatibilité de version sur `react-native-svg`, lancez `npx expo install react-native-svg` pour qu'Expo aligne automatiquement la version exacte attendue par le SDK 54 du projet.

**5. Écrans QR orphelins tranchés au cas par cas** plutôt que traités de façon identique :
- `QRScannerScreen.tsx` **supprimé** (avec sa déclaration dans `TransporterNavigator.tsx`) : c'était une troisième implémentation redondante d'un scanner déjà dupliqué ailleurs (`MissionDetailsScreen.tsx` a le sien en interne), sans rien perdre en la retirant.
- `QRValidationScreen.tsx` **conservé et relié** : il appelle un endpoint réellement utile (`/proof/resolve`, vérifier un code sans le consommer). Un bouton « Vérifier un code QR / PIN » a été ajouté en haut de `MissionsScreen.tsx` (l'écran liste des missions du Transporteur), qui n'avait jusqu'ici aucun point d'entrée.

**6. Corrections mineures faites** :
- `token_hint` ne reçoit plus de fragment du PIN (`services/deliveryProof.js`, `createProofs` et `rotateProof`) — la colonne reste `NULL`, avec un commentaire expliquant pourquoi, sans migration de schéma.
- `maxLength` des champs PIN aligné sur `6` dans `MissionDetailsScreen.tsx` (2 champs) et `BuyerQRValidationScreen.tsx`.

**Ce qui n'a pas changé et pourquoi c'est volontaire :** aucune propriété cryptographique ou de sécurité du système (génération, hachage, anti-rejeu, limite de tentatives, trigger d'immuabilité) n'a été touchée — tout était déjà correct (sections J/K du rapport initial) ; seul le branchement manquant a été comblé. `rotateProof()` reste elle aussi non exposée par une route : aucune demande explicite de fonctionnalité « régénérer mon code » n'a été faite, donc rien n'a été ajouté dans cette direction pour rester dans le périmètre demandé.

**Non vérifiable dans cet environnement** (comme pour les sessions précédentes — pas de réseau, pas de build, pas de téléphone) : le flux complet n'a été relu que par le code, jamais exécuté. En particulier, un vrai test sur appareil reste nécessaire pour confirmer que le QR généré s'affiche et se scanne correctement une fois `react-native-svg`/`react-native-qrcode-svg` installées.


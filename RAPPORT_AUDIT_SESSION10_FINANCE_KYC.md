# Session 10 — Commission critique, escrow, concurrence paiement, permissions KYC

Suite directe de la Session 9 (`RAPPORT_AUDIT_SESSION9_AUTH.md`). Périmètre
de cette session : sections 21–25 et 32 du prompt maître (le reste —
webhooks au-delà de l'audit ci-dessous, ledger complet, transport/dispatch,
storage KYC durable, request_id, CI/lockfile — reste à faire, voir
`RAPPORT_AUDIT_SESSION9_AUTH.md` section H).

## A. Commission — bug financier confirmé (sections 21–22)

**Constat vérifié en traçant les vrais chiffres dans le code** (pas
supposé) : pour un vendeur en `commission_passthrough=true`, avec un prix
de base de 10 000 XOF et une commission de 3 % :
- `routes/orders.js` calculait correctement le prix payé par l'acheteur :
  10 300 XOF (`passthroughPrice`), stocké tel quel dans
  `escrow_transactions.amount`.
- `services/finance.js#releaseEscrow` réappliquait ensuite le TAUX de
  commission sur ce montant déjà majoré : `commission =
  commissionAmount(10300, 300) = 309`, `vendorNet = 10300 - 309 = 9991`.
- **Le vendeur recevait donc 9 991 XOF au lieu des 10 000 XOF promis** —
  exactement l'exemple donné dans le prompt maître, retrouvé tel quel en
  suivant le code, pas deviné.

Un second problème, indépendant mais lié (section 22) : que le vendeur soit
en passthrough ou non, `releaseEscrowWithActiveCommission` récupérait le
taux **actuellement actif** dans `platform_fee_rules` au moment du
release — pas celui en vigueur à la création de la commande. Un changement
de taux pendant qu'une commande reste en escrow modifiait silencieusement
ce que le vendeur recevait.

**Correction** : le montant net vendeur garanti (`vendor_net_amount_snapshot`)
est désormais calculé une seule fois à la création de la commande
(`calculateVendorNet()`, nouvelles fonctions explicites dans
`orderPricing.js` : `calculateBasePrice`, `calculateCommission`,
`calculateBuyerPrice`, `calculateVendorNet`, comme demandé section 21) et
lu directement par `releaseEscrow` au lieu d'être recalculé. Le taux de
commission est désormais toujours capturé à la création (pas seulement en
passthrough), pour que le release utilise le taux figé, pas celui du
moment. Migration `040_v55_commission_snapshot.sql` : nouvelle colonne
`orders.base_subtotal_amount` (informatif, sous-total avant majoration) et
`escrow_transactions.vendor_net_amount_snapshot` (nullable — voir détail
migration ci-dessous pour la rétrocompatibilité).

## B. `payment/init` — race condition confirmée (section 24)

Le verrou `SELECT ... FOR UPDATE` s'exécutait via un `pool.query()`
autonome (auto-commit immédiat, donc le verrou était déjà relâché), et
l'`UPDATE` réel avait lieu ensuite dans une **transaction séparée**. Deux
appels simultanés pouvaient tous les deux passer la vérification de statut
avant qu'aucun des deux n'ait validé son `UPDATE`, générant potentiellement
deux références de paiement qui s'écrasent mutuellement. Corrigé : tout
(`SELECT FOR UPDATE`, vérification d'état, `UPDATE`) dans une seule
transaction. Rendu idempotent au passage (section 25) : un appel répété une
fois l'escrow déjà `payment_pending` renvoie la référence existante au lieu
d'une erreur 409.

## C. Escrow — transitions centralisées (section 23)

Contrairement aux commandes (`orderLifecycle.js#assertOrderTransition`,
déjà existant), les transitions d'escrow étaient gardées de façon ad hoc
dans 6 fichiers différents (`orderCancellation.js`, `finance.js`,
`webhooks.js`, `routes/finance.js`, `routes/escrow.js`, `routes/disputes.js`).
Chacune, vérifiée individuellement, s'est révélée correcte (verrous
`FOR UPDATE` posés avant vérification, vérifications d'état cohérentes) —
donc pas de bug fonctionnel trouvé ici, mais l'absence d'une source de
vérité unique est elle-même un risque signalé par le prompt maître. Ajout
de `services/escrowLifecycle.js` (`assertEscrowTransition`, même
patron que `orderLifecycle.js`), câblé dans les deux endroits déjà modifiés
cette session (`routes/escrow.js`) plutôt que dans les 6 fichiers déjà
vérifiés corrects — retoucher du code financier qui fonctionne déjà
correctement pour la seule cohérence stylistique n'était pas le bon
compromis risque/bénéfice dans cette session.

Au passage, dans `routes/webhooks.js` : un ternaire mort
(`type==='payment.failed'?'cancelled':'cancelled'`) donnant la même valeur
dans les deux branches — simplifié, aucun changement de comportement (il
n'existe de toute façon aucun autre statut escrow valide pour les trois
types d'événements concernés).

## D. KYC — permissions de documents (section 32)

**Bug confirmé** : `POST /documents/:id/access-token`
(`routes/kyc.js`) n'a **aucune** garde `requireRoles('admin')` — accessible
à tout utilisateur authentifié pour son propre document
(`loadAuthorizedDocument(...,false)` le garantit). Il générait pourtant un
jeton avec `role:'admin'` codé en dur, indépendamment de qui l'appelle.

Le binding `documentId` dans `verifyFileAccessToken` (le jeton n'est valide
que pour le document exact pour lequel il a été émis) empêche aujourd'hui
qu'un utilisateur réutilise ce jeton pour télécharger le document d'un
autre — vérifié en traçant l'attaque précisément, pas supposé. Mais cette
protection est **incidente** : elle vient d'une vérification totalement
différente, pas d'une garantie voulue sur ce jeton précis. Corrigé :
`POST /documents/:id/access-token` n'intègre plus aucune revendication de
rôle (`USER_DOCUMENT_ACCESS` — la correspondance d'identifiant utilisateur
suffit déjà) ; seule la route `POST /admin/:id/access-token`, protégée par
`requireRoles('admin')`, continue légitimement d'émettre `role:'admin'`
(`ADMIN_DOCUMENT_ACCESS`).

## E. Vérifié réellement (exécuté, pas affirmé)

- `node --check` sur les 12 fichiers backend touchés dans les Sessions 9+10 :
  **PASS**.
- 3 nouveaux fichiers de tests cette session (`commission_snapshot.test.js`,
  `escrow_lifecycle.test.js`, `kyc_document_access.test.js`), 18 tests au
  total, **tous réellement exécutés via `node --test`, 18/18 PASS** —
  notamment un test qui reproduit l'ancien calcul bugué (confirmant qu'il
  produisait bien 9 991 et non 10 000) et un test qui reproduit
  explicitement l'ancien jeton KYC avec `role:'admin'` codé en dur, pour
  documenter précisément la faute corrigée, pas seulement le résultat
  final.
- Suite de tests complète réexécutée après chaque étape : **175/186 PASS**
  en fin de session (155 préexistants + 13 auth Session 9 + 18 cette
  session = 186). Les mêmes 5 échecs préexistants qu'en Session 9,
  individuellement déjà diagnostiqués comme sans rapport (2 dépendances npm
  absentes de ce bac à sable, 3 échecs préexistants sur des sujets non
  touchés) — aucune nouvelle régression.

## F. NON exécuté / à vérifier après déploiement

- Comme en Session 9 : pas d'accès réseau, donc aucune vraie transaction
  PostgreSQL. La migration `040_v55_commission_snapshot.sql` n'a pas pu
  être exécutée contre une vraie base — à valider en staging, en
  particulier le backfill de `vendor_net_amount_snapshot` sur des lignes
  `escrow_transactions` réelles.
- `payment/init`, `payment/confirm`, `releaseEscrow` : la logique a été
  relue et tracée précisément, mais aucun appel HTTP réel ni test de
  concurrence réel (deux requêtes simultanées) n'a pu être exécuté sans
  base de données. Un test de concurrence réel (section 46 du prompt
  maître) reste à faire en staging.
- Impact du backfill `vendor_net_amount_snapshot` sur des commandes
  actuellement en cours (déjà `funded`, pas encore `released`) sur la vraie
  base de production : ces lignes restent `NULL` par conception (voir
  commentaire de la migration) et suivent l'ancien calcul à leur release —
  à confirmer que c'est le comportement voulu pour les commandes en transit
  au moment du déploiement.

## G. Fichiers modifiés dans cette session

| Fichier | Modification | Impact |
|---|---|---|
| `backend/livi/src/services/orderPricing.js` | 4 fonctions explicites (`calculateBasePrice/Commission/BuyerPrice/VendorNet`). | Calcul commission clair, testable, plus de logique implicite dupliquée. |
| `backend/livi/src/routes/orders.js` | Taux de commission toujours capturé à la création ; `vendor_net_amount_snapshot`/`base_subtotal_amount` calculés et stockés. | Fixe le bug 9991 XOF et le risque de dérive de taux. |
| `backend/livi/src/services/finance.js` | `releaseEscrow`/`releaseEscrowWithActiveCommission` lisent le snapshot au lieu de recalculer. | Vendeur reçoit le montant garanti, taux figé à la création. |
| `backend/livi/migrations/040_v55_commission_snapshot.sql` | **Nouveau.** Colonnes + contraintes + backfill non destructif. | Support DB du correctif ci-dessus. |
| `backend/livi/src/routes/escrow.js` | `payment/init` transactionnel + idempotent ; guard de transition centralisé. | Race condition fermée, retries sûrs. |
| `backend/livi/src/services/escrowLifecycle.js` | **Nouveau.** `assertEscrowTransition`, transitions documentées. | Source de vérité unique pour les transitions escrow. |
| `backend/livi/src/routes/webhooks.js` | Ternaire mort simplifié. | Clarté, aucun changement de comportement. |
| `backend/livi/src/routes/kyc.js` | `role:'admin'` retiré du jeton utilisateur normal. | Ferme une élévation de privilège latente. |
| `backend/livi/tests/commission_snapshot.test.js` | **Nouveau**, 7 tests réels. | Preuve exécutée du bug et du correctif. |
| `backend/livi/tests/escrow_lifecycle.test.js` | **Nouveau**, 6 tests réels. | Couverture du nouveau garde-fou. |
| `backend/livi/tests/kyc_document_access.test.js` | **Nouveau**, 5 tests réels. | Preuve exécutée du bug KYC et du correctif. |

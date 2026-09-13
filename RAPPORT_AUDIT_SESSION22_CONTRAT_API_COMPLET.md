# Session 22 — Fin de la couverture complète du contrat API (19/19 fichiers)

Suite de la Session 21. Les 3 derniers clients API non couverts
(`sellerKycApi.ts`, `transporterKycApi.ts`, `sellerOnboardingApi.ts`)
vérifiés. Aucun nouveau bug trouvé.

## A. `sellerKycApi.ts` — vérifié correct

`GET /kyc/mine` renvoie `id, document_type, status, rejection_reason,
created_at, reviewed_at` — correspondance exacte avec le type
`KycDocument`. Commentaire du fichier confirme un choix de conception
déjà réfléchi (`/users/me` n'a jamais porté de champ kyc/verification —
le statut global est calculé côté écran à partir des documents, pas d'un
champ agrégé qui n'existe pas).

## B. `transporterKycApi.ts` — vérifié correct

Même correspondance exacte sur `GET /kyc/mine`. Point vérifié
spécifiquement : `role_details[].{role,verified_at,kyc_level}` — cohérent
avec l'architecture documentée dans le fichier lui-même
(`vendors.kyc_status`/`transporters.kyc_status` vivent sur des tables
séparées et ne sont pas renvoyés par `/users/me`, d'où le choix déjà en
place de calculer le statut depuis les documents).

## C. `sellerOnboardingApi.ts` — vérifié correct, un piège à distance évité

`GET/PATCH /vendor/shop` renvoie/accepte
`shop_name, slug, slogan, category, phone, city, address,
commission_passthrough, latitude, longitude` — correspondance exacte avec
`ShopOnboarding`/`Shop`. Point vérifié spécifiquement : `vendors.category`
est une colonne texte libre (`z.string().max(120)`), **sans rapport** avec
la table `categories`/`products.category_id` traitée en Session 14 — deux
concepts distincts (catégorie de boutique en texte libre vs catégorie de
produit structurée) qui partagent un nom proche. Vérifié pour écarter une
confusion, pas un bug.

## D. Bilan final — audit du contrat API (Sessions 19–22)

**19 fichiers clients API au total, tous désormais vérifiés au moins une
fois contre le backend réel** (`authApi`, `catalogueApi`, `categoriesApi`
déjà vérifiés Sessions 9/14 ; `checkoutApi`, `walletApi`, `sellerApi`
Session 19 ; `disputesApi`, `ratingsApi`, `transporterApi`, `socialApi`
Session 20 ; `buyerApi`, `escrowApi` Session 21 ; `adminApi` Session 16 ;
`notificationsApi` Session 15 ; `sellerKycApi`, `transporterKycApi`,
`sellerOnboardingApi` cette session ; `profileApi` survolé Session 21,
sans vérification champ par champ aussi poussée que les autres).

**4 bugs réels trouvés et corrigés**, tous de la même famille (un nom de
champ lu côté écran ne correspond à aucun champ réellement renvoyé,
repli silencieux vers une valeur par défaut ou un tiret) :
1. Total de commande vendeur affiché à 0 FCFA (Session 19).
2. Articles de commande absents côté vendeur (Session 19).
3. Date et identification de commande absentes sur les remboursements
   (Session 21).
4. Chiffre principal du centre Escrow jamais affiché (Session 21).

**1 point signalé, non corrigé faute de décision produit** : motif de
remboursement sans source systématique (Session 21).

Ce n'est pas une garantie que le contrat API est désormais sans aucune
faille — seulement que l'échantillon vérifié (19 fichiers, sur la
totalité des clients API existants) ne révèle plus de bug de ce type
connu à ce stade.

## E. Vérifié réellement

Aucune modification de code cette session (vérification pure, rien à
corriger). Suite de tests non ré-exécutée (aucun fichier modifié).

## F. Fichiers modifiés

Aucun.

# LIVI — Correspondance HTML → Frontend Mobile

## Objectif
Chaque fichier HTML pertinent du site possède désormais un écran/route équivalent dans le frontend mobile existant. Les équivalences qui réutilisent un écran déjà présent sont conservées comme alias fonctionnel plutôt que dupliquer la logique métier.

## Résultat
- HTML analysés : **49**
- HTML avec équivalent mobile : **49**
- MISSING : **0**
- Architecture remplacée : **NON**
- Backend modifié pour créer une fonction fictive : **NON**

## Principe de fidélité
La fidélité recherchée est fonctionnelle et visuelle : mêmes contenus métier, mêmes rôles, mêmes états et mêmes contrats API lorsqu'ils existent. Le layout est adapté au mobile (stack, cards, bottom navigation) sans recopier le desktop.

## Corrections ajoutées
- Cashback → `CashbackScreen`
- Programme fidélité → `LoyaltyScreen`
- Mot de passe oublié → `ForgotPasswordScreen` avec envoi OTP existant
- 2FA → `TwoFactorAuthScreen` (aucun succès fictif : contrat backend absent)
- Vérification email → `VerifyEmailScreen` (aucun succès fictif : contrat backend absent)
- Dépôt → `DepositScreen` (aucun dépôt fictif : contrat backend absent)
- Analytics admin → `PlatformAnalyticsScreen` utilisant le dashboard admin existant
- Support admin → `SupportCenterScreen`
- Les pages déjà couvertes utilisent les écrans existants : commandes, transactions, litiges, wallet, retraits, KYC, vidéos, missions, etc.

## Tests
Le `tsc --noEmit` a été tenté mais est **BLOCKED** dans l'environnement courant car les dépendances `node_modules` du frontend mobile ne sont pas installées (`expo/tsconfig.base`, `react`, `react-native`, etc. introuvables). Ce résultat n'est pas présenté comme PASS.

## Matrice complète
Voir `MATRICE_HTML_MOBILE_COMPLETE.csv`.

# Session 12 — Conflit de slug produit, durabilité du stockage KYC

Suite de la Session 11. Sections 18 et 33 du prompt maître.

## A. Produits — conflit de slug non géré (section 18)

**Confirmé** : `products.slug` est `citext UNIQUE NOT NULL`
**globalement** (migrations/001_initial.sql), pas par vendeur. `POST
/vendor/products` (`routes/compatibility.js`) dérive le slug uniquement du
nom du produit et n'avait **aucune gestion de conflit** sur l'`INSERT`.
Deux vendeurs différents nommant un produit de façon identique ou très
proche (noms de catégorie courants : "T-shirt bleu", "Sac à main") auraient
déclenché une violation de contrainte Postgres brute au second essai,
remontée telle quelle en 500 générique — exactement le cas que la section
18 du prompt maître demande d'éviter.

Corrigé : l'`INSERT` est maintenant entouré d'un `try/catch` qui détecte le
code Postgres `23505` (violation d'unicité) et renvoie explicitement `409
PRODUCT_SLUG_ALREADY_EXISTS` avec un message actionnable, plutôt qu'une
erreur générique.

Reste du flux produit (`routes/products.js`, lecture ; `PUT
/vendor/products/:id`, modification ; `PATCH
/vendor/inventory/:id`, stock ; validation prix/stock via zod dans
`compatibility.js`) : relu, validation déjà correcte (prix entier positif,
stock entier non négatif), aucune autre modification de slug après
création (le `PUT` ne touche jamais `slug`). Aucun autre bug trouvé sur ce
chemin.

**Point de données à vérifier après déploiement, pas un bug de code** : le
`products.vendor_id` référence `users(id)`, pas `vendors(id)` — un compte
avec le rôle `vendor` mais sans ligne `vendors` (scénario que la
correction de la Session 9 sur l'inscription empêche désormais pour tout
NOUVEAU compte) pourrait techniquement créer des produits malgré une
boutique absente. À vérifier sur la base réelle : y a-t-il des comptes
`role='vendor'` sans ligne `vendors` correspondante, hérités d'avant la
correction Session 9 ?

## B. KYC — durabilité du stockage (section 33)

**Confirmé** : les documents KYC sont stockés sur le disque local du
conteneur (`multer({dest: UPLOAD_DIR})`), sans aucune dépendance vers un
stockage objet (S3, Supabase Storage, R2) nulle part dans le dépôt. Sur
Render sans disque persistant explicitement configuré, un redéploiement
efface ces fichiers pendant que les lignes `kyc_documents` (y compris les
documents déjà validés par un administrateur) restent en base, pointant
vers un fichier disparu.

**Ce qui a été fait** : un avertissement explicite au démarrage en
production (`config/env.js`) rendant ce risque visible dans les logs, et
un document dédié (`docs/KYC_STORAGE_DURABILITY.md`) détaillant le risque
et un plan de migration concret vers Supabase Storage (choix recommandé :
même fournisseur que la base de données, pas de nouvelle relation
contractuelle).

**Ce qui n'a PAS été fait, et pourquoi** : aucune intégration réelle vers
un stockage objet n'a été écrite. Cela exigerait des identifiants réels
(clé de service, bucket configuré) auxquels je n'ai pas accès dans cet
environnement — écrire ce code sans pouvoir le tester contre un vrai
service reviendrait à présenter une intégration non vérifiée comme
fonctionnelle, explicitement interdit par les consignes d'audit. Aucune
option `STORAGE_PROVIDER=s3` factice n'a été ajoutée non plus : proposer un
réglage qui ne fonctionne pas serait pire qu'un avertissement honnête.

## C. Vérifié réellement

- `node --check` sur les fichiers modifiés : PASS (a immédiatement
  détecté une faute de frappe introduite pendant la rédaction du
  commentaire d'avertissement dans `env.js` — un `#` au lieu de `//` —
  corrigée avant de continuer).
- Suite de tests complète réexécutée : 175/186 PASS, mêmes 5 échecs
  préexistants qu'en Session 11, aucune régression.

## D. NON exécuté / à vérifier après déploiement

- Le conflit de slug produit n'a pas pu être déclenché contre une vraie
  base (pas d'accès réseau) — le code a été vérifié par lecture précise de
  la contrainte SQL réelle et du comportement `pg` sur violation
  d'unicité (code `23505`), pas par exécution.
- Migration vers un stockage objet durable pour les documents KYC : à
  réaliser dans un environnement avec accès réel à Supabase/S3, en suivant
  `docs/KYC_STORAGE_DURABILITY.md`.
- Vérifier sur la base réelle si des comptes `vendor` existent déjà sans
  ligne `vendors` correspondante (voir section A).

## E. Fichiers modifiés

| Fichier | Modification | Impact |
|---|---|---|
| `backend/livi/src/routes/compatibility.js` | `POST /vendor/products` : conflit de slug → 409 explicite. | Fini les 500 génériques sur nom de produit dupliqué. |
| `backend/livi/src/config/env.js` | Avertissement de démarrage si stockage local en production. | Risque visible en logs plutôt que silencieux. |
| `docs/KYC_STORAGE_DURABILITY.md` | **Nouveau.** Risque + plan de migration concret. | Prépare la transition sans fausse intégration. |

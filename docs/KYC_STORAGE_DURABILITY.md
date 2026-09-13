# Stockage des fichiers KYC — durabilité (section 33 de l'audit)

## Constat

Les documents KYC sont actuellement stockés sur le **disque local** du
conteneur backend :

- Upload : `multer({ dest: privateRoot })` où `privateRoot =
  path.resolve(process.cwd(), env.UPLOAD_DIR)` (`backend/livi/src/routes/compatibility.js`,
  route `POST /users/me/kyc`).
- Lecture : `backend/livi/src/services/privateFileAccess.js` résout le
  chemin et lit directement depuis ce même répertoire local.

Aucune dépendance vers un service de stockage objet (S3, Supabase
Storage, Cloudflare R2) n'existe dans `package.json` — vérifié, pas
supposé.

## Risque concret

Sur Render (et la plupart des plateformes PaaS), le système de fichiers
local d'un service web **ne survit pas** à un redéploiement, un redémarrage
ou un changement d'échelle, sauf disque persistant explicitement
provisionné. Sans un tel disque :

- Chaque redéploiement (déclenché par un `git push` si le déploiement
  automatique est actif, ou par tout redémarrage) **efface tous les
  fichiers déjà uploadés**.
- Les lignes `kyc_documents` correspondantes restent en base, y compris
  celles déjà validées par un administrateur — elles pointent alors vers
  un fichier qui n'existe plus.
- Un utilisateur ou un administrateur tentant de consulter un document
  après un redéploiement obtiendrait une erreur (fichier introuvable) sans
  qu'aucune trace ne l'explique clairement dans l'historique métier.

Un avertissement explicite a été ajouté au démarrage du serveur en
production (`backend/livi/src/config/env.js`) pour rendre ce risque visible
dans les logs plutôt que silencieux.

## Ce qui n'a PAS été fait dans cette session, et pourquoi

Implémenter une intégration réelle vers S3, Supabase Storage ou
Cloudflare R2 exige des identifiants réels (clé d'API, bucket configuré,
permissions) auxquels je n'ai pas accès dans cet environnement. Écrire ce
code sans pouvoir le tester contre un vrai service reviendrait à livrer une
intégration non vérifiée présentée comme fonctionnelle — explicitement
interdit par la consigne d'audit ("Ne jamais simuler une intégration
réelle"). Aucune option `STORAGE_PROVIDER=s3` factice n'a donc été ajoutée
au code : proposer un réglage qui ne fonctionne pas serait pire qu'un
avertissement honnête sur la limite actuelle.

## Migration recommandée : Supabase Storage

Ce choix minimise l'ajout de dépendances : le projet utilise déjà Supabase
pour PostgreSQL, donc le même projet Supabase peut héberger le bucket de
stockage sans nouveau fournisseur ni nouvelle relation contractuelle.
Alternatives valables : S3 (ou compatible, comme Cloudflare R2) si
l'équipe préfère.

Étapes concrètes, à réaliser avec un accès réel à Supabase (aucune de ces
étapes n'a été exécutée ni vérifiée depuis cet environnement) :

1. **Créer un bucket privé** dans Supabase Storage (ex. `kyc-documents`),
   accès public désactivé.
2. **Ajouter la dépendance** `@supabase/supabase-js` à
   `backend/livi/package.json`.
3. **Nouvelles variables d'environnement** (`backend/livi/src/config/env.js`) :
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` —
   avec la même rigueur de validation déjà en place pour
   `PAYMENT_WEBHOOK_SECRET`/`FILE_ACCESS_SECRET` (requis et non vides en
   production).
4. **Remplacer l'upload** (`routes/compatibility.js`, `POST /users/me/kyc`) :
   au lieu de `multer({ dest: privateRoot })` (écriture directe sur
   disque), utiliser `multer.memoryStorage()` puis uploader le buffer vers
   Supabase Storage (`supabase.storage.from(bucket).upload(key, buffer)`).
   Le `fileKey` stocké en base (`kyc_documents`) devient la clé de l'objet
   dans le bucket plutôt qu'un chemin de fichier local.
5. **Remplacer la lecture** (`services/privateFileAccess.js`,
   `statPrivateFile`/`streamPrivateFile`) : au lieu de `fs.promises.stat`/
   `fs.createReadStream`, utiliser une URL signée temporaire
   (`supabase.storage.from(bucket).createSignedUrl(key, ttlSeconds)`) ou un
   téléchargement direct côté serveur puis relai vers le client. Le
   mécanisme de jeton HMAC déjà en place
   (`createFileAccessToken`/`verifyFileAccessToken`, corrigé en Session 10
   pour la séparation des permissions utilisateur/admin) reste pertinent
   quel que soit le fournisseur de stockage — c'est une couche
   d'autorisation applicative indépendante du stockage physique.
6. **Migration des fichiers déjà uploadés** : si des documents existent
   déjà sur le disque local d'une instance Render au moment de la bascule,
   les copier vers le nouveau bucket avant de couper l'ancien chemin —
   sinon les documents déjà soumis deviennent inaccessibles.
7. **Tester réellement** : upload, lecture par le propriétaire, lecture par
   un admin autorisé, refus pour un utilisateur non autorisé, avant de
   considérer la migration terminée.

## À vérifier après déploiement

- ~~Si un disque persistant Render est déjà configuré pour ce service, ce risque est déjà partiellement atténué~~ — **vérifié directement via l'API Render (Session 26, accès désormais disponible) : aucun disque n'est attaché au service `livi-apk` (`srv-dab194favr4c73egg38g`), qui tourne de plus sur le plan `free`, un plan qui ne propose pas de disque persistant. Le risque documenté ci-dessus n'est donc pas théorique : il s'applique tel quel au service réellement déployé.**
- Combien de documents KYC existent déjà en production et seraient affectés par un redéploiement avant la migration ci-dessus — non vérifiable depuis ce sandbox (nécessiterait une requête sur la vraie base ; Supabase confirmait 0 migration appliquée lors de la dernière vérification, donc probablement 0 document à ce stade, mais à reconfirmer avant toute bascule).

**Constat additionnel (hors périmètre de ce document, noté ici faute d'un meilleur endroit)** : le même appel a montré `healthCheckPath` vide sur ce service — Render ne vérifie donc la santé du service via aucun des deux endpoints `/health`/`/ready` avant de router du trafic vers une nouvelle instance après déploiement (§39 du prompt maître). Voir le rapport de session pour le détail.

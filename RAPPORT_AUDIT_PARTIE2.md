# Audit & harmonisation — Partie 2 : Chat, Litiges, Notifications, Social/Live

Suite de `RAPPORT_AUDIT_HARMONISATION.md`. Ce document couvre les quatre domaines qui n'avaient pas encore été audités en profondeur. **Contrairement au domaine paiement/escrow/wallet (partie 1), qui était solide, les quatre domaines ci-dessous contenaient chacun un bug bloquant confirmé.** Le fil conducteur : le routage frontend→backend était presque toujours correct (le bon endpoint est appelé), mais la **forme des données** ne correspondait pas à ce que l'écran attendait — un tableau brut lu comme un objet, un champ renommé, une clé absente. Ce sont des bugs silencieux : rien ne plante, l'écran s'affiche, mais il affiche du vide ou des valeurs figées.

---

## A. Audit détaillé

### 1. Chat acheteur↔vendeur — cassé intégralement

`sellerChatApi` (dans `sellerApi.ts`) appelle les bons endpoints (`GET /chat/conversations`, `GET .../messages`, `POST .../messages`), mais :

- Le backend renvoie directement un tableau. Le frontend lisait `response?.conversations ?? response?.data ?? []` — ni l'un ni l'autre n'existe sur un tableau brut, donc **la liste de conversations était toujours vide**.
- Même chose pour les messages d'une conversation — toujours vide.
- L'envoi d'un message renvoie l'objet message directement ; le frontend lisait `response?.message` (undefined) — dans `SellerMessagesScreen`, un message local factice était affiché à la place (`{content: t, sender_role:'vendor', ...}`), ce qui donnait l'illusion que ça fonctionnait alors que rien n'était vraiment confirmé par le serveur.
- Le backend n'a jamais renvoyé de `sender_role` (seulement `sender_id`) — l'alignement des bulles (« moi » à droite, « l'autre » à gauche) comparait `item.sender_role==='client'`, toujours faux, donc **tous les messages, y compris les vôtres, s'affichaient comme venant de l'autre personne**.
- La liste de conversations n'avait de toute façon aucune information utile à afficher : ni nom du contact, ni aperçu du dernier message, ni compteur de non-lus n'existaient côté backend.

### 2. Litiges — la fonctionnalité la plus critique de cet audit

Un litige gère de l'argent en escrow (libération ou remboursement). Quatre bugs cumulés le rendaient **intégralement non fonctionnel** :

1. **Résolution admin :** l'écran avait un seul champ de texte libre envoyé comme `{resolution: "texte libre"}`. Le backend attend `{resolution: 'release'|'refund', note: string}` — un choix fermé, pas du texte. Chaque tentative de résolution échouait avec une erreur de validation.
2. **Réponse à un litige :** envoyait `{message: "..."}`. Le backend attend `{content: "..."}`, champ obligatoire. Chaque tentative de réponse échouait, pour tout le monde.
3. **Autorisation trop stricte :** même en corrigeant le nom du champ, seule la personne ayant *ouvert* le litige était autorisée à répondre (`opened_by=$2` uniquement dans la requête SQL). L'autre partie — celle qui doit se défendre — recevait une erreur 403.
4. **Historique invisible :** `GET /disputes/:id` ne renvoyait jamais de champ `messages`, alors que l'écran l'attend pour afficher les échanges. Résultat : « Aucun échange. » en permanence, même si des messages avaient été sauvegardés en base.

En bonus : le champ « Description » saisi à la création d'un litige était silencieusement perdu — la table `disputes` n'a pas de colonne `description` (seulement `reason`), et le corps de requête n'étant pas validé en mode strict, le champ était accepté puis jeté sans erreur ni avertissement.

### 3. Notifications — même famille de bug que le chat

`GET /notifications` renvoyait un tableau brut ; le frontend attendait `{items: [...], unreadCount: n}`. Résultat : liste toujours vide, badge de non-lus toujours à 0. Le champ `read` (booléen) attendu par le frontend n'a jamais existé — la colonne réelle est `read_at` (timestamp nullable). Le paramètre `?cursor=` que le frontend envoyait déjà pour la pagination était totalement ignoré côté backend.

### 4. Fil social — le décalage le plus étendu de tout l'audit

`GET /feed` renvoyait les colonnes brutes de la table (`kind`, `caption`, `media_url`, `author_id`, `like_count`, `comment_count`), alors que l'écran attend `type`, `description`, `video_url`/`thumbnail_url`, `vendor_id`/`vendor_name`, `likes_count`/`comments_count` (pluriel), plus `product_name`, `product_price`, `shares_count`, `liked`, `following` — dont aucun n'était calculé côté backend. Concrètement, **chaque carte du fil s'affichait vide** : pas de nom de vendeur, pas d'image, pas de texte, compteurs à zéro, bouton produit sans nom. Rien ne plantait grâce aux valeurs de repli de l'écran (`|| 'Contenu LIVI'`, `|| 0`), ce qui rendait le problème invisible sans lire le code.

Deux bugs plus ciblés dans le même domaine :
- `GET /live/:id` (détail d'un live) ne renvoyait pas le nom du vendeur, contrairement à `GET /live/active` (la liste) qui le fait — l'écran de détail affichait toujours « Vendeur » générique.
- `GET /vendor/subscriptions`, utilisé par l'écran « Outils créateur » pour afficher le nombre d'abonnés, interrogeait la table dans le mauvais sens : « qui je suis » au lieu de « qui me suit ». Un compte vendeur ne suivant généralement personne, ce compteur affichait quasi toujours 0.

Non corrigé, à noter : `socialApi.comments()` (lister les commentaires d'un post) existe côté backend et frontend mais **n'est appelé nulle part** — on peut poster un commentaire mais jamais voir la liste. C'est une fonctionnalité incomplète, pas un bug de forme de données ; je ne l'ai pas construite dans cette passe.

---

## B. Corrections effectuées

| # | Domaine | Fichiers | Cause | Correction |
|---|---|---|---|---|
| 1 | Chat | `chat.js`, `sellerApi.ts`, `Buyer/SellerMessagesScreen.tsx` | Forme de réponse mal supposée (objet vs tableau brut), `sender_role` inexistant | Lecture directe des tableaux/objets réels ; alignement des bulles via `sender_id === user.id` ; `GET /conversations` enrichi (nom du contact, aperçu, non-lus) |
| 2 | Litiges | `compatibility.js`, `types.ts`, `DisputeDetailsScreen.tsx`, `CreateDisputeScreen.tsx` | Payload résolution incorrect (texte libre vs enum+note), champ `message` vs `content`, autorisation trop stricte, `messages` jamais renvoyé, `description` perdue | Nouvelle UI résolution (boutons libérer/rembourser + note) ; `reply()` envoie `content` ; autorisation élargie à acheteur/vendeur/ouvreur ; `GET /disputes/:id` renvoie l'historique réel ; description fusionnée dans `reason` |
| 3 | Notifications | `notifications.js`, `types.ts`, `NotificationsProvider.tsx`, `NotificationsScreen.tsx` | Tableau brut vs objet `{items, unreadCount}` attendu, `read` inexistant, curseur ignoré | Backend renvoie `{items, next_cursor, unread_count}` avec pagination réelle ; champs alignés sur `read_at`/`created_at` |
| 4 | Fil social | `compatibility.js` | Quasi tous les champs renommés ou absents (voir liste ci-dessus) | Requête réécrite avec les bons alias + jointure produit + sous-requêtes liked/following/shares_count |
| 5 | Live (détail + abonnés) | `compatibility.js` | Jointure vendor_name manquante ; sens de la requête abonnés inversé | Jointure ajoutée ; `WHERE following_id=$1` au lieu de `follower_id=$1` |

**Test effectué pour chacune :** relecture ligne à ligne du fichier corrigé, vérification de la requête SQL sous-jacente et du schéma réel des tables concernées (`migrations/032_v46_frontend_backend_unification.sql`), et confirmation qu'aucun autre appelant ne dépend de l'ancien comportement. Comme pour la partie 1 : pas d'exécution réelle possible dans ce bac à sable (pas de réseau, pas de base de données) — un test manuel sur un environnement de staging reste nécessaire avant mise en production, en particulier pour le fil social où la requête est la plus complexe des cinq.

Fichiers livrés dans **`CORRECTIONS_COMPLETES.zip`** — il regroupe *toutes* les corrections faites jusqu'ici (partie 1 + partie 2), avec les mêmes chemins que votre dépôt. Il remplace `CORRECTIONS_KYC_ESCROW.zip` du premier message (celui-ci est inclus dedans, pas besoin de garder les deux).

---

## C. Ce qui reste à vérifier dans ces 4 domaines

Je n'ai pas trouvé d'autre bug bloquant, mais je n'ai pas non plus tout testé en conditions réelles :
- Le `EXISTS`/sous-requêtes ajoutées à `GET /feed` doivent être vérifiées sous charge (elles s'exécutent par ligne — acceptable pour un fil de 50-100 posts, à surveiller si le volume grandit).
- `POST /disputes/:id/resolve` déclenche la libération/remboursement d'escrow (déjà durci en V37, cf. partie 1) — je n'ai pas re-testé ce chemin financier avec les nouveaux boutons, seulement vérifié que le payload envoyé correspond maintenant au schéma attendu.
- La liste des commentaires (`socialApi.comments()`) reste à construire côté UI si vous voulez que les commentaires soient visibles, pas seulement postables.

## D. Parcours — mise à jour

| Parcours | Statut (partie 1) | Statut (après partie 2) |
|---|---|---|
| MESSAGERIE | Non audité | **1 bug critique corrigé** |
| LITIGES | Non audité | **4 bugs critiques corrigés** |
| NOTIFICATIONS | Non audité | **1 bug critique corrigé** |
| SOCIAL / LIVE | Non audité | **1 bug étendu + 2 bugs ciblés corrigés** |

## E. Chiffres

- Bugs confirmés et corrigés cette session : **7** (contre 2 en partie 1, total **9**)
- Fichiers modifiés cette session : **11** backend/frontend (total cumulé **15**, cf. `CORRECTIONS_COMPLETES.zip`)
- Fonctionnalité identifiée comme incomplète (backend + frontend existent, jamais reliés) : **1** (liste des commentaires d'un post)

---

Chat, litiges, notifications et social/live sont maintenant audités. Il reste, du plan initial : le nettoyage des doublons identifiés en partie 1 (adresses, produits, retraits, KYC), les écrans admin manquants, et un audit approfondi du CRUD admin générique. Par où continue-t-on ?

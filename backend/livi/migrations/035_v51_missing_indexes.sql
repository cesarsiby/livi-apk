-- V51 — audit base de données : indexes manquants confirmés par des
-- requêtes réellement présentes dans src/ (pas un balayage aveugle de
-- toutes les FK — voir le rapport final pour la liste des FK volontairement
-- laissées sans index dédié, déjà couvertes par une PK/UNIQUE composite ou
-- à trop faible trafic pour le justifier).

-- order_items.order_id : lu à chaque affichage de détail de commande
-- (GET /orders/:id agrège order_items via un sous-select WHERE order_id=o.id).
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- product_media.product_id : lu/écrit à plusieurs endroits (liste des
-- médias d'un produit, upload, vérification de comptage) dans
-- src/routes/products.js et src/routes/compatibility.js.
CREATE INDEX IF NOT EXISTS product_media_product_id_idx ON product_media(product_id);

-- user_addresses.user_id : GET /users/me/addresses filtre par user_id seul ;
-- seule la PK (id) existait jusqu'ici.
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON user_addresses(user_id);

-- conversation_members.user_id : la PK est (conversation_id, user_id), donc
-- une recherche par user_id seul (GET /conversations : "mes conversations")
-- ne peut pas s'appuyer dessus en tête de composite. Index dédié nécessaire
-- pour éviter un scan complet de la table à chaque ouverture de la messagerie.
CREATE INDEX IF NOT EXISTS conversation_members_user_id_idx ON conversation_members(user_id);

-- social_posts.created_at : le fil social principal (feed) fait
-- `ORDER BY created_at DESC LIMIT n` SANS aucun WHERE — sans index, c'est un
-- scan + tri complet de la table à chaque appel, pour tous les utilisateurs.
CREATE INDEX IF NOT EXISTS social_posts_created_at_idx ON social_posts(created_at DESC);

-- social_comments.post_id : pas de PK/UNIQUE composite possible ici (un
-- utilisateur peut commenter plusieurs fois) ; utilisé par le compteur du
-- feed et par la liste de commentaires d'un post.
CREATE INDEX IF NOT EXISTS social_comments_post_id_idx ON social_comments(post_id);

-- social_shares.post_id : même situation que social_comments — pas de
-- contrainte d'unicité naturelle, utilisé par le compteur du feed.
CREATE INDEX IF NOT EXISTS social_shares_post_id_idx ON social_shares(post_id);

-- social_follows.following_id : la PK est (follower_id, following_id).
-- GET /vendor/subscriptions filtre par following_id seul ("qui me suit"),
-- la colonne finale d'une PK composite n'est pas exploitable pour cette
-- recherche sans index dédié.
CREATE INDEX IF NOT EXISTS social_follows_following_id_idx ON social_follows(following_id);

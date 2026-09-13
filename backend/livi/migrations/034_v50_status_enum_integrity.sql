-- V50 — audit base de données (mission "AUDIT ET FINALISATION EXCLUSIVE DES
-- MIGRATIONS"). Un croisement complet backend <-> migrations a montré que
-- plusieurs colonnes de statut/enum, fermées et appliquées côté backend
-- (zod, tables de transition explicites), n'avaient AUCUNE contrainte CHECK
-- en base : une faute de frappe ou un futur chemin de code aurait pu écrire
-- une valeur invalide sans que Postgres ne s'y oppose, cassant en silence
-- les triggers/garde-fous qui comparent ces chaînes ailleurs (V13, V18,
-- V19, V20, V29, V30...).
--
-- Chaque liste de valeurs ci-dessous a été confirmée par grep exhaustif des
-- sites d'écriture réels dans src/ et scripts/ (jamais par supposition).
-- Détail complet des preuves : voir le rapport final, section "Enums / CHECK".

-- orders.status : orderLifecycle.js (ORDER_TRANSITIONS) est la seule source
-- de vérité applicative ; ce sont les 10 seules valeurs jamais écrites
-- (aucune autre chaîne trouvée dans un `orders SET status=`).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending_payment','payment_pending','paid','preparing','shipping',
  'delivered','disputed','completed','cancelled','refunded'
));

-- disputes.status : seules 'open' (défaut) et 'resolved' sont jamais
-- écrites (src/routes/disputes.js). closed_at est toujours posé en même
-- temps que 'resolved', jamais comme un 3e état indépendant.
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_status_check CHECK (status IN ('open','resolved'));

-- disputes.category : correspond exactement à l'enum zod d'ouverture de
-- litige (openSchema.category, défaut 'other'). Colonne nullable en base
-- (aucun NOT NULL) donc la contrainte tolère explicitement NULL.
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_category_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_category_check CHECK (
  category IS NULL OR category IN ('non_delivery','damaged','wrong_item','fraud','other')
);

-- kyc_documents.document_type : ÉLARGISSEMENT, pas restriction. La route
-- réelle de soumission (POST /users/me/kyc, src/routes/compatibility.js)
-- calcule `document_type = document_type || step || 'identity'` sans
-- aucune liste blanche avant l'INSERT. 'identity' — son propre fallback
-- par défaut — n'était pas dans la contrainte existante (posée en V25,
-- élargie en V46) : toute soumission sans document_type/step explicite
-- échoue donc aujourd'hui avec une violation CHECK en base. La constante
-- KYC_DOCUMENT_TYPES de src/routes/kyc.js déclare déjà l'ensemble complet
-- voulu ; cette migration aligne la base sur cet ensemble déclaré. Le
-- résidu applicatif (constante toujours non importée/non appliquée par la
-- route réelle) est documenté dans le rapport final, hors périmètre
-- migrations strict.
ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_document_type_check;
ALTER TABLE kyc_documents ADD CONSTRAINT kyc_document_type_check CHECK (document_type IN (
  'cni','passport','permis','assurance','business_registration','tax_document',
  'identity','business','address','other'
));

-- kyc_documents.status : correspond exactement à l'enum zod de revue
-- (src/routes/kyc.js, reviewSchema: z.enum(['approved','rejected'])) plus
-- le défaut 'pending'.
ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_status_check;
ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_status_check CHECK (status IN ('pending','approved','rejected'));

-- transporters.availability : correspond exactement à l'enum zod utilisé
-- pour valider PATCH /transporter/availability (src/routes/compatibility.js).
ALTER TABLE transporters DROP CONSTRAINT IF EXISTS transporters_availability_check;
ALTER TABLE transporters ADD CONSTRAINT transporters_availability_check CHECK (availability IN ('online','offline','busy'));

-- live_shops.status : seules 'live' (défaut) et 'ended' sont jamais
-- écrites (POST /vendor/live/start, POST /vendor/live/:id/end).
ALTER TABLE live_shops DROP CONSTRAINT IF EXISTS live_shops_status_check;
ALTER TABLE live_shops ADD CONSTRAINT live_shops_status_check CHECK (status IN ('live','ended'));

-- vendor_videos.status : seules 'published' (défaut) et 'deleted'
-- (suppression douce via DELETE /vendor/videos/:id) sont jamais écrites.
ALTER TABLE vendor_videos DROP CONSTRAINT IF EXISTS vendor_videos_status_check;
ALTER TABLE vendor_videos ADD CONSTRAINT vendor_videos_status_check CHECK (status IN ('published','deleted'));

-- shipments.status : ensemble complet des valeurs lues ou écrites par le
-- code réel (src/routes/delivery.js, src/routes/compatibility.js —
-- accept/reject/pickup/arrive/deliver, /transporter/location,
-- /transporter/dashboard). 'in_transit' est inclus car /arrive et
-- verifyDeliveryProof() l'exigent tous les deux ; 'cancelled' est inclus
-- car le tableau de bord transporteur l'exclut explicitement de ses
-- compteurs. NOTE : cette contrainte valide seulement les VALEURS ; elle
-- ne corrige pas — et ne doit pas corriger — l'absence confirmée d'une
-- transition picked_up -> in_transit côté applicatif (voir rapport final,
-- constat critique hors périmètre migrations).
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check CHECK (status IN (
  'pending','assigned','rejected','picked_up','in_transit','arrived','delivered','cancelled'
));

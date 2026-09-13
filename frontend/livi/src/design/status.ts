// ═══════════════════════════════════════════════════════════════
// LIVI 2.0 — Registre des statuts (source unique de vérité)
//
// Tout statut affiché dans l'app (commande, escrow, livraison, retrait,
// litige, KYC, mission transporteur) doit passer par ce fichier plutôt
// que d'être écrit en dur dans chaque écran avec ses propres libellés.
//
// Les clés ci-dessous sont recopiées telles quelles depuis les contraintes
// CHECK des migrations backend — ce ne sont pas des libellés inventés :
//   - orders.status            → migrations/034_v50_status_enum_integrity.sql
//   - escrow_transactions.status → migrations/034_v50_status_enum_integrity.sql
//   - shipments.status         → migrations/034_v50_status_enum_integrity.sql
//   - disputes.status          → migrations/034_v50_status_enum_integrity.sql
//   - kyc_documents.status     → migrations/034_v50_status_enum_integrity.sql
//   - payout_requests.status   → migrations/003_production_hardening.sql
//   - shipment_offers.status   → migrations/039_v54_mission_dispatch.sql
//
// Remplace l'ancien `escrowStatusColor` de theme.ts, qui utilisait des clés
// ('pending', 'locked') ne correspondant à AUCUN statut réellement émis par
// le backend, et n'était d'ailleurs jamais importé nulle part dans l'app
// (voir RAPPORT_UXUI_SESSION21_AUDIT.md, constat C8).
// ═══════════════════════════════════════════════════════════════

export type StatusVariant = 'gold' | 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gray';

export type StatusDomain =
  | 'order'
  | 'escrow'
  | 'delivery'
  | 'payout'
  | 'dispute'
  | 'kyc'
  | 'mission'
  | 'transporterAvailability';

type StatusMeta = { label: string; variant: StatusVariant; helper?: string };

const REGISTRY: Record<StatusDomain, Record<string, StatusMeta>> = {
  order: {
    pending_payment: { label: 'Paiement à finaliser', variant: 'gray', helper: "Le paiement n'a pas encore été initié." },
    payment_pending: { label: 'Paiement en cours', variant: 'gold', helper: 'Le paiement est en cours de confirmation.' },
    paid: { label: 'Payée', variant: 'blue', helper: 'Le vendeur va préparer la commande.' },
    preparing: { label: 'En préparation', variant: 'blue', helper: 'Le vendeur prépare votre commande.' },
    shipping: { label: 'En livraison', variant: 'blue', helper: 'Un transporteur achemine votre commande.' },
    delivered: { label: 'Livrée', variant: 'green', helper: 'Confirmez la réception pour libérer les fonds au vendeur.' },
    completed: { label: 'Terminée', variant: 'green', helper: 'Commande finalisée.' },
    disputed: { label: 'En litige', variant: 'red', helper: 'Un litige est en cours de traitement.' },
    cancelled: { label: 'Annulée', variant: 'gray' },
    refunded: { label: 'Remboursée', variant: 'orange', helper: 'Les fonds ont été remboursés.' },
  },
  escrow: {
    awaiting_payment: { label: 'En attente de paiement', variant: 'gray' },
    payment_pending: { label: 'Paiement en cours', variant: 'gold' },
    funded: { label: 'Fonds protégés', variant: 'blue', helper: "L'argent est retenu par LIVI jusqu'à la confirmation de réception." },
    released: { label: 'Fonds libérés', variant: 'green', helper: 'Les fonds ont été versés au vendeur.' },
    refunded: { label: 'Remboursé', variant: 'orange' },
    disputed: { label: 'En litige', variant: 'red', helper: 'Les fonds restent protégés le temps du litige.' },
    cancelled: { label: 'Annulé', variant: 'gray' },
  },
  delivery: {
    pending: { label: 'En attente d\u2019un transporteur', variant: 'gray' },
    assigned: { label: 'Transporteur assigné', variant: 'blue' },
    rejected: { label: 'Refusée', variant: 'red' },
    picked_up: { label: 'Colis récupéré', variant: 'blue' },
    in_transit: { label: 'En route', variant: 'blue' },
    arrived: { label: 'Arrivé à destination', variant: 'gold' },
    delivered: { label: 'Livré', variant: 'green' },
    cancelled: { label: 'Annulée', variant: 'gray' },
  },
  payout: {
    pending: { label: 'Demande reçue', variant: 'gray' },
    processing: { label: 'En traitement', variant: 'gold' },
    paid: { label: 'Envoyé', variant: 'green' },
    failed: { label: 'Échec', variant: 'red' },
    cancelled: { label: 'Annulé', variant: 'gray' },
  },
  dispute: {
    open: { label: 'En cours d\u2019examen', variant: 'orange' },
    resolved: { label: 'Résolu', variant: 'green' },
  },
  kyc: {
    pending: { label: 'En vérification', variant: 'gold' },
    approved: { label: 'Vérifié', variant: 'green' },
    rejected: { label: 'Non validé', variant: 'red' },
  },
  mission: {
    pending: { label: 'Proposition en attente', variant: 'gold' },
    accepted: { label: 'Acceptée', variant: 'green' },
    refused: { label: 'Refusée', variant: 'gray' },
    expired: { label: 'Expirée', variant: 'gray' },
    cancelled: { label: 'Annulée', variant: 'gray' },
  },
  transporterAvailability: {
    online: { label: 'Disponible', variant: 'green' },
    offline: { label: 'Hors ligne', variant: 'gray' },
    busy: { label: 'En mission', variant: 'blue' },
  },
};

/**
 * Retourne le libellé FR + la couleur pour un couple (domaine, statut).
 * Si le statut n'est pas encore cartographié ici, on retombe sur une
 * version lisible de la valeur brute plutôt que de planter ou d'inventer
 * un sens — voir RAPPORT_UXUI_SESSION21_AUDIT.md sur ce choix.
 */
export function getStatusMeta(domain: StatusDomain, status?: string | null): StatusMeta {
  if (!status) return { label: 'Statut inconnu', variant: 'gray' };
  const entry = REGISTRY[domain]?.[status];
  if (entry) return entry;
  return { label: humanize(status), variant: 'gray' };
}

function humanize(raw: string): string {
  const spaced = raw.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

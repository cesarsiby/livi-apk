import { apiRequest } from '../../services/api/client';

export type Order = {
  id: string;
  reference?: string;
  status?: string;
  payment_status?: string;
  delivery_status?: string;
  // LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C0-bis) : la colonne réelle de
  // la table `orders` est `total_amount` (migrations/001_initial.sql), pas
  // `total` — GET /orders et GET /orders/:id renvoient donc total_amount,
  // jamais total. `total` était lu partout (OrderCard, OrderDetailsScreen,
  // SellerOrdersScreen) et affichait 0 FCFA en permanence — même famille de
  // bug que price/price_xof déjà documentée dans catalogueApi.ts. On garde
  // `total` en fallback au cas où un futur endpoint l'utiliserait vraiment,
  // mais total_amount doit être lu en priorité.
  total_amount?: number;
  total?: number;
  subtotal_amount?: number;
  shipping_fee?: number;
  currency?: string;
  created_at?: string;
  items?: any[];
  shipping_address?: any;
  tracking?: any;
  // V54: needed for post-delivery ratings (vendor + transporter) and the
  // 10-minute dispute window — both previously missing from this type/the
  // backend response (transporter_id) or just never read (delivered_at,
  // buyer_id, vendor_id, already present on `o.*` but undeclared).
  buyer_id?: string;
  vendor_id?: string;
  transporter_id?: string | null;
  delivered_at?: string | null;
};

// GET /orders/:id/delivery-proof — available once a transporter has accepted
// the mission. Before that, the backend returns 409 PROOF_UNAVAILABLE.
export type DeliveryProof = { pin: string; qr_payload: string; expires_at: string };

export const ordersApi = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<any>(`/orders?${qs}`);
  },

  get: (id: string) => apiRequest<Order>(`/orders/${encodeURIComponent(id)}`),

  deliveryProof: (id: string) => apiRequest<DeliveryProof>(`/orders/${encodeURIComponent(id)}/delivery-proof`),

  confirmReceipt: (id: string, payload: { pin?: string; qr_token?: string }) =>
    apiRequest<any>(`/orders/${encodeURIComponent(id)}/confirm-receipt`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  review: (id: string, payload: {product_id:string;rating:number;comment?:string}) => apiRequest<any>(`/orders/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(payload) }),

  cancel: (id: string, reason?: string) =>
    apiRequest<any>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

import { apiRequest } from '../../services/api/client';

export type Mission = {
  id: string; reference?: string; status?: string; pickup_status?: string; delivery_status?: string;
  order_id?: string; pickup?: unknown; dropoff?: unknown; parcel?: unknown;
  // V54: sequential proximity dispatch (see services/missionDispatch.js) —
  // offered_to/offer_expires_at are set while a mission is proposed to this
  // transporter specifically, cleared once accepted or reassigned.
  transporter_id?: string | null; offered_to?: string | null; offer_expires_at?: string | null;
  // V54: pickup/delivery detail + fee, previously not returned at all.
  shipping_fee?: number | string;
  pickup_shop_name?: string; pickup_address?: string; pickup_city?: string; pickup_phone?: string;
  delivery_address_line?: string; delivery_city?: string; delivery_neighborhood?: string;
  delivery_landmark_type?: string; delivery_landmark_description?: string;
  delivery_recipient_name?: string; delivery_phone?: string;
  // V54: for post-delivery ratings (buyer + vendor).
  buyer_id?: string; vendor_id?: string; order_status?: string;
};

function qs(params: Record<string, string | number | boolean | undefined> = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]);
  return new URLSearchParams(entries).toString();
}

export const transporterApi = {
  dashboard: () => apiRequest<any>('/transporter/dashboard'),
  missions: (params: Record<string, string | number | boolean | undefined> = {}) => apiRequest<any>(`/transporter/missions?${qs(params)}`),
  mission: (id: string) => apiRequest<Mission>(`/transporter/missions/${encodeURIComponent(id)}`),
  acceptMission: (id: string) => apiRequest<any>(`/transporter/missions/${encodeURIComponent(id)}/accept`, { method: 'POST' }),
  rejectMission: (id: string, reason?: string) => apiRequest<any>(`/transporter/missions/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  pickup: (id: string, payload: { pin?: string; qr_token?: string }) => apiRequest<any>(`/transporter/missions/${encodeURIComponent(id)}/pickup`, { method: 'POST', body: JSON.stringify(payload) }),
  arrive: (id: string, payload?: { latitude?: number; longitude?: number; accuracy?: number }) => apiRequest<any>(`/transporter/missions/${encodeURIComponent(id)}/arrive`, { method: 'POST', body: JSON.stringify(payload ?? {}) }),
  deliver: (id: string, payload: { pin?: string; qr_token?: string }) => apiRequest<any>(`/transporter/missions/${encodeURIComponent(id)}/deliver`, { method: 'POST', body: JSON.stringify(payload) }),
  updateLocation: (latitude: number, longitude: number, accuracy?: number) => apiRequest<any>('/transporter/location', { method: 'POST', body: JSON.stringify({ lat: latitude, lng: longitude, accuracy }) }),
  setAvailability: (status: 'online' | 'offline' | 'busy') => apiRequest<any>('/transporter/availability', { method: 'PATCH', body: JSON.stringify({ status }) }),
  // GET/PATCH /transporter/profile (src/routes/compatibility.js) — the only
  // place to read availability/vehicle_type/vehicle_plate/kyc_status for the
  // signed-in transporter; there was previously no GET at all (PATCH
  // .../availability is write-only).
  profile: () => apiRequest<{ id: string; availability: string; kyc_status: string; vehicle_type: string | null; vehicle_plate: string | null; certified_at: string | null }>('/transporter/profile'),
  updateVehicle: (payload: { vehicle_type?: string; vehicle_plate?: string }) => apiRequest<any>('/transporter/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  earnings: (params: Record<string, string | number | undefined> = {}) => apiRequest<any>(`/transporter/earnings?${qs(params)}`),
  wallet: () => apiRequest<any>('/transporter/wallet'),
  requestPayout: (payload: Record<string, unknown>) => apiRequest<any>('/payouts', { method: 'POST', body: JSON.stringify({ ...payload, amount_xof: Number((payload as any).amount_xof ?? (payload as any).amount) }) }),
  history: (params: Record<string, string | number | undefined> = {}) => apiRequest<any>(`/transporter/history?${qs(params)}`),
  scanQR: (code: string) => apiRequest<any>('/transporter/qr/scan', { method: 'POST', body: JSON.stringify({ qr_code: code }) }),
};

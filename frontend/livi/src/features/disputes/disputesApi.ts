import { apiRequest } from '../../services/api/client';
import type { CreateDisputePayload, Dispute, DisputeListResponse, ReplyDisputePayload, ResolveDisputePayload } from './types';

/**
 * Unified v46 backend contract boundary. Paths, payloads and response envelopes are normalized by the shared API client.
 */
export const DISPUTE_API_ROUTES = {
  list: '/disputes',
  create: '/disputes',
  detail: (id: string) => `/disputes/${encodeURIComponent(id)}`,
  reply: (id: string) => `/disputes/${encodeURIComponent(id)}/messages`,
  resolve: (id: string) => `/disputes/${encodeURIComponent(id)}/resolve`,
} as const;

export const disputesApi = {
  list: () => apiRequest<DisputeListResponse>(DISPUTE_API_ROUTES.list),
  get: (id: string) => apiRequest<Dispute>(DISPUTE_API_ROUTES.detail(id)),
  create: (payload: CreateDisputePayload) => apiRequest<Dispute>(DISPUTE_API_ROUTES.create, { method: 'POST', body: JSON.stringify(payload) }),
  reply: (id: string, payload: ReplyDisputePayload) => apiRequest<Dispute>(DISPUTE_API_ROUTES.reply(id), { method: 'POST', body: JSON.stringify(payload) }),
  resolve: (id: string, payload: ResolveDisputePayload) => apiRequest<Dispute>(DISPUTE_API_ROUTES.resolve(id), { method: 'POST', body: JSON.stringify(payload) }),
};

export function normalizeDisputes(response: DisputeListResponse): Dispute[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? response.disputes ?? [];
}

import { apiRequest } from '../../services/api/client';

export const escrowApi = {
  dashboard: () => apiRequest<any>('/escrow/balance'),
  balance: () => apiRequest<any>('/escrow/balance'),
  transactions: (params: Record<string, string | number> = {}) => apiRequest<any>(`/escrow/transactions?${new URLSearchParams(params as Record<string,string>).toString()}`),
  // GET /escrow/transactions/:id — the list route ignores query params and
  // always returns the same page, so a ?transaction_id= filter silently did
  // nothing. Matches the fix already applied to walletApi.ts's getTransaction.
  transaction: (id: string) => apiRequest<any>(`/escrow/transactions/${encodeURIComponent(id)}`),
};

import { apiRequest } from '../../services/api/client';
import type { AdminCollection, AdminDashboard, AdminRecord } from './types';

/**
 * V10 backend contract boundary.
 * Backend compatibility contract: routes are implemented server-side in the unified v46 compatibility layer.
 * Keep all assumptions here until the real backend contract is supplied.
 */
export const ADMIN_API_ROUTES = {
  dashboard: '/admin/dashboard',
  users: '/admin/users',
  sellers: '/admin/sellers',
  transporters: '/admin/transporters',
  orders: '/admin/orders',
  payments: '/admin/payments',
  escrow: '/admin/escrow',
  withdrawals: '/admin/withdrawals',
  disputes: '/admin/disputes',
  verifications: '/admin/verifications',
  products: '/admin/products',
  missions: '/admin/missions',
  logs: '/admin/logs',
} as const;

const list = (path: string, params: Record<string, string | number | undefined> = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]);
  const query = new URLSearchParams(entries).toString();
  return apiRequest<AdminCollection>(`${path}${query ? `?${query}` : ''}`);
};

export const adminApi = {
  getDashboard: () => apiRequest<AdminDashboard>(ADMIN_API_ROUTES.dashboard),
  listUsers: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.users, params),
  listSellers: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.sellers, params),
  listTransporters: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.transporters, params),
  listOrders: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.orders, params),
  listPayments: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.payments, params),
  listEscrow: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.escrow, params),
  listWithdrawals: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.withdrawals, params),
  listDisputes: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.disputes, params),
  listVerifications: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.verifications, params),
  listProducts: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.products, params),
  listMissions: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.missions, params),
  listLogs: (params?: Record<string, string | number | undefined>) => list(ADMIN_API_ROUTES.logs, params),

  // V48: the routes below all existed and worked server-side (kyc.js,
  // admin.js, finance.js, payouts.js) but had no caller anywhere in the
  // app — no screen, no navigation entry. Added so admins can actually
  // reach KYC review, the integrity check, fee/refund tools, partner
  // reconciliation, and payout processing from the mobile app.
  kycPending: () => apiRequest<any[]>('/kyc/admin/pending'),
  // POST /kyc/admin/:id/access-token (src/routes/kyc.js) already existed —
  // short-lived (300s), audited, admin-only signed token — but nothing
  // called it, so AdminKycReviewScreen had no way to ever preview a
  // document before approving/rejecting it.
  kycDocumentAccessToken: (id: string) => apiRequest<{ token: string; expires_in_seconds: number }>(`/kyc/admin/${encodeURIComponent(id)}/access-token`, { method: 'POST' }),
  kycReview: (id: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
    apiRequest<any>(`/kyc/admin/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ status, rejection_reason }) }),

  getIntegrity: () => apiRequest<{ ok: boolean; ledger_unbalanced: any[]; escrow_inconsistencies: any[] }>('/admin/integrity'),

  financeSummary: () => apiRequest<{ code: string; name: string; balance: string }[]>('/finance/summary'),
  feeRules: () => apiRequest<any[]>('/finance/fee-rule'),
  setFeeRule: (name: string, commission_bps: number) =>
    apiRequest<any>('/finance/fee-rule', { method: 'POST', body: JSON.stringify({ name, commission_bps }) }),
  refundOrder: (orderId: string, reason?: string) =>
    apiRequest<any>(`/finance/orders/${encodeURIComponent(orderId)}/refund`, { method: 'POST', body: JSON.stringify({ reason }) }),

  reconciliationRuns: () => apiRequest<any[]>('/admin/reconciliation/runs'),
  reconciliationRun: (id: string) => apiRequest<{ run: any; items: any[] }>(`/admin/reconciliation/runs/${encodeURIComponent(id)}`),
  correctionCases: () => apiRequest<any[]>('/admin/reconciliation/corrections'),
  approveCorrection: (id: string, reason?: string) =>
    apiRequest<any>(`/admin/reconciliation/corrections/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rejectCorrection: (id: string, reason?: string) =>
    apiRequest<any>(`/admin/reconciliation/corrections/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  executeCompensation: (id: string) =>
    apiRequest<any>(`/admin/reconciliation/corrections/${encodeURIComponent(id)}/execute-customer-compensation`, { method: 'POST' }),

  payoutsPending: () => apiRequest<any[]>('/payouts/admin/pending'),
  payoutMarkProcessing: (id: string) => apiRequest<any>(`/payouts/admin/${encodeURIComponent(id)}/mark-processing`, { method: 'POST' }),
  payoutFail: (id: string, reason?: string) => apiRequest<any>(`/payouts/admin/${encodeURIComponent(id)}/fail`, { method: 'POST', body: JSON.stringify({ reason }) }),
  payoutComplete: (id: string, provider: string, provider_reference: string) => apiRequest<any>(`/payouts/admin/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify({ provider, provider_reference }) }),

  /**
   * Generic administrative action boundary. No action is invented or executed
   * by the UI unless a concrete backend action contract is later mapped here.
   */
  executeAction: (path: string, payload: Record<string, unknown>) =>
    apiRequest<AdminRecord>(path, { method: 'POST', body: JSON.stringify(payload) }),
};

export function normalizeCollection(response: AdminCollection): AdminRecord[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? response.results ?? [];
}

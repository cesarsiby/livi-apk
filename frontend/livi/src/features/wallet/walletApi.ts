import { apiRequest } from '../../services/api/client';
import type {
  TransactionListResponse,
  WalletResponse,
  WalletTransaction,
  Withdrawal,
  WithdrawalListResponse,
} from './types';

/**
 * V47: confirmed against src/routes/escrow.js and src/routes/payouts.js —
 * these are the real backend routes, not hypotheses. wallet/transactions/
 * withdraw/withdrawals/withdrawal all matched as-is; transaction(id) below
 * previously pointed at a query param (?transaction_id=) the backend never
 * read (it just returned the same 100-row list), so it now uses the
 * dedicated GET /escrow/transactions/:id route added alongside this fix.
 * No component should hard-code wallet routes elsewhere.
 */
export const WALLET_API_ROUTES = {
  wallet: '/escrow/balance',
  transactions: '/escrow/transactions',
  transaction: (id: string) => `/escrow/transactions/${encodeURIComponent(id)}`,
  withdraw: '/payouts',
  withdrawals: '/payouts/mine',
  withdrawal: (id: string) => `/payouts/${encodeURIComponent(id)}`,
} as const;

export type WithdrawRequest = {
  amount: number;
  currency?: string;
  destination?: string;
  destination_ref?: string;
};

export const walletApi = {
  getWallet: () => apiRequest<WalletResponse>(WALLET_API_ROUTES.wallet),

  listTransactions: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    return apiRequest<TransactionListResponse>(
      `${WALLET_API_ROUTES.transactions}${qs ? `?${qs}` : ''}`,
    );
  },

  getTransaction: (id: string) =>
    apiRequest<WalletTransaction>(WALLET_API_ROUTES.transaction(id)),

  requestWithdrawal: (payload: WithdrawRequest) =>
    apiRequest<Withdrawal>(WALLET_API_ROUTES.withdraw, {
      method: 'POST',
      body: JSON.stringify({ amount_xof: payload.amount, currency: payload.currency ?? 'XOF', destination_ref: payload.destination_ref ?? payload.destination }),
    }),

  listWithdrawals: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    return apiRequest<WithdrawalListResponse>(
      `${WALLET_API_ROUTES.withdrawals}${qs ? `?${qs}` : ''}`,
    );
  },

  getWithdrawal: (id: string) =>
    apiRequest<Withdrawal>(WALLET_API_ROUTES.withdrawal(id)),
};

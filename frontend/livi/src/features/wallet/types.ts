// LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C0-quater — CRITIQUE) :
// GET /escrow/balance (routes/escrow.js) ne renvoie JAMAIS balance,
// available_balance ni pending_balance — ces trois champs n'existent nulle
// part dans la réponse réelle. Il renvoie :
//   - vendeur/transporteur : { currency, available_amount, locked_amount, owed_total }
//   - acheteur             : { currency, available_amount: '0' (toujours),
//                               locked_amount, active_order_count }
// Un acheteur n'a structurellement PAS de solde disponible/retirable : ses
// fonds sont soit "à venir" (pas encore payés), soit "en escrow" (payés,
// protégés jusqu'à réception), jamais un solde qu'il détiendrait lui-même.
// D'où available_amount hardcodé à '0' côté serveur pour ce rôle — ce n'est
// pas un bug backend, c'est le modèle métier réel, et l'écran doit
// l'assumer plutôt que le masquer.
export type Wallet = {
  id?: string;
  currency?: string;
  available_amount?: string | number;
  locked_amount?: string | number;
  owed_total?: string | number;
  active_order_count?: number;
  status?: string;
  updated_at?: string;
};

export type WalletTransaction = {
  id: string;
  reference?: string;
  type?: string;
  status?: string;
  amount?: number;
  currency?: string;
  description?: string;
  created_at?: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
};

export type Withdrawal = {
  id: string;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  fee?: number;
  net_amount?: number;
  created_at?: string;
  updated_at?: string;
  failure_reason?: string;
};

export type WalletResponse = Wallet & {
  wallet?: Wallet;
};

export type TransactionListResponse =
  | WalletTransaction[]
  | { data?: WalletTransaction[]; items?: WalletTransaction[]; transactions?: WalletTransaction[] };

export type WithdrawalListResponse =
  | Withdrawal[]
  | { data?: Withdrawal[]; items?: Withdrawal[]; withdrawals?: Withdrawal[] };

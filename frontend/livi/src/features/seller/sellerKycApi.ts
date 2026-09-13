import { apiRequest } from '../../services/api/client';

export type KycDocument = {
  id: string;
  document_type: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  rejection_reason?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
};

export const sellerKycApi = {
  me: () => apiRequest<any>('/users/me'),
  // GET /kyc/mine (backend/livi/src/routes/kyc.js) — the real source of KYC
  // document status. /users/me has no kyc/verification field; that data
  // never existed there.
  status: () => apiRequest<KycDocument[]>('/kyc/mine'),
};

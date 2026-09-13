import { apiRequest } from '../../services/api/client';

export type KycDocument = {
  id: string;
  document_type: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  rejection_reason?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
};

export type RoleDetail = {
  role: string;
  verified_at: string | null;
  kyc_level: number;
};

export const transporterKycApi = {
  // GET /users/me (src/routes/users.js) — role_details carries kyc_level and
  // verified_at per role the account holds; vendors.kyc_status /
  // transporters.kyc_status live on a different table entirely and aren't
  // returned here, which is why the overall status shown to the person is
  // computed from the documents below instead (same approach already used by
  // sellerKycApi/SellerKYCScreen).
  me: () => apiRequest<{ role_details: RoleDetail[] }>('/users/me'),
  // GET /kyc/mine (src/routes/kyc.js) — role-agnostic, filtered by the
  // authenticated user_id only.
  status: () => apiRequest<KycDocument[]>('/kyc/mine'),
};

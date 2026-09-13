export type UserRole = 'client' | 'vendor' | 'transporter' | 'admin';

export type AuthUser = {
  id: string;
  role: UserRole;
  name?: string;
  email?: string;
  phone?: string;
  roles?: UserRole[];
  role_details?: Array<{role: UserRole; verified_at?: string | null; kyc_level?: number}>;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  // Populated from issueSession()'s new `session_id` field (see
  // services/auth.js) — lets the client identify "this device's" row in
  // GET /auth/sessions so SecurityScreen can mark it instead of offering to
  // revoke the session the person is actively using.
  sessionId?: string;
  user: AuthUser;
};

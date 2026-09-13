import { apiRequest } from '../../services/api/client';
import type { AuthUser, UserRole } from '../../types/auth';

// V-AUDIT (OTP/SMS removal from account opening): 'login' and 'register'
// removed from this type. Registration and login are now phone+password,
// no OTP — 'password_reset' (ForgotPasswordScreen -> VerifyOtpScreen) is
// the only flow that still sends an OTP. See services/auth.js on the
// backend for the full removal rationale.
export type OtpPurpose = 'password_reset';

export type RegisterPayload = {
  role: Exclude<UserRole, 'admin'>;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
  password_confirmation: string;
};

type AuthSessionResponse = { token: string; refresh_token?: string; session_id?: string; user: AuthUser };

export const authApi = {
  // Returns a full session now (immediate account opening, no OTP step
  // after this) — was previously a fire-and-forget call whose result the
  // caller discarded, back when a separate OTP verification was what
  // actually established the session. See AuthProvider.register().
  register: (data: RegisterPayload) => apiRequest<AuthSessionResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  sendOtp: (phone: string, purpose?: OtpPurpose) => apiRequest('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone, purpose }) }),
  // POST /auth/password/reset (src/routes/auth.js) — verifies the OTP itself
  // (purpose='password_reset', see src/services/auth.js resetPasswordWithOtp)
  // and sets the new password in one call; this does not return a session,
  // so the person lands back on Login to sign in fresh.
  resetPassword: (phone: string, code: string, new_password: string) => apiRequest<{ reset: boolean }>('/auth/password/reset', { method: 'POST', body: JSON.stringify({ phone, code, new_password }) }),
  // retry401: false — a rejected refresh must fail immediately, not trigger
  // another refresh attempt on itself (client.ts's 401 handler would otherwise
  // call the very refresh handler that is already in the middle of running).
  refresh: (refresh_token: string) => apiRequest<AuthSessionResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }), retry401: false }),
  // V-AUDIT: return type now includes session_id, matching what the backend
  // actually always sends (every path funnels through issueSession() on the
  // backend, see services/auth.js) — it was missing from this type even
  // though register/refresh both already declared it, which would have
  // silently dropped it (as `undefined`) the moment AuthProvider.login()
  // tried to read data.session_id to populate AuthSession.sessionId.
  login: (phone: string, password: string) => apiRequest<AuthSessionResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  logout: (token?: string) => apiRequest('/auth/logout', { method: 'POST' }, token),
};

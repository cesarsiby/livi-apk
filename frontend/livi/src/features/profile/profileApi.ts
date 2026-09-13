import { apiRequest } from '../../services/api/client';
import type { Profile, SecuritySession } from './types';

/**
 * Backend contracts are centralized here. Endpoints must match the real LIVI API.
 */
export const profileApi = {
  getProfile: () => apiRequest<Profile>('/users/me'),
  updateProfile: (payload: Partial<Pick<Profile, 'name' | 'email' | 'phone'>>) =>
    apiRequest<Profile>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  listSessions: () => apiRequest<SecuritySession[]>('/auth/sessions'),
  // V47: was called with DELETE, but the backend only registers
  // POST /auth/sessions/:id/revoke (src/routes/authSessions.js). Express matches
  // routes by method+path, so every "log out this device" tap 404'd silently.
  revokeSession: (sessionId: string) =>
    apiRequest<void>(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST' }),
  // POST /auth/sessions/logout-all (src/routes/authSessions.js) already
  // existed on the backend with no frontend caller anywhere — see
  // SecurityScreen.tsx. Revokes every session for this account, including
  // the one making this call, so the caller should treat a successful
  // response as an immediate local sign-out too.
  logoutAll: () => apiRequest<{ revoked_count: number }>('/auth/sessions/logout-all', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<void>('/auth/sessions/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
};

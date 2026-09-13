import { apiRequest } from '../../services/api/client';
import type { NotificationItem, NotificationPage, RegisterPushTokenPayload } from './types';

/**
 * Unified v46 notification contract. Push registration remains provider-dependent and is not simulated.
 */
export const notificationsApi = {
  list: (cursor?: string) => apiRequest<NotificationPage>(`/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  markRead: (id: string) => apiRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () => apiRequest<void>('/notifications/read-all', { method: 'POST' }),
  registerPushToken: (payload: RegisterPushTokenPayload) => apiRequest<void>('/notifications/push-token', { method: 'POST', body: JSON.stringify(payload) }),
  unregisterPushToken: (token: string) => apiRequest<void>('/notifications/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),
};

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { notificationsApi } from './notificationsApi';
import type { NotificationItem } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type ContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const Context = createContext<ContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: React.PropsWithChildren) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const responseSubscription = useRef<Notifications.EventSubscription | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const page = await notificationsApi.list();
      setNotifications(page.items ?? []);
      setUnreadCount(page.unread_count ?? (page.items ?? []).filter(item => !item.read_at).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les notifications.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [session, refresh]);

  useEffect(() => {
    if (!session || !Device.isDevice) return;

    let mounted = true;
    const register = async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        let status = permissions.status;
        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted' || !mounted) return;

        const tokenResponse = await Notifications.getExpoPushTokenAsync();
        const token = tokenResponse.data;
        await notificationsApi.registerPushToken({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
      } catch {
        // Push registration is best-effort. It must never block authentication/navigation.
      }
    };

    void register();
    responseSubscription.current = Notifications.addNotificationResponseReceivedListener(() => {
      void refresh();
    });

    return () => {
      mounted = false;
      responseSubscription.current?.remove();
      responseSubscription.current = null;
    };
  }, [session, refresh]);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    setUnreadCount(current => Math.max(0, current - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  }, []);

  const value = useMemo(() => ({ notifications, unreadCount, loading, error, refresh, markRead, markAllRead }), [notifications, unreadCount, loading, error, refresh, markRead, markAllRead]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider');
  return value;
}

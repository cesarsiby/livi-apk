export type NotificationCategory = 'ORDER' | 'PAYMENT' | 'ESCROW' | 'DELIVERY' | 'WITHDRAWAL' | 'DISPUTE' | 'SECURITY' | 'SYSTEM' | string;

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: NotificationCategory;
  read_at: string | null;
  created_at: string;
  data?: Record<string, unknown>;
};

export type NotificationPage = {
  items: NotificationItem[];
  next_cursor?: string | null;
  unread_count: number;
};

export type RegisterPushTokenPayload = {
  token: string;
  platform: 'android' | 'ios';
  deviceId?: string;
};

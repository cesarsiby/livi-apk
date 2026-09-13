export type Profile = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
};

export type SecuritySession = {
  id: string;
  device_name?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  expires_at?: string;
  ip_address?: string | null;
  current?: boolean;
};

import { apiRequest } from '../../services/api/client';
import { uploadFile } from '../../services/api/upload';

export type LiveShop = {
  id: string;
  title?: string;
  vendor_id?: string;
  vendor_name?: string;
  stream_url?: string;
  thumbnail_url?: string;
  viewer_count?: number;
  status?: string;
};

export type VendorVideo = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  video_url?: string;
  thumbnail_url?: string;
  views?: number;
  likes?: number;
  sales?: number;
  revenue?: number;
  created_at?: string;
};

export const liveApi = {
  active: () => apiRequest<LiveShop[]>('/live/active'),
  get: (id: string) => apiRequest<LiveShop>(`/live/${encodeURIComponent(id)}`),
  vendorVideos: () => apiRequest<VendorVideo[]>('/vendor/videos'),
  uploadVideo: (uri: string, metadata: Record<string, string> = {}) => uploadFile<VendorVideo>('/vendor/videos', uri, 'video', metadata),
  deleteVideo: (id: string) => apiRequest<any>(`/vendor/videos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  videoAnalytics: (id: string) => apiRequest<any>(`/vendor/videos/${encodeURIComponent(id)}/analytics`),
  startLive: (payload: Record<string, unknown>) => apiRequest<LiveShop>('/vendor/live/start', { method: 'POST', body: JSON.stringify(payload) }),
  endLive: (id: string) => apiRequest<any>(`/vendor/live/${encodeURIComponent(id)}/end`, { method: 'POST' }),
  vendorSubscriptions: () => apiRequest<any[]>('/vendor/subscriptions'),
};

import { apiRequest } from '../../services/api/client';

export type FeedItem = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  poster_url?: string;
  vendor_id?: string;
  vendor_name?: string;
  product_id?: string;
  product_name?: string;
  product_price?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  liked?: boolean;
  following?: boolean;
};

export const socialApi = {
  feed: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return apiRequest<FeedItem[]>(`/feed?${qs}`);
  },
  like: (type: string, id: string) => apiRequest<any>(`/social/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  unlike: (type: string, id: string) => apiRequest<any>(`/social/${encodeURIComponent(id)}/like`, { method: 'DELETE' }),
  comments: (type: string, id: string) => apiRequest<any[]>(`/social/${encodeURIComponent(id)}/comments`),
  comment: (type: string, id: string, text: string) => apiRequest<any>(`/social/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  follow: (vendorId: string) => apiRequest<any>(`/social/vendors/${encodeURIComponent(vendorId)}/follow`, { method: 'POST' }),
  unfollow: (vendorId: string) => apiRequest<any>(`/social/vendors/${encodeURIComponent(vendorId)}/follow`, { method: 'DELETE' }),
  share: (type: string, id: string) => apiRequest<any>(`/social/${encodeURIComponent(id)}/share`, { method: 'POST' }),
};

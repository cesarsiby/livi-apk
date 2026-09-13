import { apiRequest } from '../../services/api/client';

// LIVI 2.0 (RAPPORT_UXUI_SESSION21, constat C0-ter) : GET /vendor/products
// fait SELECT * FROM products — la colonne réelle est price_xof (voir
// catalogueApi.ts, déjà documenté côté acheteur), jamais `price`. Ce type
// déclarait uniquement `price`, donc SellerProductsScreen affichait 0 FCFA
// pour chaque produit.
export type SellerProduct = { id:string; name?:string; title?:string; price?:number; price_xof?:number; currency?:string; stock?:number; status?:string; images?:string[] };
export type ProductVariant = { id:string; product_id:string; sku?:string|null; attributes:Record<string,unknown>; price_xof?:number|null; stock_qty:number; status:string };
export type SellerOrderItem = { id:string; product_id:string; product_name:string; quantity:number; unit_price:number; total_price:number };
export type SellerOrder = { id:string; reference?:string; status?:string; payment_status?:string; delivery_status?:string; total?:number; total_amount?:number; currency?:string; items?:SellerOrderItem[]; shipping_address?:any; transporter_id?:string|null };
// GET /orders/:id/pickup-proof — available once a transporter has accepted
// the mission (that's what triggers createProofs() backend-side). Before
// that, the backend returns 409 PROOF_UNAVAILABLE.
export type DeliveryProof = { pin:string; qr_payload:string; expires_at:string };

export const sellerApi = {
  dashboard: () => apiRequest<any>('/vendor/dashboard'),
  shop: () => apiRequest<any>('/vendor/shop'),
  updateShop: (payload: Record<string, unknown>) => apiRequest<any>('/vendor/shop', {method:'PATCH', body:JSON.stringify(payload)}),
  products: (params:Record<string,string|number>={}) => { const qs=new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)])).toString(); return apiRequest<any>(`/vendor/products?${qs}`); },
  createProduct: (payload:Record<string,unknown>) => apiRequest<SellerProduct>('/vendor/products',{method:'POST',body:JSON.stringify(payload)}),
  updateProduct: (id:string,payload:Record<string,unknown>) => apiRequest<SellerProduct>(`/vendor/products/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(payload)}),
  // V54 (RAPPORT — "VARIANTES PRODUITS"): GET/POST/PUT/DELETE
  // /vendor/products/:id/variants already existed with zero frontend
  // caller anywhere — a vendor could never actually create a size/color
  // variant through the app.
  variants: (productId:string) => apiRequest<ProductVariant[]>(`/vendor/products/${encodeURIComponent(productId)}/variants`),
  createVariant: (productId:string,payload:{sku?:string;attributes?:Record<string,unknown>;price_xof?:number;stock_qty?:number}) =>
    apiRequest<ProductVariant>(`/vendor/products/${encodeURIComponent(productId)}/variants`,{method:'POST',body:JSON.stringify(payload)}),
  updateVariant: (productId:string,variantId:string,payload:Partial<{sku:string;attributes:Record<string,unknown>;price_xof:number|null;stock_qty:number;status:string}>) =>
    apiRequest<ProductVariant>(`/vendor/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,{method:'PUT',body:JSON.stringify(payload)}),
  archiveVariant: (productId:string,variantId:string) =>
    apiRequest<any>(`/vendor/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,{method:'DELETE'}),
  deleteProduct: (id:string) => apiRequest<any>(`/vendor/products/${encodeURIComponent(id)}`,{method:'DELETE'}),
  updateProductStatus: (id:string,status:string) => apiRequest<any>(`/vendor/products/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({status})}),
  media: (id:string) => apiRequest<any[]>(`/vendor/products/${encodeURIComponent(id)}/media`),
  uploadMedia: (id:string,uri:string,altText?:string) => import('../../services/api/upload').then(({uploadFile})=>uploadFile<any>(`/vendor/products/${encodeURIComponent(id)}/media`,uri,'media',altText?{alt_text:altText}:{})),
  deleteMedia: (id:string,mediaId:string) => apiRequest<any>(`/vendor/products/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}`,{method:'DELETE'}),
  inventory: () => apiRequest<any>('/vendor/inventory'),
  updateStock: (id:string,quantity:number) => apiRequest<any>(`/vendor/inventory/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({quantity})}),
  orders: (params:Record<string,string|number>={}) => { const qs=new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)])).toString(); return apiRequest<any>(`/vendor/orders?${qs}`); },
  order: (id:string) => apiRequest<SellerOrder>(`/vendor/orders/${encodeURIComponent(id)}`),
  acceptOrder: (id:string) => apiRequest<any>(`/vendor/orders/${encodeURIComponent(id)}/confirm`,{method:'POST'}),
  pickupProof: (id:string) => apiRequest<DeliveryProof>(`/orders/${encodeURIComponent(id)}/pickup-proof`),
  prepareOrder: (id:string) => apiRequest<any>(`/vendor/orders/${encodeURIComponent(id)}/ready`,{method:'POST'}),
  analytics: (period:string='week') => apiRequest<any>(`/vendor/analytics?${new URLSearchParams({period})}`),
  payouts: async () => { const [payouts,wallet] = await Promise.all([apiRequest<any[]>('/payouts/mine'), apiRequest<any>('/escrow/balance')]); return { payouts, available_balance: wallet?.available_amount ?? '0' }; },
  requestPayout: (payload:Record<string,unknown>) => apiRequest<any>('/payouts',{method:'POST',body:JSON.stringify({ ...payload, amount_xof: Number((payload as any).amount_xof ?? (payload as any).amount) })}),
  videos: () => apiRequest<any>('/vendor/videos'),
  deleteVideo: (id:string) => apiRequest<any>(`/vendor/videos/${encodeURIComponent(id)}`,{method:'DELETE'}),
};

export type ChatConversation = {
  id: string;
  created_at: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  other_user: { id: string; name: string; role: string } | null;
};
export type ChatMessage = { id: string; sender_id: string; content: string; created_at: string };

// backend/livi/src/routes/chat.js wraps everything in {success,data,...} — apiRequest
// already unwraps that outer envelope. What's LEFT in `data` here is a bare array or
// a bare object, not {conversations:[...]} / {messages:[...]} / {message:{...}}. The
// screens used to guess at a nested key that never existed, so conversations/messages
// silently rendered as empty. Call sites now consume these return values directly.
export const sellerChatApi = {
  conversations: () => apiRequest<ChatConversation[]>('/chat/conversations'),
  messages: (id:string) => apiRequest<ChatMessage[]>(`/chat/conversations/${encodeURIComponent(id)}/messages`),
  send: (id:string,text:string) => apiRequest<ChatMessage>(`/chat/conversations/${encodeURIComponent(id)}/messages`,{method:'POST',body:JSON.stringify({content:text})}),
  markRead: (id:string) => apiRequest<{conversation_id:string; last_read_at:string}>(`/chat/conversations/${encodeURIComponent(id)}/read`,{method:'POST'}),
};

import { apiRequest } from '../../services/api/client';

export type Product = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  // V54: the backend has never returned a `price` field — only price_xof
  // (the vendor's base price) and, since the commission-passthrough
  // feature, display_price_xof (what the buyer actually pays). Every screen
  // reading `.price` was reading `undefined` and showing 0 FCFA everywhere,
  // catalogue and cart alike — see CatalogueScreen/ProductScreen/CartScreen/
  // cartStore.
  price_xof?: number;
  display_price_xof?: number;
  currency?: string;
  image?: string;
  images?: string[];
  rating?: number;
  stock?: number;
  vendor_id?: string;
  // Renvoyé par GET /products et /products/:id (routes/products.js,
  // `p.category_id`) mais absent de ce type jusqu'ici — nécessaire pour le
  // filtrage catalogue par catégorie côté client (LIVI 2.0), l'API
  // /products n'ayant pas de paramètre de filtre serveur par catégorie.
  category_id?: string;
};

export type ProductVariant = { id: string; sku?: string | null; attributes: Record<string, unknown>; price_xof?: number | null; stock_qty: number; display_price_xof: number };

export type ProductListResponse = {
  products?: Product[];
  data?: Product[];
  total?: number;
  page?: number;
  limit?: number;
};

const qs = (params: Record<string, string | number | boolean>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export const catalogueApi = {
  list: (params: Record<string, string | number | boolean> = {}) =>
    apiRequest<ProductListResponse>(`/products?${qs(params)}`),
  get: (id: string) => apiRequest<Product>(`/products/${id}`),
  featured: () => apiRequest<ProductListResponse>('/products/featured'),
  trending: () => apiRequest<ProductListResponse>('/products/trending'),
  search: (q: string, params: Record<string, string | number> = {}) =>
    apiRequest<ProductListResponse>(`/products/search?${qs({ q, ...params })}`),
  // V54: GET /products/:id/variants — the only existing variants route was
  // vendor-only, unusable while browsing the catalogue.
  variants: (productId: string) => apiRequest<ProductVariant[]>(`/products/${productId}/variants`),
};

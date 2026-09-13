import { apiRequest } from '../../services/api/client';

export const buyerApi = {
  me: () => apiRequest<any>('/users/me'),
  analytics: () => apiRequest<any>('/users/me/analytics'),
  addresses: () => apiRequest<any>('/users/me/addresses'),
  addAddress: (data: any) => apiRequest<any>('/users/me/addresses', { method: 'POST', body: JSON.stringify(data) }),
  updateAddress: (id: string, data: any) => apiRequest<any>(`/users/me/addresses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAddress: (id: string) => apiRequest<any>(`/users/me/addresses/${id}`, { method: 'DELETE' }),
  paymentMethods: () => apiRequest<any>('/users/me/payment-methods'),
  initiatePaymentMethod: (operator: string, phone: string) => apiRequest<any>('/users/me/payment-methods/initiate', { method: 'POST', body: JSON.stringify({ operator, phone }) }),
  verifyPaymentMethod: (sessionId: string, otp: string, isDefault: boolean) => apiRequest<any>('/users/me/payment-methods/verify', { method: 'POST', body: JSON.stringify({ session_id: sessionId, otp, is_default: isDefault }) }),
  resendPaymentMethodOtp: (sessionId: string) => apiRequest<any>('/users/me/payment-methods/resend-otp', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }),
  removePaymentMethod: (id: string) => apiRequest<any>(`/users/me/payment-methods/${id}`, { method: 'DELETE' }),
  setDefaultPaymentMethod: (id: string) => apiRequest<any>(`/users/me/payment-methods/${id}/default`, { method: 'PATCH' }),
  wishlist: () => apiRequest<any>('/users/me/wishlist'),
  removeWishlist: (productId: string) => apiRequest<any>(`/users/me/wishlist/${productId}`, { method: 'DELETE' }),
  addWishlist: (productId: string) => apiRequest<any>('/users/me/wishlist', { method: 'POST', body: JSON.stringify({ product_id: productId }) }),
  refunds: () => apiRequest<any>('/orders/refunds'),
};

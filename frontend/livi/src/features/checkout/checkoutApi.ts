import { apiRequest } from '../../services/api/client';
import type { CartLine } from '../cart/cartStore';

export type Address = { id: string; label?: string; name?: string; address?: string; line1?: string; city?: string };
export type PaymentMethod = { id: string; label?: string; type?: string; last4?: string };
export type OrderQuote = { subtotal_xof: number; shipping_fee_xof: number; total_xof: number; distance_km: number | null };

export const checkoutApi = {
  addresses: () => apiRequest<any>('/users/me/addresses'),
  paymentMethods: () => apiRequest<any>('/users/me/payment-methods'),
  // POST /orders/quote (src/routes/orders.js) — read-only preview of the
  // real, server-computed total (product price(s) + distance-based delivery
  // fee), so the person sees the true amount before committing to pay
  // instead of only the cart subtotal.
  quote: (lines: CartLine[], shippingAddressId: string) =>
    apiRequest<OrderQuote>('/orders/quote', { method: 'POST', body: JSON.stringify({
      items: lines.map(line => ({ product_id: line.product.id, product_variant_id: line.variant?.id, quantity: line.quantity })),
      delivery_address_id: shippingAddressId,
    })}),
  createOrder: (lines: CartLine[], shippingAddressId: string, paymentMethodId: string) =>
    apiRequest<any>('/orders', { method: 'POST', body: JSON.stringify({
      items: lines.map(line => ({ product_id: line.product.id, product_variant_id: line.variant?.id, quantity: line.quantity })),
      delivery_address_id: shippingAddressId,
    })}),
  initPayment: (orderId: string, amount: number, paymentMethodId: string) =>
    apiRequest<any>('/escrow/payment/init', { method: 'POST', body: JSON.stringify({
      order_id: orderId, amount, payment_method_id: paymentMethodId,
    })}),
  verifyPayment: (reference: string) =>
    apiRequest<any>(`/escrow/payment/${encodeURIComponent(reference)}/status`),
};

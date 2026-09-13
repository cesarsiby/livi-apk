import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Product, ProductVariant } from '../catalogue/catalogueApi';

// V54 (RAPPORT — "VARIANTES PRODUITS"): a cart line now optionally carries a
// selected variant. Two lines for the same product with different variants
// (or one with, one without) are genuinely different lines — priced and
// stocked independently — so they're matched by product+variant together,
// not by product id alone.
export type CartLine = { product: Product; variant?: ProductVariant; quantity: number };
const lineKey = (productId: string, variantId?: string) => `${productId}::${variantId ?? ''}`;

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (p: Product, q?: number, variant?: ProductVariant) => void;
  remove: (productId: string, variantId?: string) => void;
  setQuantity: (productId: string, q: number, variantId?: string) => void;
  clear: () => void;
};
const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: React.PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((s, x) => s + x.quantity, 0),
    subtotal: lines.reduce((s, x) => {
      const price = x.variant ? (x.variant.display_price_xof ?? x.variant.price_xof) : (x.product.display_price_xof ?? x.product.price_xof);
      return s + (Number(price) || 0) * x.quantity;
    }, 0),
    add(product, quantity = 1, variant) {
      setLines(current => {
        const key = lineKey(product.id, variant?.id);
        const existing = current.find(x => lineKey(x.product.id, x.variant?.id) === key);
        return existing
          ? current.map(x => lineKey(x.product.id, x.variant?.id) === key ? { ...x, quantity: x.quantity + quantity } : x)
          : [...current, { product, variant, quantity }];
      });
    },
    remove(productId, variantId) {
      const key = lineKey(productId, variantId);
      setLines(current => current.filter(x => lineKey(x.product.id, x.variant?.id) !== key));
    },
    setQuantity(productId, quantity, variantId) {
      const key = lineKey(productId, variantId);
      setLines(current => quantity <= 0
        ? current.filter(x => lineKey(x.product.id, x.variant?.id) !== key)
        : current.map(x => lineKey(x.product.id, x.variant?.id) === key ? { ...x, quantity } : x));
    },
    clear() { setLines([]); },
  }), [lines]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('useCart must be used inside CartProvider'); return value; }

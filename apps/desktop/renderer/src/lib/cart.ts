import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const CART_KEY = 'client-cart-v1';

export type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  image?: string | null;
};

type Cart = Record<string, CartItem>;

type CartContextValue = {
  cart: Cart;
  totalItems: number;
  totalPrice: number;
  addItem: (product: { id: string; name: string; salePrice: string; image?: string | null }, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function normalizeCart(stored: Record<string, Partial<CartItem>>): Cart {
  return Object.fromEntries(
    Object.entries(stored)
      .filter(([, item]) => item && typeof item.productId === 'string')
      .map(([id, item]) => [id, {
        productId: item.productId as string,
        productName: item.productName ?? 'Produit',
        quantity: Math.max(0, Number(item.quantity) || 0),
        unitPrice: Number(item.unitPrice) || 0,
        image: item.image ?? null,
      }]),
  );
}

export function readCart(): Cart {
  try {
    return normalizeCart(JSON.parse(localStorage.getItem(CART_KEY) ?? '{}') as Record<string, Partial<CartItem>>);
  } catch {
    return {};
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => readCart());

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_KEY) setCart(readCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    totalItems: Object.values(cart).reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: Object.values(cart).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem: (product, quantity = 1) => {
      setCart((current) => {
        const item = current[product.id] ?? {
          productId: product.id,
          productName: product.name,
          quantity: 0,
          unitPrice: Number(product.salePrice),
          image: product.image,
        };
        return { ...current, [product.id]: { ...item, quantity: item.quantity + Number(quantity) } };
      });
    },
    updateQuantity: (id, quantity) => {
      setCart((current) => {
        const next = { ...current };
        if (quantity <= 0) delete next[id];
        else if (next[id]) next[id] = { ...next[id], quantity: Number(quantity) };
        return next;
      });
    },
    clearCart: () => setCart({}),
  }), [cart]);

  return createElement(CartContext.Provider, { value }, children);
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}

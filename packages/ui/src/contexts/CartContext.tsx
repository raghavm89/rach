"use client";

/**
 * Persistent per-user billing cart.
 *
 * Loads the cart from the backend when the user is authenticated, so it follows
 * them across devices/sessions. Local edits are debounced and saved back to the
 * server (the backend is the source of truth and re-validates every write).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { cart as cartApi, type CartItem } from "../lib/api";

interface CartContextValue {
  items: CartItem[];
  /** Total quantity across all lines (used for the badge). */
  count: number;
  loading: boolean;
  setQty: (id: string, qty: number) => void;
  addItem: (id: string, qty?: number) => void;
  removeItem: (id: string) => void;
  /** Replace the whole cart (e.g. syncing from the billing quantity controls). */
  setItems: (items: CartItem[]) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [items, setItemsState] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from the backend whenever we get a token.
  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;

    if (!token) {
      setItemsState([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    cartApi
      .get(token)
      .then((d) => {
        if (!cancelled) setItemsState(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
        if (!cancelled) setItemsState([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          hydrated.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Persist (debounced) after the initial load has hydrated.
  useEffect(() => {
    if (!token || !hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      cartApi.save(token, items).catch(() => {});
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [items, token]);

  const setItems = useCallback((next: CartItem[]) => {
    setItemsState(next.filter((i) => i.qty > 0));
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItemsState((prev) => {
      const rest = prev.filter((i) => i.id !== id);
      return qty > 0 ? [...rest, { id, qty }] : rest;
    });
  }, []);

  const addItem = useCallback((id: string, qty = 1) => {
    setItemsState((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { id, qty }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItemsState((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItemsState([]), []);

  const count = items.reduce((n, i) => n + i.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, count, loading, setQty, addItem, removeItem, setItems, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

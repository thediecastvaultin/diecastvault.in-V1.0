import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BASE = "dv_cart_v1";
const GUEST_KEY = `${BASE}:guest`;

function keyFor(userId: string | null) {
  return userId ? `${BASE}:u:${userId}` : GUEST_KEY;
}

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  series: string;
  image: string | null;
  unitPriceCents: number;
  quantity: number;
  stock: number;
  isAddon?: boolean;
};

function read(key: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, items: CartItem[]) {
  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("dv:cart"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const keyRef = useRef<string>(GUEST_KEY);
  keyRef.current = keyFor(userId);

  useEffect(() => {
    let mounted = true;

    function applyUser(uid: string | null) {
      if (!mounted) return;
      const nextKey = keyFor(uid);
      // Migrate any guest cart into the user's cart on sign-in.
      if (uid) {
        const guest = read(GUEST_KEY);
        if (guest.length > 0) {
          const mine = read(nextKey);
          const merged = [...mine];
          for (const g of guest) {
            const found = merged.find((i) => i.productId === g.productId);
            if (found) {
              found.quantity = Math.min(g.stock, found.quantity + g.quantity);
            } else {
              merged.push(g);
            }
          }
          window.localStorage.setItem(nextKey, JSON.stringify(merged));
          window.localStorage.removeItem(GUEST_KEY);
        }
      }
      setUserId(uid);
      setItems(read(nextKey));
      setHydrated(true);
    }

    supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        applyUser(session?.user?.id ?? null);
      }
    });

    function sync() { setItems(read(keyRef.current)); }
    window.addEventListener("dv:cart", sync);
    window.addEventListener("storage", sync);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("dv:cart", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    const key = keyRef.current;
    const list = read(key);
    const found = list.find((i) => i.productId === item.productId);
    if (found) {
      found.quantity = Math.min(item.stock, found.quantity + qty);
    } else {
      list.push({ ...item, quantity: Math.min(item.stock, qty) });
    }
    write(key, list);
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    const key = keyRef.current;
    const list = read(key)
      .map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(i.stock, qty)) } : i));
    write(key, list);
  }, []);

  const remove = useCallback((productId: string) => {
    const key = keyRef.current;
    write(key, read(key).filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => write(keyRef.current, []), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotalCents = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);

  return { items, hydrated, count, subtotalCents, add, setQty, remove, clear };
}

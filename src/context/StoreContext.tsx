import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Address, CartItem, Category, Product, SellerProfile, User } from '../types';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface GuestCartRecord {
  product_id: number;
  variant_label: string;
  quantity: number;
  product: Product;
}

interface StoreContextValue {
  route: string;
  navigate: (to: string) => void;
  user: User | null;
  addresses: Address[];
  seller: SellerProfile | null;
  authLoading: boolean;
  categories: Category[];
  cart: CartItem[];
  cartCount: number;
  wishlist: Product[];
  recentlyViewed: Product[];
  buyNowItem: CartItem | null;
  setBuyNowItem: (item: CartItem | null) => void;
  toasts: ToastMessage[];
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  refreshAuth: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  logout: () => Promise<void>;
  addToCart: (product: Product, quantity?: number, variantLabel?: string) => Promise<void>;
  updateCartQty: (item: CartItem, quantity: number) => Promise<void>;
  removeFromCart: (item: CartItem) => Promise<void>;
  clearCartLocal: () => void;
  toggleWishlist: (product: Product) => Promise<void>;
  isWishlisted: (productId: number) => boolean;
  recordRecentlyViewed: (product: Product) => void;
  setAddressesState: (addrs: Address[]) => void;
  setUserState: (u: User | null) => void;
  setSellerState: (s: SellerProfile | null) => void;
}

const GUEST_CART_KEY = 'nexcart_guest_cart_v1';
const GUEST_WISH_KEY = 'nexcart_guest_wish_v1';
const RECENT_VIEW_KEY = 'nexcart_recent_v1';

const StoreContext = createContext<StoreContextValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<string>(() => window.location.pathname + window.location.search);
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => readStorage<GuestCartRecord[]>(GUEST_CART_KEY, []));
  const [wishlist, setWishlist] = useState<Product[]>(() => readStorage<Product[]>(GUEST_WISH_KEY, []));
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>(() => readStorage<Product[]>(RECENT_VIEW_KEY, []));
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.history.pushState({}, '', to);
    setRoute(to);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setRoute(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const data = await apiFetch<{ categories: Category[] }>('/api/categories');
      setCategories(data.categories);
    } catch {
      // keep existing
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User | null; addresses: Address[]; seller: SellerProfile | null }>('/api/auth/me');
      setUser(data.user);
      setAddresses(data.addresses || []);
      setSeller(data.seller || null);

      if (data.user) {
        const guestCart = readStorage<GuestCartRecord[]>(GUEST_CART_KEY, []);
        if (guestCart.length > 0) {
          const synced = await apiFetch<{ items: CartItem[] }>('/api/cart/sync', {
            method: 'POST',
            body: JSON.stringify({
              items: guestCart.map((g) => ({
                product_id: g.product_id,
                variant_label: g.variant_label,
                quantity: g.quantity,
              })),
            }),
          });
          localStorage.removeItem(GUEST_CART_KEY);
          setCart(synced.items);
        } else {
          const c = await apiFetch<{ items: CartItem[] }>('/api/cart');
          setCart(c.items);
        }

        const w = await apiFetch<{ items: Product[] }>('/api/wishlist');
        setWishlist(w.items);
      } else {
        setCart(readStorage<GuestCartRecord[]>(GUEST_CART_KEY, []));
        setWishlist(readStorage<Product[]>(GUEST_WISH_KEY, []));
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCategories();
    refreshAuth();
  }, [refreshCategories, refreshAuth]);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setAddresses([]);
    setSeller(null);
    setCart([]);
    setWishlist([]);
    localStorage.removeItem(GUEST_CART_KEY);
    showToast('Signed out of NexCart.', 'info');
    navigate('/');
  }, [navigate, showToast]);

  const addToCart = useCallback(
    async (product: Product, quantity = 1, variantLabel = 'Standard') => {
      if (product.stock_qty < 1) {
        showToast('This item is currently out of stock.', 'error');
        return;
      }
      if (user && user.id > 0) {
        try {
          const res = await apiFetch<{ items: CartItem[] }>('/api/cart', {
            method: 'POST',
            body: JSON.stringify({
              product_id: product.id,
              variant_label: variantLabel,
              quantity,
            }),
          });
          setCart(res.items);
          showToast(`Added "${product.name}" to your cart.`, 'success');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Unable to add to cart.', 'error');
        }
        return;
      }

      setCart((prev) => {
        const next = [...prev];
        const idx = next.findIndex(
          (i) => i.product_id === product.id && i.variant_label === variantLabel
        );
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            quantity: Math.min(product.stock_qty, next[idx].quantity + quantity),
          };
        } else {
          next.unshift({
            product_id: product.id,
            variant_label: variantLabel,
            quantity: Math.min(product.stock_qty, quantity),
            product,
          });
        }
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
        return next;
      });
      showToast(`Added "${product.name}" to your cart.`, 'success');
    },
    [user, showToast]
  );

  const updateCartQty = useCallback(
    async (item: CartItem, quantity: number) => {
      if (user && user.id > 0 && item.id) {
        try {
          const res = await apiFetch<{ items: CartItem[] }>(`/api/cart/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity }),
          });
          setCart(res.items);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to update cart.', 'error');
        }
        return;
      }
      setCart((prev) => {
        const next =
          quantity < 1
            ? prev.filter(
                (i) => !(i.product_id === item.product_id && i.variant_label === item.variant_label)
              )
            : prev.map((i) =>
                i.product_id === item.product_id && i.variant_label === item.variant_label
                  ? { ...i, quantity: Math.min(i.product.stock_qty, quantity) }
                  : i
              );
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
        return next;
      });
    },
    [user, showToast]
  );

  const removeFromCart = useCallback(
    async (item: CartItem) => {
      if (user && user.id > 0 && item.id) {
        try {
          const res = await apiFetch<{ items: CartItem[] }>(`/api/cart/${item.id}`, {
            method: 'DELETE',
          });
          setCart(res.items);
          showToast('Item removed from cart.', 'info');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to remove item.', 'error');
        }
        return;
      }
      setCart((prev) => {
        const next = prev.filter(
          (i) => !(i.product_id === item.product_id && i.variant_label === item.variant_label)
        );
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
        return next;
      });
      showToast('Item removed from cart.', 'info');
    },
    [user, showToast]
  );

  const clearCartLocal = useCallback(() => {
    setCart([]);
    localStorage.removeItem(GUEST_CART_KEY);
  }, []);

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (user && user.id > 0) {
        try {
          const res = await apiFetch<{ wishlisted: boolean; items: Product[] }>(
            `/api/wishlist/${product.id}`,
            { method: 'POST' }
          );
          setWishlist(res.items);
          showToast(
            res.wishlisted ? 'Saved to your Wishlist.' : 'Removed from your Wishlist.',
            'info'
          );
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Wishlist update failed.', 'error');
        }
        return;
      }
      setWishlist((prev) => {
        const exists = prev.some((p) => p.id === product.id);
        const next = exists ? prev.filter((p) => p.id !== product.id) : [product, ...prev];
        localStorage.setItem(GUEST_WISH_KEY, JSON.stringify(next));
        showToast(exists ? 'Removed from Wishlist.' : 'Saved to Wishlist.', 'info');
        return next;
      });
    },
    [user, showToast]
  );

  const isWishlisted = useCallback(
    (productId: number) => wishlist.some((p) => p.id === productId),
    [wishlist]
  );

  const recordRecentlyViewed = useCallback((product: Product) => {
    setRecentlyViewed((prev) => {
      const next = [product, ...prev.filter((p) => p.id !== product.id)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_VIEW_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  }, []);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        route,
        navigate,
        user,
        addresses,
        seller,
        authLoading,
        categories,
        cart,
        cartCount,
        wishlist,
        recentlyViewed,
        buyNowItem,
        setBuyNowItem,
        toasts,
        showToast,
        refreshAuth,
        refreshCategories,
        logout,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCartLocal,
        toggleWishlist,
        isWishlisted,
        recordRecentlyViewed,
        setAddressesState: setAddresses,
        setUserState: setUser,
        setSellerState: setSeller,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

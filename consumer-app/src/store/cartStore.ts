import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  store_name?: string;
  /** Owning restaurant — the cart may only ever hold items from one. */
  store_id?: string;
}

interface CartState {
  items: CartItem[];
  /** Item held back because it belongs to a different restaurant. */
  pendingItem: Omit<CartItem, 'quantity'> | null;
  /** Returns false when a confirmation is required (see pendingItem). */
  addItem: (item: Omit<CartItem, 'quantity'>) => boolean;
  confirmSwitchRestaurant: () => void;
  cancelSwitchRestaurant: () => void;
  getCartStoreId: () => string | null;
  getCartStoreName: () => string | null;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  loadFromStorage: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  pendingItem: null,

  // ── One cart = one restaurant ──────────────────────────────────────────────
  // Enforced in the store, not at each Add button, so every entry point (menu,
  // home rail, item modal, reorder, deep link) behaves identically. Reads the
  // live state via get() so rapid taps can't race two restaurants in.
  addItem: (item) => {
    const { items } = get();
    const cartStore = items[0]?.store_id;
    if (items.length > 0 && cartStore && item.store_id && item.store_id !== cartStore) {
      set({ pendingItem: item });
      return false;
    }

    const existingIndex = items.findIndex(i => i.product_id === item.product_id);
    let newItems;
    if (existingIndex > -1) {
      newItems = [...items];
      newItems[existingIndex].quantity += 1;
    } else {
      newItems = [...items, { ...item, quantity: 1 }];
    }

    set({ items: newItems });
    AsyncStorage.setItem('cart', JSON.stringify(newItems));
    return true;
  },

  confirmSwitchRestaurant: () => {
    const { pendingItem } = get();
    if (!pendingItem) return;
    const newItems = [{ ...pendingItem, quantity: 1 }];
    set({ items: newItems, pendingItem: null });
    AsyncStorage.setItem('cart', JSON.stringify(newItems));
  },

  cancelSwitchRestaurant: () => set({ pendingItem: null }),

  getCartStoreId: () => get().items[0]?.store_id || null,
  getCartStoreName: () => get().items[0]?.store_name || null,

  removeItem: (productId) => {
    const { items } = get();
    const newItems = items.filter(i => i.product_id !== productId);
    set({ items: newItems });
    AsyncStorage.setItem('cart', JSON.stringify(newItems));
  },

  updateQuantity: (productId, quantity) => {
    const { items } = get();
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const newItems = items.map(i => 
      i.product_id === productId ? { ...i, quantity } : i
    );
    set({ items: newItems });
    AsyncStorage.setItem('cart', JSON.stringify(newItems));
  },

  clearCart: () => {
    set({ items: [] });
    AsyncStorage.removeItem('cart');
  },

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  loadFromStorage: async () => {
    try {
      const cartStr = await AsyncStorage.getItem('cart');
      if (cartStr) {
        set({ items: JSON.parse(cartStr) });
      }
    } catch (error) {
      if (__DEV__) console.warn('Error loading cart:', error);
    }
  },
}));

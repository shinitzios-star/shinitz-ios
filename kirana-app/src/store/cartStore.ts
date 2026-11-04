import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  store_name?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  loadFromStorage: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const { items } = get();
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
  },

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

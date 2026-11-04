import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

/**
 * The single "selected delivery address" used across Home, Cart, Checkout and
 * order creation. Persisted to AsyncStorage so it survives restarts, and
 * hydrated from the server's default address on first use. This is what makes
 * the user enter their address once and have it reused everywhere.
 */
export interface SelectedAddress {
  id?: string | null;        // server address id when it's a saved address
  label?: string;
  full_address: string;
  lat?: number | null;
  lng?: number | null;
}

const KEY = 'selected_address_v1';

interface AddressState {
  selected: SelectedAddress | null;
  hydrated: boolean;
  /** Read the locally-persisted selection (once per launch). */
  hydrate: () => Promise<void>;
  /** Set + persist the selection. */
  setSelected: (a: SelectedAddress | null) => Promise<void>;
  /** Fetch the server's default (or first) saved address as a SelectedAddress. */
  loadServerDefault: () => Promise<SelectedAddress | null>;
  /** Hydrate, then fall back to the server default if nothing is selected yet. */
  ensureSelected: () => Promise<SelectedAddress | null>;
  /** Clear on logout so one user's address never leaks to the next. */
  clear: () => Promise<void>;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  selected: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ selected: raw ? JSON.parse(raw) : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setSelected: async (a) => {
    set({ selected: a });
    try {
      if (a) await AsyncStorage.setItem(KEY, JSON.stringify(a));
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // non-fatal: selection still lives in memory for this session
    }
  },

  loadServerDefault: async () => {
    try {
      const res = await api.get('/addresses');
      const list: any[] = res.data || [];
      if (!list.length) return null;
      const def = list.find((x) => x.is_default) || list[0];
      return {
        id: def.id,
        label: def.label,
        full_address: def.full_address,
        lat: def.lat ?? null,
        lng: def.lng ?? null,
      };
    } catch {
      return null;
    }
  },

  ensureSelected: async () => {
    await get().hydrate();
    if (get().selected) return get().selected;
    const def = await get().loadServerDefault();
    if (def) await get().setSelected(def);
    return get().selected;
  },

  clear: async () => {
    set({ selected: null, hydrated: true });
    try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
  },
}));

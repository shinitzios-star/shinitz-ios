/**
 * historyStore — lightweight, on-device signal collection for personalization.
 *
 * Tracks the consumer's recent SEARCHES and product VIEWS in AsyncStorage. These
 * are combined with order history + favorites by `utils/recommend` to gradually
 * personalize the home screen. Nothing is sent to the backend and no existing
 * data is touched — it's purely a local behavioural cache.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ViewedItem {
  id: string;
  category?: string;
  store_name?: string;
  at: number;
}

interface HistoryState {
  searches: string[];       // most-recent-first, deduped
  viewed: ViewedItem[];     // most-recent-first, deduped by id
  loaded: boolean;
  addSearch: (term: string) => void;
  addView: (item: Omit<ViewedItem, 'at'>) => void;
  loadFromStorage: () => Promise<void>;
}

const SEARCH_CAP = 20;
const VIEW_CAP = 60;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  searches: [],
  viewed: [],
  loaded: false,

  addSearch: (raw) => {
    const term = (raw || '').trim().toLowerCase();
    if (term.length < 2) return;
    const searches = [term, ...get().searches.filter((s) => s !== term)].slice(0, SEARCH_CAP);
    set({ searches });
    AsyncStorage.setItem('search_history', JSON.stringify(searches)).catch(() => {});
  },

  addView: (item) => {
    if (!item?.id) return;
    const viewed = [{ ...item, at: Date.now() }, ...get().viewed.filter((v) => v.id !== item.id)].slice(0, VIEW_CAP);
    set({ viewed });
    AsyncStorage.setItem('view_history', JSON.stringify(viewed)).catch(() => {});
  },

  loadFromStorage: async () => {
    try {
      const [s, v] = await Promise.all([
        AsyncStorage.getItem('search_history'),
        AsyncStorage.getItem('view_history'),
      ]);
      set({
        searches: s ? JSON.parse(s) : [],
        viewed: v ? JSON.parse(v) : [],
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
}));

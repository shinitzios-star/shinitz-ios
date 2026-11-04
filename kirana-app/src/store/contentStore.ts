import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentAPI } from '../services/api';

/**
 * Backend-controlled consumer copy (home tagline, rail titles, refer badge…).
 * The app reads `content[key]` and falls back to its own i18n string when a key
 * is absent — so marketing can change wording without an app update, and the UI
 * still works offline / if the backend is unavailable.
 *
 * Cached in AsyncStorage so the last-known copy shows instantly on launch.
 */
const KEY = 'consumer_content_v1';

interface ContentState {
  content: Record<string, string>;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useContentStore = create<ContentState>((set) => ({
  content: {},
  loaded: false,
  load: async () => {
    // Show cached copy immediately…
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ content: JSON.parse(raw) });
    } catch { /* ignore */ }
    // …then refresh from the backend.
    try {
      const res = await contentAPI.get();
      const data = (res.data && typeof res.data === 'object') ? res.data : {};
      set({ content: data, loaded: true });
      AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
    } catch {
      set({ loaded: true });
    }
  },
}));

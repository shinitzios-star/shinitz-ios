import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  store_name?: string;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
  loadFromStorage: () => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],

  addFavorite: (item) => {
    const { favorites } = get();
    if (!favorites.find(f => f.id === item.id)) {
      const newFavorites = [...favorites, item];
      set({ favorites: newFavorites });
      AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
    }
  },

  removeFavorite: (id) => {
    const { favorites } = get();
    const newFavorites = favorites.filter(f => f.id !== id);
    set({ favorites: newFavorites });
    AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
  },

  isFavorite: (id) => {
    return get().favorites.some(f => f.id === id);
  },

  toggleFavorite: (item) => {
    const { isFavorite, addFavorite, removeFavorite } = get();
    if (isFavorite(item.id)) {
      removeFavorite(item.id);
    } else {
      addFavorite(item);
    }
  },

  loadFromStorage: async () => {
    try {
      const favStr = await AsyncStorage.getItem('favorites');
      if (favStr) {
        set({ favorites: JSON.parse(favStr) });
      }
    } catch (error) {
      if (__DEV__) console.warn('Error loading favorites:', error);
    }
  },
}));

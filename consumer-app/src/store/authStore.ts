import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from '../services/api';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://hyperlocal-commerce-6.preview.emergentagent.com';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'consumer' | 'kirana' | 'delivery' | 'restaurant' | 'admin';
  location?: { lat: number; lng: number };
  address?: string;
  /** Data URL (data:image/jpeg;base64,...) or remote URL */
  avatar_url?: string | null;
  // Kirana
  store_name?: string;
  // Restaurant
  restaurant_name?: string;
  fssai_number?: string;
  gst_number?: string;
  // Delivery partner
  vehicle_type?: string;
  vehicle_number?: string;
  upi_id?: string;
  upi_verified?: boolean;
  upi_verification_status?: string;
  aadhaar?: string;
  verified?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),

  login: async (user, token) => {
    await AsyncStorage.setItem('auth_token', token);
    setAuthToken(token);          // the API client caches it; keep them in step
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    setAuthToken(null);
    await AsyncStorage.removeItem('user');
    // Drop the selected delivery address so it never leaks to the next user.
    try {
      const { useAddressStore } = require('./addressStore');
      await useAddressStore.getState().clear();
    } catch { /* ignore */ }
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userStr = await AsyncStorage.getItem('user');
      setAuthToken(token);
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      if (__DEV__) console.warn('Error loading auth from storage:', error);
      set({ isLoading: false });
    }
  },

  updateLocation: async (lat, lng) => {
    const { token, user } = get();
    if (!token || !user) return;

    try {
      await axios.patch(
        `${API_URL}/api/users/location`,
        null,
        {
          params: { lat, lng },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      set({ user: { ...user, location: { lat, lng } } });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  },
}));

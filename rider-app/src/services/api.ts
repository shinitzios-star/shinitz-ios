import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Environment-resolved constants ──────────────────────────────────────────

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://shinitz-backend.onrender.com';

const MSG91_AUTH_KEY = process.env.EXPO_PUBLIC_MSG91_AUTH_KEY || '';
const MSG91_TEMPLATE_ID = process.env.EXPO_PUBLIC_MSG91_TEMPLATE_ID || '';
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

// MSG91 endpoints in one place (no more scattered URLs)
const MSG91_BASE = 'https://control.msg91.com/api/v5/otp';
const MSG91_HEADERS = { 'Content-Type': 'application/json' } as const;

// ─── Logout callback (set by RootLayout) ─────────────────────────────────────
// Lets the interceptor trigger an auth-store logout without creating an import
// cycle (api.ts ← authStore ← api.ts).

let _onUnauthorized: (() => void) | null = null;
export const registerUnauthorizedHandler = (fn: () => void) => {
  _onUnauthorized = fn;
};

// Audio delivery note: a playable source (remote URI + auth header) for expo-av.
export const getAudioNoteSource = async (orderId: string) => {
  const token = await AsyncStorage.getItem('auth_token');
  return {
    uri: `${API_URL}/api/orders/${orderId}/audio-note`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
};

// ─── axios instance ──────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Auth token, cached in memory ────────────────────────────────────────────
// Every request used to await AsyncStorage — a bridge round-trip per call, and
// a screen fires several. The token only changes at login/logout, so it is read
// once and kept; `setAuthToken` keeps the cache honest (the auth store calls it,
// and any write we miss is picked up by the AsyncStorage fallback below).
let _tokenCache: string | null | undefined;   // undefined = not read yet
export const setAuthToken = (token: string | null) => { _tokenCache = token; };

const getAuthToken = async (): Promise<string | null> => {
  if (_tokenCache !== undefined) return _tokenCache;
  _tokenCache = await AsyncStorage.getItem('auth_token');
  return _tokenCache;
};

// Attach JWT to every outgoing request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response: handle 401 → logout, network errors → retry up to 2x
type RetryableConfig = AxiosRequestConfig & { __retryCount?: number };
const MAX_RETRIES = 1;          // reads only — see the interceptor below

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // Token expired / invalid → trigger logout flow.
    // Guard: never trigger the global logout for the AUTH endpoints themselves
    // (a bad OTP / login attempt must NOT yank an unrelated session to Welcome),
    // which previously caused unexpected redirects.
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthCall = url.includes('/auth/');
      if (!isAuthCall) _onUnauthorized?.();
      return Promise.reject(error);
    }

    // Transient network / timeout error → retry ONCE, and only for reads.
    //
    // Retrying a write is not safe: a network error after the server has
    // already handled the request looks identical to one before it, so a
    // retried POST /orders could place the same order twice. Reads can always
    // be repeated.
    //
    // One retry, not two: every attempt costs the full timeout, and the caller
    // is sitting on a spinner with its button disabled for the whole of it.
    const cfg = error.config as RetryableConfig | undefined;
    const isNetwork = !error.response && error.code !== 'ECONNABORTED' && error.message === 'Network Error';
    const isTimeout = error.code === 'ECONNABORTED';
    const method = (cfg?.method || 'get').toLowerCase();
    const isRead = method === 'get' || method === 'head';

    if (cfg && isRead && (isNetwork || isTimeout)) {
      cfg.__retryCount = (cfg.__retryCount || 0) + 1;
      if (cfg.__retryCount <= MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500));
        return api(cfg);
      }
    }

    return Promise.reject(error);
  },
);

// ─── Domain APIs ─────────────────────────────────────────────────────────────

export const authAPI = {
  sendOTP: (phone: string) => api.post('/auth/send-otp', { phone }),
  // app_type lets the backend refuse a login that belongs to a different
  // Shinitz app — a valid OTP proves the phone, not the right to be here.
  verifyOTP: (phone: string, otp: string) =>
    api.post('/auth/verify-otp', { phone, otp, app_type: 'delivery' }),
  register: (data: any) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// MSG91 (third-party, separate from our backend)
export const msg91API = {
  sendOTP: (phone: string) =>
    axios.post(
      `${MSG91_BASE}`,
      { template_id: MSG91_TEMPLATE_ID, mobile: `91${phone}`, authkey: MSG91_AUTH_KEY },
      { headers: MSG91_HEADERS },
    ),
  verifyOTP: (phone: string, otp: string) =>
    axios.post(
      `${MSG91_BASE}/verify`,
      { mobile: `91${phone}`, otp, authkey: MSG91_AUTH_KEY },
      { headers: MSG91_HEADERS },
    ),
  resendOTP: (phone: string) =>
    axios.post(
      `${MSG91_BASE}/retry`,
      { mobile: `91${phone}`, authkey: MSG91_AUTH_KEY, retrytype: 'text' },
      { headers: MSG91_HEADERS },
    ),
};

export const productsAPI = {
  getAll: (params?: { category?: string; search?: string; store_type?: string; store_id?: string; lat?: number; lng?: number }) =>
    api.get('/products', { params }),
  getCategories: () => api.get('/products/categories'),
  create: (data: any) => api.post('/products', data),
  // Product detail popup (includes the store's avatar/name/verified)
  getOne: (productId: string) => api.get(`/products/${productId}`),
  getReviews: (productId: string) => api.get(`/products/${productId}/reviews`),
  addReview: (productId: string, rating: number, comment?: string) =>
    api.post(`/products/${productId}/reviews`, { rating, comment }),
  // Nearby stores (each restaurant/kirana with its own menu)
  getStores: (params: { lat: number; lng: number; store_type?: string; search?: string }) =>
    api.get('/stores', { params }),
  // Is the area serviceable? (radius + stores + optional riders + zone config)
  serviceAvailability: (lat: number, lng: number, pincode?: string) =>
    api.get('/service-availability', { params: { lat, lng, ...(pincode ? { pincode } : {}) } }),
  // "Notify me when available" → waiting list
  notifyService: (data: { address?: string; lat?: number | null; lng?: number | null; pincode?: string | null }) =>
    api.post('/service/notify', data),
};

// Service waitlist ("Notify Me When Available")
export const serviceAPI = {
  notify: (data: { name?: string; phone?: string; address?: string; lat?: number; lng?: number; pincode?: string }) =>
    api.post('/service/notify', data),
};

export const ordersAPI = {
  create: (data: any) => api.post('/orders', data),
  getAll: () => api.get('/orders'),
  getOne: (orderId: string) => api.get(`/orders/${orderId}`),
  updateStatus: (orderId: string, status: string, otp?: string) =>
    api.patch(`/orders/${orderId}/status`, null, {
      params: otp ? { status, otp } : { status },
    }),
  updateRiderLocation: (orderId: string, lat: number, lng: number) =>
    api.post(`/orders/${orderId}/rider-location`, { lat, lng }),
  arrivedAtStore: (orderId: string) =>
    api.post(`/orders/${orderId}/arrived-at-store`),
  // Decline a pushed delivery offer → re-offered to the next nearest rider
  rejectOffer: (orderId: string) =>
    api.post(`/orders/${orderId}/reject-offer`),
  // Consumer rates their delivery partner (1–5) after delivery
  rateRider: (orderId: string, rating: number, comment?: string) =>
    api.post(`/orders/${orderId}/rate-rider`, { rating, comment }),
  // Consumer tips their rider (before delivery)
  addTip: (orderId: string, amount: number) =>
    api.post(`/orders/${orderId}/tip`, { amount }),
  // Rider records COD payment collected (cash or UPI via merchant QR)
  collectPayment: (orderId: string, mode: 'cash' | 'upi', reference?: string) =>
    api.post(`/orders/${orderId}/collect-payment`, { mode, reference }),
  verifyPickup: (orderId: string, code: string) =>
    api.post(`/orders/${orderId}/verify-pickup`, null, { params: { code } }),
};

export const kiranaAPI = {
  getStats: () => api.get('/kirana/stats'),
  getProducts: () => api.get('/kirana/products'),
};

export const deliveryAPI = {
  getStats: () => api.get('/delivery/stats'),
  getEarnings: () => api.get('/delivery/earnings'),
  getHistory: () => api.get('/delivery/history'),
  toggleStatus: (is_online: boolean) => api.post('/delivery/toggle-status', { is_online }),
  // Daily identity selfie (server gates go-online with HTTP 428 until done)
  submitSelfie: (data: { image: string; lat?: number | null; lng?: number | null; device?: string; retry_count?: number }) =>
    api.post('/delivery/selfie', data),
  // Go-online checklist (what's blocking activation)
  getActivationStatus: () => api.get('/delivery/activation-status'),
  // Wallet ledger (balances + transactions)
  getWallet: () => api.get('/delivery/wallet'),
  // Emergency SOS — alerts admins with the rider's live location
  sos: (lat?: number, lng?: number, order_id?: string) =>
    api.post('/delivery/sos', { lat, lng, order_id }),
};


export const restaurantAPI = {
  getMenu: () => api.get('/restaurant/menu'),
  createMenuItem: (data: any) => api.post('/restaurant/menu', data),
  updateMenuItem: (id: string, data: any) => api.put(`/restaurant/menu/${id}`, data),
  deleteMenuItem: (id: string) => api.delete(`/restaurant/menu/${id}`),
  // Food items stored as products (store_type=restaurant) → visible in consumer Food section
  getProducts: () => api.get('/restaurant/products'),
  updateProduct: (id: string, data: any) => api.put(`/restaurant/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/restaurant/products/${id}`),
};

// Online/offline toggle (restaurant + kirana share this)
export const storeAPI = {
  getOnline: () => api.get('/store/online'),
  setOnline: (is_online: boolean) => api.post('/store/online', { is_online }),
  getShifts: () => api.get('/store/shifts'),
  setShifts: (shifts: { open: string; close: string }[]) => api.put('/store/shifts', { shifts }),
};

// Partner verification (restaurant + kirana)
export const verificationAPI = {
  // Partner + rider facing
  status: () => api.get('/verification/status'),
  submitDocuments: (docs: Record<string, string>) => api.post('/verification/documents', docs),
  // Rider bank submission (admin runs the ₹1 penny-drop)
  submitBank: (data: { account_name: string; account_number: string; ifsc: string }) =>
    api.post('/verification/bank', data),
  // Admin-facing — full review, not one-click
  adminQueue: (status?: string) =>
    api.get('/admin/verification/queue', { params: status ? { status } : {} }),
  adminDetail: (userId: string) => api.get(`/admin/verification/${userId}`),
  adminDocumentsReview: (userId: string, approved: boolean, reason?: string) =>
    api.post(`/admin/verification/${userId}/documents-review`, { approved, reason }),
  adminBusinessReview: (userId: string, checks: Record<string, boolean>, reason?: string) =>
    api.post(`/admin/verification/${userId}/business-review`, { checks, reason }),
  adminDecision: (userId: string, decision: string, reason?: string) =>
    api.post(`/admin/verification/${userId}/decision`, { decision, reason }),
};

export const locationAPI = {
  update: (lat: number, lng: number) =>
    api.patch('/users/location', null, { params: { lat, lng } }),
};

// Backend-controlled consumer copy (home tagline, rail titles, refer badge)
export const contentAPI = {
  get: () => api.get('/content'),
  adminGet: () => api.get('/admin/content'),
  adminSet: (data: Record<string, string>) => api.put('/admin/content', data),
};

// Promotional offers (consumer alert + admin CRUD)
export const offersAPI = {
  active: () => api.get('/offers'),
  adminList: () => api.get('/admin/offers'),
  create: (data: any) => api.post('/admin/offers', data),
  update: (id: string, data: any) => api.put(`/admin/offers/${id}`, data),
  remove: (id: string) => api.delete(`/admin/offers/${id}`),
};

// Consumer referral programme
export const referralAPI = {
  me: () => api.get('/referral/me'),
  // Admin knobs
  getConfig: () => api.get('/admin/referral-config'),
  setConfig: (data: { enabled?: boolean; reward_amount?: number; min_order_amount?: number }) =>
    api.put('/admin/referral-config', data),
  adminList: () => api.get('/admin/referrals'),
};

export const paymentAPI = {
  // Merchant UPI the rider's COD QR collects into
  merchantUpi: () => api.get('/payment/merchant-upi'),
  createOrder: (amount: number, orderId: string, notes?: any) =>
    api.post('/payment/create-order', {
      amount,
      order_id: orderId,
      notes: notes || {},
    }),
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    order_id: string;
  }) => api.post('/payment/verify', data),
};

export const getRazorpayKeyId = () => RAZORPAY_KEY_ID;

export const seedData = () => api.post('/seed');

export default api;

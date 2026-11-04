// ─── Payment Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'online' | 'cod';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'   // creating backend order
  | 'opening_checkout' // Razorpay checkout is open
  | 'verifying'        // verifying signature with backend
  | 'success'
  | 'failed'
  | 'cancelled';

// Data sent when placing an order
export interface PaymentOrderData {
  items: Array<{
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    store_name?: string;
  }>;
  delivery_address: string;
  delivery_location: { lat: number; lng: number };
  total_amount: number;
  notes?: string | null;
  /** Applied coupon — server re-validates and recomputes the discount. */
  coupon_code?: string | null;
  /** Saved per-address rider guidance, shown to the rider with the drop pin. */
  delivery_instructions?: string | null;
  /** P10: apply wallet credits — the server computes the actual amount. */
  use_wallet?: boolean;
  /** P9: chosen delivery slot ISO (IST); undefined = deliver now. */
  scheduled_for?: string | null;
}

// Options passed directly to the Razorpay native SDK
export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;       // in paise
  currency: string;
  name: string;
  description: string;
  order_id: string;     // Razorpay order ID (rzp_...)
  prefill: {
    name: string;
    contact: string;
    email: string;
  };
  notes: Record<string, string>;
  theme: { color: string };
  retry: { enabled: boolean; max_count: number };
  send_sms_hash: boolean;
}

// Successful response from Razorpay native checkout
export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Error response from Razorpay native checkout
export interface RazorpayErrorResponse {
  code: number;       // 0 = user cancelled
  description: string;
  source?: string;
  step?: string;
  reason?: string;
  metadata?: { order_id?: string; payment_id?: string };
}

// Response from backend /payment/create-order
export interface BackendPaymentOrderResponse {
  success: boolean;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;     // in paise
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; contact: string };
}

// Final result returned by processOnlinePayment()
export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId: string;
  amount: number;
  method?: PaymentMethod;
  cancelled?: boolean;   // true when user dismissed checkout
  errorCode?: number;
  errorMessage?: string;
}

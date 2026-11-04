/**
 * Razorpay Native Payment Service
 *
 * Architecture:
 *  • Uses react-native-razorpay which wraps the Razorpay Android & iOS
 *    native SDKs via NativeModules — zero WebView involved.
 *  • SDK is lazy-loaded once and cached; never re-required on every call.
 *  • Exposes a single `processOnlinePayment()` function that always
 *    RESOLVES (never rejects) so callers inspect result.success.
 *  • A module-level lock prevents duplicate concurrent checkouts.
 */

import { Platform } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { paymentAPI, registrationFeeAPI } from './api';
import type {
  BackendPaymentOrderResponse,
  PaymentResult,
} from '../types/payment';
import type {
  RazorpayOptions,
  RazorpaySuccessData,
  RazorpayErrorData,
} from 'react-native-razorpay';

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_NAME = 'Shinitz';
const BRAND_COLOR = '#0F3D2E';

/** Razorpay uses error code 0 when the user explicitly dismisses checkout */
const USER_CANCELLED_CODE = 0;

// ─── Custom error ─────────────────────────────────────────────────────────────

export class PaymentError extends Error {
  readonly code: number;
  readonly cancelled: boolean;

  constructor(message: string, code = -1) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.cancelled = code === USER_CANCELLED_CODE;
  }
}

// ─── Native SDK ───────────────────────────────────────────────────────────────
// Statically imported above. The native module auto-initializes when the JS
// bundle loads; this is the pattern Razorpay's official docs use and avoids
// lazy-require timing issues that can fail in release builds with new arch.

function getSDK(): typeof RazorpayCheckout {
  if (Platform.OS === 'web') {
    throw new PaymentError('Online payment is not available on web. Use the mobile app.');
  }
  if (!RazorpayCheckout) {
    throw new PaymentError(
      'Razorpay native module not found. Please rebuild the app with: npx expo run:android',
    );
  }
  return RazorpayCheckout;
}

// ─── Duplicate-payment guard ──────────────────────────────────────────────────
// Prevents two checkout windows from opening simultaneously (double-tap guard).
// Always released in the finally block — safe against any thrown error.

let _inProgress = false;
export const isPaymentInProgress = (): boolean => _inProgress;

// ─── Pipeline steps ───────────────────────────────────────────────────────────

async function createBackendOrder(
  orderId: string,
  amount: number,
): Promise<BackendPaymentOrderResponse> {
  const res = await paymentAPI.createOrder(amount, orderId);
  const data = res.data as BackendPaymentOrderResponse;
  if (!data.success) throw new PaymentError('Backend could not create the payment order.');
  return data;
}

async function openNativeCheckout(
  backendOrder: BackendPaymentOrderResponse,
  userName: string,
  userPhone: string,
  userEmail: string,
  appOrderId: string,
): Promise<RazorpaySuccessData> {
  const sdk = getSDK();

  // Keep options minimal — react-native-razorpay@2.2.3 native SDK can throw on
  // unexpected/edge-case option values in release builds. Required + UI-only
  // fields below; nothing optional.
  const prefill: RazorpayOptions['prefill'] = {
    name: userName,
    contact: backendOrder.prefill.contact || userPhone,
  };
  // Only include email if we actually have one — empty string can confuse SDK
  if (userEmail && userEmail.includes('@')) {
    prefill.email = userEmail;
  }

  const options: RazorpayOptions = {
    key: backendOrder.razorpay_key_id,
    amount: backendOrder.amount,        // already in paise — set by backend
    currency: backendOrder.currency,
    name: APP_NAME,
    description: backendOrder.description,
    order_id: backendOrder.razorpay_order_id,
    prefill,
    theme: { color: BRAND_COLOR },
  };

  // NOTE: The saved Razorpay Payment Block (config_xxxxxx) is intentionally
  // NOT passed here. The native Android SDK in react-native-razorpay@2.2.3
  // rejects unknown top-level fields with a native exception that crashes
  // the app. To customize payment methods, configure them in the Razorpay
  // dashboard merchant Payment Methods section instead — the SDK respects
  // those settings automatically.

  return sdk.open(options);
}

async function verifySignature(
  rzpSuccess: RazorpaySuccessData,
  appOrderId: string,
): Promise<void> {
  const res = await paymentAPI.verifyPayment({
    razorpay_order_id: rzpSuccess.razorpay_order_id,
    razorpay_payment_id: rzpSuccess.razorpay_payment_id,
    razorpay_signature: rzpSuccess.razorpay_signature,
    order_id: appOrderId,
  });
  if (!res.data.success) throw new PaymentError('Payment signature verification failed.');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full native payment pipeline:
 *   1. Create Razorpay order on your backend
 *   2. Open the native Android / iOS Razorpay checkout
 *   3. Verify the HMAC-SHA256 signature on your backend
 *
 * Always resolves — inspect result.success, result.cancelled.
 */
export async function processOnlinePayment(params: {
  orderId: string;
  amount: number;
  userName: string;
  userPhone: string;
  userEmail?: string;
}): Promise<PaymentResult> {
  if (_inProgress) {
    return {
      success: false,
      orderId: params.orderId,
      amount: params.amount,
      errorMessage: 'A payment is already in progress. Please wait.',
    };
  }

  _inProgress = true;

  try {
    // Step 1 — backend creates a Razorpay order and returns the key + order id
    const backendOrder = await createBackendOrder(params.orderId, params.amount);

    // Step 2 — native checkout (this is where the user interacts with Razorpay)
    const rzpResponse = await openNativeCheckout(
      backendOrder,
      params.userName,
      params.userPhone,
      params.userEmail ?? '',
      params.orderId,
    );

    // Step 3 — backend verifies the HMAC-SHA256 signature to confirm authenticity
    await verifySignature(rzpResponse, params.orderId);

    return {
      success: true,
      paymentId: rzpResponse.razorpay_payment_id,
      orderId: params.orderId,
      amount: params.amount,
      method: 'online',
    };

  } catch (error: unknown) {
    // Three error shapes are possible here:
    //   1. react-native-razorpay  → { code: number, description: string }
    //   2. PaymentError            → { code: number, message: string }
    //   3. Axios (backend HTTP)   → { response: { data: { detail: string }, status } }
    const rzpError = error as Partial<RazorpayErrorData>;
    const payError = error as Partial<PaymentError>;
    const axiosError = error as {
      response?: { data?: { detail?: string }; status?: number };
      message?: string;
    };

    // Prefer the most-specific message first (backend detail beats generic strings)
    const description =
      axiosError.response?.data?.detail ??
      rzpError.description ??
      payError.message ??
      axiosError.message ??
      'Payment failed. Please try again.';

    const code = rzpError.code ?? payError.code ?? axiosError.response?.status ?? -1;
    const cancelled = rzpError.code === USER_CANCELLED_CODE;

    return {
      success: false,
      orderId: params.orderId,
      amount: params.amount,
      cancelled,
      errorCode: typeof code === 'number' ? code : -1,
      errorMessage: description,
    };
  } finally {
    // Always release the lock — even if an unhandled exception somehow escapes
    _inProgress = false;
  }
}

// ─── Restaurant registration fee ──────────────────────────────────────────────

export interface RegistrationFeeResult {
  success: boolean;
  alreadyPaid?: boolean;
  cancelled?: boolean;
  paymentId?: string;
  errorMessage?: string;
}

/**
 * Pay the one-time restaurant registration fee.
 *
 * The amount is NEVER chosen here: the backend reads it from settings, creates
 * the Razorpay order, and verifies the signature. This function only opens the
 * native checkout for the server's order and reports the signed result back —
 * so nothing on the device can change what is charged.
 *
 * Always resolves; inspect `success` / `cancelled`.
 */
export async function payRegistrationFee(params: {
  userName?: string;
  userPhone?: string;
  userEmail?: string;
}): Promise<RegistrationFeeResult> {
  if (_inProgress) {
    return { success: false, errorMessage: 'A payment is already in progress. Please wait.' };
  }
  _inProgress = true;

  let rzpOrderId = '';
  try {
    const { data: order } = await registrationFeeAPI.createOrder();
    if (order.already_paid) {
      return { success: true, alreadyPaid: true };
    }
    rzpOrderId = order.razorpay_order_id;

    const sdk = getSDK();
    const prefill: RazorpayOptions['prefill'] = {
      name: params.userName || order.prefill?.name || '',
      contact: order.prefill?.contact || params.userPhone || '',
    };
    if (params.userEmail && params.userEmail.includes('@')) {
      prefill.email = params.userEmail;
    }

    const rzp = await sdk.open({
      key: order.razorpay_key_id,
      amount: order.amount,              // paise, decided by the backend
      currency: order.currency || 'INR',
      name: APP_NAME,
      description: order.description || 'Restaurant registration fee',
      order_id: order.razorpay_order_id, // the server's order is what gets charged
      prefill,
      theme: { color: BRAND_COLOR },
    } as RazorpayOptions);

    const { data: verified } = await registrationFeeAPI.verify({
      razorpay_order_id: rzp.razorpay_order_id,
      razorpay_payment_id: rzp.razorpay_payment_id,
      razorpay_signature: rzp.razorpay_signature,
    });
    if (!verified.success) throw new PaymentError('Payment signature verification failed.');

    return { success: true, paymentId: rzp.razorpay_payment_id };

  } catch (error: unknown) {
    const rzpError = error as Partial<RazorpayErrorData>;
    const payError = error as Partial<PaymentError>;
    const axiosError = error as {
      response?: { data?: { detail?: string }; status?: number }; message?: string;
    };
    const cancelled = rzpError.code === USER_CANCELLED_CODE;

    // Tell the backend the attempt died so the record doesn't sit PENDING.
    // (The webhook would also converge it, but this is immediate.)
    if (rzpOrderId) {
      try {
        await registrationFeeAPI.cancel(
          rzpOrderId,
          cancelled ? 'CANCELLED' : 'FAILED',
          rzpError.description || payError.message || 'payment_failed',
        );
      } catch { /* best-effort */ }
    }

    return {
      success: false,
      cancelled,
      errorMessage:
        axiosError.response?.data?.detail ??
        rzpError.description ??
        payError.message ??
        'Payment failed. Please try again.',
    };
  } finally {
    _inProgress = false;
  }
}

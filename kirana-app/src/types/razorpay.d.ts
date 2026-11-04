/**
 * TypeScript module declaration for react-native-razorpay@2.2.3
 *
 * The package ships no bundled .d.ts. This file gives full type safety
 * to every consumer without overriding any exported runtime value.
 */

declare module 'react-native-razorpay' {
  // Options passed to RazorpayCheckout.open()
  export interface RazorpayOptions {
    /** Live or test key_id from Razorpay Dashboard */
    key: string;
    /** Amount in PAISE (₹1 = 100 paise) */
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    /** Razorpay order_id from your backend */
    order_id?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: { color?: string };
    retry?: { enabled: boolean; max_count: number };
    send_sms_hash?: boolean;
    allow_rotation?: boolean;
  }

  /** Shape of the success payload delivered to the JS side */
  export interface RazorpaySuccessData {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  /** Shape of the error payload delivered on payment failure / cancellation */
  export interface RazorpayErrorData {
    /** 0 = user cancelled; other values = payment failure codes */
    code: number;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, string>;
  }

  declare class RazorpayCheckout {
    /**
     * Opens the native Razorpay checkout.
     * Resolves with RazorpaySuccessData on success.
     * Rejects with RazorpayErrorData on failure or cancellation.
     */
    static open(
      options: RazorpayOptions,
      successCallback?: (data: RazorpaySuccessData) => void,
      errorCallback?: (data: RazorpayErrorData) => void,
    ): Promise<RazorpaySuccessData>;

    static onExternalWalletSelection(
      callback: (data: { external_wallet: string }) => void,
    ): void;
  }

  export default RazorpayCheckout;
}

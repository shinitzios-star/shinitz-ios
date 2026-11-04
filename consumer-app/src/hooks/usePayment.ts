import { useState, useCallback, useRef } from 'react';
import { ordersAPI } from '../services/api';
import { processOnlinePayment } from '../services/payment';
import type {
  PaymentMethod,
  PaymentStatus,
  PaymentOrderData,
  PaymentResult,
} from '../types/payment';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UsePaymentReturn {
  // ── State ──
  status: PaymentStatus;
  result: PaymentResult | null;
  /** Backend order ID created during the current session */
  orderId: string | null;
  /** True while any async step is in progress */
  isLoading: boolean;

  // ── Actions ──
  /**
   * Creates a backend order then runs the selected payment method.
   * COD skips Razorpay entirely.
   */
  initiatePayment: (
    orderData: PaymentOrderData,
    method: PaymentMethod,
    user: { name: string; phone: string; email?: string },
  ) => Promise<PaymentResult>;

  /**
   * Re-runs Razorpay checkout for an already-created backend order.
   * Called from the payment-failed screen's "Retry" button.
   */
  retryOnlinePayment: (
    existingOrderId: string,
    amount: number,
    user: { name: string; phone: string; email?: string },
  ) => Promise<PaymentResult>;

  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePayment(): UsePaymentReturn {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  /**
   * Ref tracks the most recent order ID synchronously.
   * Avoids the stale-closure problem in async callbacks when the state
   * setter (`setOrderId`) hasn't flushed yet at error-handling time.
   */
  const orderIdRef = useRef<string | null>(null);

  const isLoading =
    status === 'creating_order' ||
    status === 'opening_checkout' ||
    status === 'verifying';

  // ── helpers ──────────────────────────────────────────────────────────────────

  const setOrder = (id: string) => {
    orderIdRef.current = id;
    setOrderId(id);
  };

  const finalize = (r: PaymentResult) => {
    setResult(r);
    setStatus(r.success ? 'success' : r.cancelled ? 'cancelled' : 'failed');
  };

  // ── initiatePayment ──────────────────────────────────────────────────────────

  const initiatePayment = useCallback(
    async (
      orderData: PaymentOrderData,
      method: PaymentMethod,
      user: { name: string; phone: string; email?: string },
    ): Promise<PaymentResult> => {
      setStatus('creating_order');
      setResult(null);

      try {
        // 1. Create the backend order (always, regardless of payment method)
        const res = await ordersAPI.create({
          items: orderData.items,
          delivery_address: orderData.delivery_address,
          delivery_location: orderData.delivery_location,
          total_amount: orderData.total_amount,
          notes: orderData.notes ?? null,
          payment_method: method,
          coupon_code: orderData.coupon_code ?? null,
          delivery_instructions: orderData.delivery_instructions ?? null,
          use_wallet: orderData.use_wallet ?? false,
          scheduled_for: orderData.scheduled_for ?? null,
        });

        if (!res.data?.success) throw new Error('Order creation failed on server.');

        const newOrderId: string = res.data.order.id;
        setOrder(newOrderId);

        // The server's number is authoritative: after coupons + wallet credits
        // this is what's actually left to collect (may be 0 = fully wallet-paid).
        const payable: number =
          res.data.order.amount_payable ?? orderData.total_amount;

        // 2a. COD — or NOTHING left to charge (wallet covered the whole bill).
        if (method === 'cod' || payable <= 0) {
          const r: PaymentResult = {
            success: true,
            orderId: newOrderId,
            amount: payable,
            method: method === 'cod' ? 'cod' : 'online',
          };
          finalize(r);
          return r;
        }

        // 2b. Online — open native Razorpay checkout for the payable remainder
        setStatus('opening_checkout');

        const r = await processOnlinePayment({
          orderId: newOrderId,
          amount: payable,
          userName: user.name,
          userPhone: user.phone,
          userEmail: user.email,
        });

        finalize(r);
        return r;

      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? 'Something went wrong. Please try again.';
        const r: PaymentResult = {
          success: false,
          // Use the ref — guaranteed to be up-to-date even before setState flushes
          orderId: orderIdRef.current ?? '',
          amount: orderData.total_amount,
          errorMessage: msg,
        };
        finalize(r);
        return r;
      }
    },
    // Empty deps: the callback only uses refs and setters — never stale.
    [],
  );

  // ── retryOnlinePayment ───────────────────────────────────────────────────────

  const retryOnlinePayment = useCallback(
    async (
      existingOrderId: string,
      amount: number,
      user: { name: string; phone: string; email?: string },
    ): Promise<PaymentResult> => {
      setStatus('opening_checkout');
      setResult(null);
      setOrder(existingOrderId);

      const r = await processOnlinePayment({
        orderId: existingOrderId,
        amount,
        userName: user.name,
        userPhone: user.phone,
        userEmail: user.email,
      });

      finalize(r);
      return r;
    },
    [],
  );

  // ── reset ────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setOrderId(null);
    orderIdRef.current = null;
  }, []);

  return { status, result, orderId, isLoading, initiatePayment, retryOnlinePayment, reset };
}

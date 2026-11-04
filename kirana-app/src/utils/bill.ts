/**
 * Single source of truth for the customer bill — mirrors the backend
 * (routes/orders.py compute_bill) exactly so the displayed total always equals
 * what the server charges.
 *
 * Tax rules:
 *   - 5% GST on the item subtotal (shown to the customer).
 *   - 18% GST on the delivery charge (merged silently into the total — NOT shown
 *     as a separate line, per the product spec).
 */
export const FOOD_GST_RATE = 0.05;
export const DELIVERY_GST_RATE = 0.18;
export const FREE_DELIVERY_THRESHOLD = 200;
export const STANDARD_DELIVERY_FEE = 20;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Bill {
  subtotal: number;
  foodGst: number;
  deliveryFee: number;   // base fee, displayed
  deliveryGst: number;   // 18% of deliveryFee — folded into grandTotal, not shown
  taxTotal: number;
  grandTotal: number;
}

export function computeBill(subtotal: number): Bill {
  const sub = r2(subtotal);
  const foodGst = r2(sub * FOOD_GST_RATE);
  const deliveryFee = sub >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const deliveryGst = r2(deliveryFee * DELIVERY_GST_RATE);
  return {
    subtotal: sub,
    foodGst,
    deliveryFee,
    deliveryGst,
    taxTotal: r2(foodGst + deliveryGst),
    grandTotal: r2(sub + foodGst + deliveryFee + deliveryGst),
  };
}

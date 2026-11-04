/**
 * One-tap reorder — rebuilds the cart from a past order with LIVE validation:
 *   • re-fetches the store's current menu (never trusts stale order data)
 *   • drops items that no longer exist / are unavailable / out of stock
 *   • re-prices items at TODAY's price (server would enforce anyway — the cart
 *     just tells the truth up front)
 *   • reports every difference so the customer is never silently surprised
 * Returns what changed; the caller shows the summary + navigates to the cart.
 */
import { productsAPI } from '../services/api';
import { useCartStore } from '../store/cartStore';

export interface ReorderResult {
  added: number;
  unavailable: string[];     // item names dropped (gone / out of stock)
  priceChanged: { name: string; from: number; to: number }[];
  ok: boolean;               // false = nothing could be added
}

export async function rebuildCartFromOrder(order: any): Promise<ReorderResult> {
  const items: any[] = order?.items || [];
  const res: ReorderResult = { added: 0, unavailable: [], priceChanged: [], ok: false };
  if (!items.length) return res;

  // One fetch for the whole store menu (orders carry the store as kirana_id).
  let products: any[] = [];
  try {
    if (order.kirana_id) {
      const r = await productsAPI.getAll({ store_id: order.kirana_id });
      products = r.data || [];
    }
  } catch { /* fall through to per-item lookups */ }
  const byId = new Map(products.map((p: any) => [p.id, p]));

  const { clearCart, addItem, updateQuantity } = useCartStore.getState();
  const valid: { item: any; live: any }[] = [];

  for (const it of items) {
    let live = byId.get(it.product_id);
    if (!live && !products.length) {
      // Store menu fetch failed → per-item fallback keeps reorder usable.
      try { live = (await productsAPI.getOne(it.product_id)).data; } catch { live = null; }
    }
    if (!live || live.available === false ||
        (live.item_type === 'grocery' && (live.stock ?? 0) <= 0)) {
      res.unavailable.push(it.name);
      continue;
    }
    if (typeof live.price === 'number' && live.price !== it.price) {
      res.priceChanged.push({ name: it.name, from: it.price, to: live.price });
    }
    valid.push({ item: it, live });
  }

  if (!valid.length) return res;

  // Reorder REPLACES the cart (single-store carts, Swiggy-style).
  clearCart();
  for (const { item, live } of valid) {
    addItem({
      product_id: live.id,
      name: live.name,
      price: live.price,               // today's price
      image: live.image || item.image,
      store_name: live.store_name || item.store_name,
    });
    if ((item.quantity || 1) > 1) updateQuantity(live.id, item.quantity);
  }
  res.added = valid.length;
  res.ok = true;
  return res;
}

/** Human summary of what changed ('' when a perfect rebuild). */
export function reorderSummary(r: ReorderResult): string {
  const parts: string[] = [];
  if (r.unavailable.length) {
    parts.push(`Unavailable now: ${r.unavailable.slice(0, 3).join(', ')}${r.unavailable.length > 3 ? '…' : ''}`);
  }
  if (r.priceChanged.length) {
    parts.push(r.priceChanged.slice(0, 3).map(p => `${p.name}: ₹${p.from} → ₹${p.to}`).join('\n'));
  }
  return parts.join('\n');
}

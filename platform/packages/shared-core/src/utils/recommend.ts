/**
 * recommend — progressive, on-device personalization for the consumer home.
 *
 * Design (agreed product behaviour):
 *   • Cold start (no history): rank by a DEFAULT signal — stores that joined
 *     first / are available surface first (earliest `created_at`), tie-broken by
 *     rating. This is the "normal screen" a brand-new user sees.
 *   • As signals accumulate (orders → favorites → views → searches), a
 *     `personalWeight` ramps 0 → 1 and tailored picks gradually take over. The
 *     app personalizes *slowly* instead of flipping on after one action.
 *
 * Pure functions over already-fetched data — no network, no backend, no writes.
 */

export interface Prefs {
  storeWeight: Record<string, number>;
  categoryWeight: Record<string, number>;
  strength: number;       // raw accumulated signal
  personalWeight: number; // 0..1 — how much personalization to apply
}

const norm = (s?: string) => (s || '').trim().toLowerCase();

// Signal weights — orders count most, a passive view least.
const W_ORDER = 3;
const W_FAVORITE = 2;
const W_VIEW = 1;
const W_SEARCH = 0.5;
// Higher → personalization ramps in more slowly (≈ a few orders to reach full).
const RAMP = 20;

interface DeriveInput {
  orders: any[];
  favorites: any[];
  viewed: { id: string; category?: string; store_name?: string }[];
  searches: string[];
  products: any[]; // current catalogue — used to map ordered items → category
}

export function derivePreferences({ orders, favorites, viewed, searches, products }: DeriveInput): Prefs {
  const storeWeight: Record<string, number> = {};
  const categoryWeight: Record<string, number> = {};
  const bumpStore = (name: string | undefined, w: number) => {
    const k = norm(name);
    if (k) storeWeight[k] = (storeWeight[k] || 0) + w;
  };
  const bumpCat = (cat: string | undefined, w: number) => {
    const k = norm(cat);
    if (k) categoryWeight[k] = (categoryWeight[k] || 0) + w;
  };

  // product_id / name → category, from the loaded catalogue (orders don't store category)
  const catById: Record<string, string> = {};
  const catByName: Record<string, string> = {};
  for (const p of products || []) {
    if (p?.id) catById[p.id] = p.category;
    if (p?.name) catByName[norm(p.name)] = p.category;
  }

  let strength = 0;

  for (const o of orders || []) {
    for (const it of o?.items || []) {
      bumpStore(it.store_name, W_ORDER);
      const cat = catById[it.product_id] || catByName[norm(it.name)];
      if (cat) bumpCat(cat, W_ORDER);
      strength += W_ORDER;
    }
  }
  for (const f of favorites || []) {
    bumpStore(f.store_name, W_FAVORITE);
    bumpCat(f.category, W_FAVORITE);
    strength += W_FAVORITE;
  }
  for (const v of viewed || []) {
    bumpStore(v.store_name, W_VIEW);
    bumpCat(v.category, W_VIEW);
    strength += W_VIEW;
  }
  for (const term of (searches || []).slice(0, 10)) {
    const t = norm(term);
    if (!t) continue;
    for (const p of products || []) {
      if (norm(p.category).includes(t) || norm(p.name).includes(t)) bumpCat(p.category, W_SEARCH);
    }
    strength += W_SEARCH;
  }

  const personalWeight = Math.max(0, Math.min(1, strength / RAMP));
  return { storeWeight, categoryWeight, strength, personalWeight };
}

// "Joined first" default rank. A store's EARLIEST listing time stands in for when
// it joined, so an established seller's whole menu surfaces first for new users.
// Earliest-joined store → 1, newest → 0.
function buildJoinScorer(products: any[]): (p: any) => number {
  const storeFirst: Record<string, number> = {};
  for (const p of products) {
    const t = Date.parse(p?.created_at);
    if (Number.isNaN(t)) continue;
    const sid = p?.store_id || p?.store_name || '';
    if (storeFirst[sid] == null || t < storeFirst[sid]) storeFirst[sid] = t;
  }
  const times = Object.values(storeFirst);
  if (!times.length) return () => 0;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);
  return (p: any) => {
    const sid = p?.store_id || p?.store_name || '';
    const t = storeFirst[sid];
    if (t == null) return 0;
    return 1 - (t - min) / span;
  };
}

const sellable = (p: any) =>
  p?.available !== false && !(p?.item_type === 'grocery' && (p?.stock ?? 1) <= 0);

/**
 * "Recommended For You": blends the default (rating + joined-first) signal with
 * the personal (preferred categories/stores) signal, scaled by personalWeight.
 */
export function buildRecommended(products: any[], prefs: Prefs, limit = 10): any[] {
  const pool = (products || []).filter(sellable);
  const joinScore = buildJoinScorer(pool);
  return pool
    .map((p) => {
      const base = (Number(p.rating) || 0) * 0.6 + joinScore(p) * 2;
      const pers = (prefs.categoryWeight[norm(p.category)] || 0) + (prefs.storeWeight[norm(p.store_name)] || 0);
      return { p, score: base + pers * prefs.personalWeight };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * "Personalized Offers": discounted items (mrp > price). When the consumer has
 * history, preferred categories/stores float to the top. Empty when the
 * catalogue has no discounts (caller hides the rail).
 */
export function buildOffers(products: any[], prefs: Prefs, limit = 10): any[] {
  const discounted = (products || []).filter(
    (p) => sellable(p) && typeof p.mrp === 'number' && p.mrp > p.price,
  );
  if (!discounted.length) return [];
  return discounted
    .map((p) => {
      const discountPct = (p.mrp - p.price) / p.mrp;
      const pers = (prefs.categoryWeight[norm(p.category)] || 0) + (prefs.storeWeight[norm(p.store_name)] || 0);
      return { p, score: discountPct * 3 + (Number(p.rating) || 0) * 0.4 + pers * prefs.personalWeight };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

const DESSERT_RX = /dessert|sweet|cake|pastry|ice ?cream|chocolate|mithai|gulab|jalebi|halwa|kulfi|brownie|donut|cookie|rasgulla|barfi|laddu|ladoo|kheer/i;

/**
 * Smart search fallback — never a blank page. Prefers desserts/sweets; if the
 * catalogue has none, shows the top-rated nearby items instead.
 */
export function searchFallback(catalogue: any[], limit = 10): any[] {
  const avail = (catalogue || []).filter(sellable);
  const desserts = avail.filter((p) => DESSERT_RX.test(p.category || '') || DESSERT_RX.test(p.name || ''));
  const pool = desserts.length ? desserts : avail;
  return pool.slice().sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)).slice(0, limit);
}

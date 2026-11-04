/**
 * Is a dish's restaurant open for orders right now?
 *
 * The backend stamps every product row with `store_open` and `store_status`
 * ({state, title, detail}), resolved from the restaurant's saved operating
 * hours (IST), its manual online switch and its approval — the same answer the
 * restaurant page and the order guard use. The app never reads the phone's
 * clock for this. A row without the stamp (an older backend) is treated as
 * open, exactly as before, and the order guard still has the final say.
 */
export const isStoreClosed = (p: any): boolean => p?.store_open === false;

/** Short veil text for a closed restaurant's dish: "Closed" + "Opens today at 2:30 PM". */
export function closedVeil(p: any): { title: string; detail: string | null } {
  const s = p?.store_status || {};
  return s.state === 'closed'
    ? { title: 'Closed', detail: s.detail || null }
    : { title: 'Unavailable', detail: null };
}

/** Orderable dishes first; closed restaurants' dishes keep their order after them. */
export function orderableFirst<T>(list: T[]): T[] {
  return [...list].sort((a: any, b: any) => Number(isStoreClosed(a)) - Number(isStoreClosed(b)));
}

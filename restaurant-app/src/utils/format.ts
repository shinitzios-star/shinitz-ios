/**
 * Phone formatting — ONE consistent format across the whole app: "+91 XXXXXXXXXX".
 *
 * Backend stores phones as "91XXXXXXXXXX" (no plus). These helpers normalise
 * any input (with/without 91, with/without +, with stray spaces) so the consumer,
 * rider, restaurant and admin apps all show + dial the same way.
 */

/** Strip to the 10-digit subscriber number (drops 91 / 0 / + / spaces). */
function tenDigits(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return '';
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Display format: "+91 9876543210" (empty string if no number). */
export function formatPhone(raw?: string | number | null): string {
  const d = tenDigits(raw);
  return d ? `+91 ${d}` : '';
}

/** tel: URI for dialer — E.164, no spaces: "tel:+919876543210". */
export function telLink(raw?: string | number | null): string {
  const d = tenDigits(raw);
  return d ? `tel:+91${d}` : '';
}

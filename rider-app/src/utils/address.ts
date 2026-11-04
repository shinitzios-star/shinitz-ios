import * as Location from 'expo-location';
import { getPosition } from './location';
import type { SelectedAddress } from '../store/addressStore';

/**
 * Resolve usable coordinates for an address. Prefers the address's own stored
 * lat/lng; falls back to geocoding the text (legacy saved addresses have no
 * coords). Returns null only if neither is available.
 */
export async function resolveCoords(
  addr: SelectedAddress | null,
): Promise<{ lat: number; lng: number } | null> {
  if (!addr) return null;
  if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
    return { lat: addr.lat, lng: addr.lng };
  }
  if (addr.full_address) {
    try {
      const g = await Location.geocodeAsync(addr.full_address);
      if (g && g[0]) return { lat: g[0].latitude, lng: g[0].longitude };
    } catch {
      // fall through
    }
  }
  return null;
}

/**
 * Build a SelectedAddress from the device's current GPS position (with a
 * reverse-geocoded human label). Returns null if permission is denied or the
 * fix fails.
 */
export async function currentLocationAddress(): Promise<SelectedAddress | null> {
  try {
    // Bounded, validated, with the device cache and the last stored fix
    // behind it — see utils/location.
    const fix = await getPosition({ timeoutMs: 10000 });
    if (!fix) return null;
    const lat = fix.lat;
    const lng = fix.lng;
    let full = '';
    try {
      const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (a) {
        full = [a.streetNumber, a.street, a.district, a.city, a.postalCode]
          .filter(Boolean)
          .join(', ');
      }
    } catch {
      // keep coords even if reverse geocode fails
    }
    return { id: null, label: 'Current Location', full_address: full || 'Current location', lat, lng };
  } catch {
    return null;
  }
}

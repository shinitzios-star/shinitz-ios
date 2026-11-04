/**
 * OSRM routing service — 100% free, no API key.
 *
 * Uses the public OSRM demo server. For production, self-host:
 *   https://github.com/Project-OSRM/osrm-backend
 *
 * Results are cached for 30 s keyed on 4-decimal-place coords (~11 m grid)
 * so the rider map doesn't re-fetch on every 5-second GPS ping.
 */

const OSRM_BASE = 'http://router.project-osrm.org/route/v1/driving';
const CACHE_TTL = 30_000; // ms

export interface Route {
  /** [lat, lng] pairs ready for react-native-maps <Polyline> */
  polyline: { latitude: number; longitude: number }[];
  distanceKm: number;
  etaMinutes: number;
}

const _cache = new Map<string, { route: Route; at: number }>();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<Route> {
  const key = `${fromLat.toFixed(4)},${fromLng.toFixed(4)},${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.route;

  try {
    // OSRM expects [lng, lat] order
    const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const r    = data.routes[0];

    // GeoJSON is [lng, lat] — flip to react-native-maps {latitude, longitude}
    const polyline: Route['polyline'] = r.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }),
    );
    const route: Route = {
      polyline,
      distanceKm:  +(r.distance / 1000).toFixed(2),
      etaMinutes:  Math.max(1, Math.round(r.duration / 60)),
    };
    _cache.set(key, { route, at: Date.now() });
    return route;
  } catch {
    // Straight-line fallback when OSRM is unreachable
    const dist = haversineKm(fromLat, fromLng, toLat, toLng);
    return {
      polyline:    [{ latitude: fromLat, longitude: fromLng }, { latitude: toLat, longitude: toLng }],
      distanceKm:  +dist.toFixed(2),
      etaMinutes:  Math.max(1, Math.round(dist / 0.25)),  // ~15 km/h
    };
  }
}

export function haversineKmExport(lat1: number, lng1: number, lat2: number, lng2: number) {
  return haversineKm(lat1, lng1, lat2, lng2);
}

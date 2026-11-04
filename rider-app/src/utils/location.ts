import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { ensureLocationAccess } from '../delivery/locationConsent';
import { Linking, Platform } from 'react-native';

/**
 * One way to ask this device where it is.
 *
 * Every screen used to call `getCurrentPositionAsync` directly, which fails
 * differently on every phone: it can hang forever when the GPS never gets a
 * fix, it answers happily while location services are switched off, and it
 * sometimes returns coordinates that are not a place (0,0 or NaN). None of
 * those callers had a timeout, a validity check, or anything to fall back on,
 * so the screen simply sat there with no location.
 *
 * The order here is fixed:
 *
 *    fresh fix  →  the device's own cached fix  →  the last good fix we stored
 *
 * and whatever comes back is always validated first. A caller can tell which
 * one it got from `source`, so a remembered position is never presented as a
 * live one.
 */

const LAST_FIX_KEY = 'last_good_location';

/** How old a stored fix may be and still be worth offering (7 days). */
const STORED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** How old the device's own cached fix may be before we ignore it (10 min). */
const DEVICE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
/** A fix this rough is a cell-tower guess, not a location (metres). */
const MAX_USABLE_ACCURACY_M = 5000;

export type FixSource = 'fresh' | 'device-cache' | 'stored';

export interface Fix {
  lat: number;
  lng: number;
  /** Metres, when the platform reports it. */
  accuracy: number | null;
  /** When this position was measured (epoch ms). */
  at: number;
  source: FixSource;
}

export interface PermissionState {
  granted: boolean;
  /** False once the user has permanently denied — only Settings can undo it. */
  canAskAgain: boolean;
  /** The device's location switch. Permission can be granted while this is off. */
  servicesEnabled: boolean;
}

const log = (...args: any[]) => {
  if (__DEV__) console.log('[location]', ...args);
};

/**
 * Is this a position on Earth that we can use?
 *
 * Rejects nulls, NaN, out-of-range values and the null island (0,0) that a
 * failed fix reports as success.
 */
export function isValidCoords(lat: any, lng: any): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;   // 0,0
  return true;
}

function toFix(pos: Location.LocationObject | null, source: FixSource): Fix | null {
  if (!pos?.coords) return null;
  const { latitude, longitude, accuracy } = pos.coords;
  if (!isValidCoords(latitude, longitude)) {
    log('rejected invalid coords from', source, latitude, longitude);
    return null;
  }
  if (typeof accuracy === 'number' && accuracy > MAX_USABLE_ACCURACY_M) {
    log('rejected coarse fix from', source, `${Math.round(accuracy)}m`);
    return null;
  }
  return {
    lat: latitude,
    lng: longitude,
    accuracy: typeof accuracy === 'number' ? accuracy : null,
    at: pos.timestamp || Date.now(),
    source,
  };
}

/** The last position we successfully used, across restarts. */
export async function getStoredFix(): Promise<Fix | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    const f = JSON.parse(raw) as Fix;
    if (!isValidCoords(f?.lat, f?.lng)) return null;
    if (!f.at || Date.now() - f.at > STORED_MAX_AGE_MS) {
      log('stored fix too old, ignoring');
      return null;
    }
    return { ...f, source: 'stored' };
  } catch {
    return null;
  }
}

async function rememberFix(fix: Fix): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_FIX_KEY, JSON.stringify(fix));
  } catch {
    /* a fix we cannot cache is still a fix we can use */
  }
}

/** Permission + device switch, in one look. */
export async function getPermissionState(): Promise<PermissionState> {
  let granted = false;
  let canAskAgain = true;
  try {
    const p = await Location.getForegroundPermissionsAsync();
    granted = p.status === 'granted';
    canAskAgain = p.canAskAgain !== false;
  } catch { /* treated as not granted */ }
  let servicesEnabled = true;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch { /* assume on; the fix attempt will tell us */ }
  return { granted, canAskAgain, servicesEnabled };
}

/** Send the user to the place where they can undo a permanent denial. */
export function openLocationSettings(): void {
  if (Platform.OS === 'ios') Linking.openURL('app-settings:').catch(() => {});
  else Linking.openSettings().catch(() => {});
}

/**
 * Where is this device?
 *
 * Never throws and never hangs: `timeoutMs` bounds the GPS attempt, after
 * which the cached and stored positions are tried in turn. Returns null only
 * when there is genuinely nothing usable — the caller should then ask the
 * person to choose a location.
 */
export async function getPosition(opts: {
  /** How long to wait for a fresh fix before falling back. */
  timeoutMs?: number;
  /** Ask for permission if it has not been granted yet. */
  request?: boolean;
  /** Set false to refuse a remembered position (e.g. an explicit refresh). */
  allowStored?: boolean;
  accuracy?: Location.Accuracy;
} = {}): Promise<Fix | null> {
  const {
    timeoutMs = 8000,
    request = true,
    allowStored = true,
    accuracy = Location.Accuracy.Balanced,
  } = opts;

  const fallback = async (why: string): Promise<Fix | null> => {
    if (!allowStored) {
      log('no fresh fix and stored not allowed:', why);
      return null;
    }
    const stored = await getStoredFix();
    log(why, '→ stored fix', stored ? 'used' : 'unavailable');
    return stored;
  };

  // ── permission ───────────────────────────────────────────────────────────
  let state = await getPermissionState();
  if (!state.granted && request) {
    // Through the consent gate, so the prominent disclosure always comes
    // before the system dialog (and a "Don't ask again" lands on Settings).
    try {
      const a = await ensureLocationAccess({ background: false, mode: 'explicit' });
      state = { ...state, granted: !!a.foreground };
    } catch { /* stays not granted */ }
  }
  if (!state.granted) return fallback('permission not granted');

  // ── the device's location switch ─────────────────────────────────────────
  // Permission says the APP may read location; this says the PHONE is willing
  // to produce one. With it off, a fix request simply never answers.
  if (!state.servicesEnabled) return fallback('location services are off');

  // ── a fresh fix, but not an unbounded wait ───────────────────────────────
  let fresh: Fix | null = null;
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      timeout,
    ]);
    fresh = toFix(pos as Location.LocationObject | null, 'fresh');
    if (!pos) log(`no fix within ${timeoutMs}ms`);
  } catch (e: any) {
    log('fix request failed:', e?.message || e);
  }
  if (fresh) {
    await rememberFix(fresh);
    log('fresh fix', fresh.lat.toFixed(5), fresh.lng.toFixed(5),
        fresh.accuracy ? `±${Math.round(fresh.accuracy)}m` : '');
    return fresh;
  }

  // ── the device's own last fix (instant, often good enough) ───────────────
  try {
    const cached = await Location.getLastKnownPositionAsync({
      maxAge: DEVICE_CACHE_MAX_AGE_MS,
    });
    const fix = toFix(cached, 'device-cache');
    if (fix) {
      await rememberFix(fix);
      log('device-cached fix used');
      return fix;
    }
  } catch { /* fall through */ }

  return fallback('no fresh or cached fix');
}

/**
 * The fastest usable answer: the device's cached fix if it has one, otherwise
 * what we stored. Used to paint a screen immediately while `getPosition`
 * refines it in the background.
 */
export async function getQuickFix(): Promise<Fix | null> {
  try {
    const { granted, servicesEnabled } = await getPermissionState();
    if (granted && servicesEnabled) {
      const cached = await Location.getLastKnownPositionAsync({ maxAge: DEVICE_CACHE_MAX_AGE_MS });
      const fix = toFix(cached, 'device-cache');
      if (fix) return fix;
    }
  } catch { /* fall through */ }
  return getStoredFix();
}

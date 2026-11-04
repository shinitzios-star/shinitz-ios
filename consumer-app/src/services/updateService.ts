/**
 * updateService — decides whether to show the "New Update Available" screen.
 *
 * Source of truth: the release the Shinitz admin publishes for this app
 * (GET /api/app-version/<app>), compared against what is installed on this
 * phone. Google offers no API for an app's latest store version, and Shinitz
 * builds are often released under an unchanged version NAME, so the store
 * listing could not tell us anyway — the build number (versionCode) is the
 * comparison that works. See backend routes/app_version.py.
 *
 * Every function here is total: no network error, timeout, malformed answer or
 * missing Play Store can throw past this module. The worst case is "no prompt".
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Linking } from 'react-native';
import {
  DEBUG_RELEASE, PLAY_STORE_MARKET_URL, PLAY_STORE_URL, RELEASE_CONFIG_URL,
  UPDATE_DEBUG_MODE, UPDATE_TIMING,
} from '../constants/appUpdate';
import { InstalledVersion, isBehind, parseBuild, parseVersion } from '../utils/versionUtils';

export interface Release {
  configured: boolean;
  latest_version: string | null;
  latest_build: number | null;
  min_supported_version: string | null;
  min_supported_build: number | null;
  mandatory: boolean;
  title: string;
  notes: string[];
  mandatory_message: string;
}

export type UpdateDecision =
  | { kind: 'none' }
  | { kind: 'optional' | 'mandatory'; release: Release; key: string; installed: InstalledVersion };

const NONE: UpdateDecision = { kind: 'none' };
const CACHE_KEY = 'appUpdate:release';
const DISMISS_KEY = 'appUpdate:dismissed';

const log = (...a: any[]) => { if (__DEV__) console.log('[update]', ...a); };

/** What is actually installed — the version name and build baked in at build time. */
export function getInstalledVersion(): InstalledVersion {
  const c: any = Constants.expoConfig ?? {};
  return {
    version: parseVersion(c.version) ? String(c.version) : null,
    build: parseBuild(c.android?.versionCode),
  };
}

/** Trust nothing from the network: coerce to the expected shape or reject. */
export function sanitizeRelease(raw: any): Release | null {
  if (!raw || typeof raw !== 'object') return null;
  const version = typeof raw.latest_version === 'string' && parseVersion(raw.latest_version)
    ? raw.latest_version.trim() : null;
  const build = parseBuild(raw.latest_build);
  const configured = raw.configured === true && (version !== null || build !== null);
  return {
    configured,
    latest_version: version,
    latest_build: build,
    min_supported_version: typeof raw.min_supported_version === 'string'
      && parseVersion(raw.min_supported_version) ? raw.min_supported_version.trim() : null,
    min_supported_build: parseBuild(raw.min_supported_build),
    mandatory: raw.mandatory === true,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 40) : "What's New",
    notes: Array.isArray(raw.notes)
      ? raw.notes.filter((n: any) => typeof n === 'string' && n.trim()).map((n: string) => n.trim().slice(0, 90)).slice(0, 6)
      : [],
    mandatory_message: typeof raw.mandatory_message === 'string' && raw.mandatory_message.trim()
      ? raw.mandatory_message.trim().slice(0, 240)
      : DEBUG_RELEASE.mandatory_message,
  };
}

/** Identifies one release, so a dismissal applies to it and not to the next one. */
export function releaseKey(r: Release): string {
  return `${r.latest_build ?? ''}|${r.latest_version ?? ''}`;
}

/**
 * Pure decision. Behind the latest release → an update; also below the minimum
 * supported (or the release is flagged mandatory) → it cannot be skipped.
 */
export function decide(installed: InstalledVersion, release: Release | null): UpdateDecision {
  if (!release || !release.configured) return NONE;
  if (!isBehind(installed, { version: release.latest_version, build: release.latest_build })) return NONE;
  const belowMinimum = isBehind(installed, {
    version: release.min_supported_version, build: release.min_supported_build,
  });
  return {
    kind: release.mandatory || belowMinimum ? 'mandatory' : 'optional',
    release, key: releaseKey(release), installed,
  };
}

async function fetchRelease(): Promise<Release | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPDATE_TIMING.requestTimeoutMs);
  try {
    const res = await fetch(RELEASE_CONFIG_URL, {
      signal: ctrl.signal, headers: { Accept: 'application/json' },
    });
    if (!res.ok) { log('config HTTP', res.status); return null; }
    return sanitizeRelease(await res.json());
  } catch (e: any) {
    log('config fetch failed:', e?.name === 'AbortError' ? 'timeout' : e?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(): Promise<{ release: Release | null; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return { release: sanitizeRelease(j.release), at: Number(j.at) || 0 };
  } catch { return null; }
}

async function isOnline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return !(s.isConnected === false || s.isInternetReachable === false);
  } catch { return true; }   // unknown → let the request (and its timeout) decide
}

/**
 * The current release, from the network if the cached copy is older than
 * `maxAgeMs`, otherwise from cache. The cache is what keeps a mandatory update
 * on screen across relaunches without a request every time.
 */
async function getRelease(maxAgeMs: number): Promise<Release | null> {
  const cached = await readCache();
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.release;
  if (!(await isOnline())) { log('offline — using cached release'); return cached?.release ?? null; }
  const fresh = await fetchRelease();
  if (!fresh) return cached?.release ?? null;           // failed: keep what we knew
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ release: fresh, at: Date.now() }));
  } catch { /* cache is an optimisation */ }
  return fresh;
}

async function dismissedRecently(key: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const j = JSON.parse(raw);
    return j.key === key && Date.now() - Number(j.at) < UPDATE_TIMING.remindAfterMs;
  } catch { return false; }
}

/**
 * Should the update screen show right now, and as what?
 * `maxAgeMs`: how stale a cached release may be before asking the server again.
 */
export async function checkForUpdate(maxAgeMs: number = UPDATE_TIMING.recheckIntervalMs): Promise<UpdateDecision> {
  try {
    if (UPDATE_DEBUG_MODE === 'optional' || UPDATE_DEBUG_MODE === 'mandatory') {
      const mock = sanitizeRelease({ ...DEBUG_RELEASE, mandatory: UPDATE_DEBUG_MODE === 'mandatory' });
      const d = decide(getInstalledVersion(), mock);
      if (d.kind === 'optional' && (await dismissedRecently(d.key))) return NONE;
      log('debug mode:', UPDATE_DEBUG_MODE);
      return d;
    }
    if (__DEV__ && UPDATE_DEBUG_MODE !== 'live') return NONE;   // dev: stay out of the way

    const installed = getInstalledVersion();
    const decision = decide(installed, await getRelease(maxAgeMs));
    log('installed', installed, '→', decision.kind);
    if (decision.kind === 'optional' && (await dismissedRecently(decision.key))) return NONE;
    return decision;
  } catch (e: any) {
    log('check failed:', e?.message || e);
    return NONE;
  }
}

/** "Maybe Later": quiet for this release until the reminder period passes. */
export async function dismissOptional(key: string): Promise<void> {
  try { await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify({ key, at: Date.now() })); }
  catch { /* worst case it shows again next time */ }
}

/** Opens this app's Play Store page: the Play Store app first, the web page if that fails. */
export async function openStore(): Promise<boolean> {
  for (const url of [PLAY_STORE_MARKET_URL, PLAY_STORE_URL]) {
    try { await Linking.openURL(url); return true; }
    catch (e: any) { log('could not open', url, e?.message || e); }
  }
  return false;
}

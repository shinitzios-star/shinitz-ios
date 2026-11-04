/**
 * locationConsent — the ONLY place the rider app asks Android for location.
 *
 * Google Play rejected the app for "accessing BACKGROUND_LOCATION without a
 * prominent disclosure". A disclosure existed, but only on the background
 * prompt at the start of a live delivery — behind OTP login, the daily selfie,
 * going online and a real order within 3 km — so no reviewer could ever reach
 * it, while five other code paths raised the system location dialog with no
 * disclosure at all (one of them a 15-second background poll).
 *
 * Every location permission request now comes through here, in this order:
 *
 *    prominent disclosure  →  "Agree & Continue"
 *        →  foreground permission (FINE + COARSE)
 *        →  background permission ("Allow all the time"), when asked for
 *
 * and nothing reaches the system dialog without the disclosure in front of it.
 * Background polls never prompt: they call `hasForegroundLocation()` and use
 * location only if it was already granted.
 *
 * Accepting the disclosure is NOT the same as the permission being granted.
 * The real Android state is read on every call, so a permission revoked in
 * Settings is noticed and the flow runs again.
 */
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

export type ConsentPrompt = 'disclosure' | 'foreground_denied' | 'background_denied' | 'approximate';
export type PromptAnswer = 'agree' | 'settings' | 'dismiss';

/** Rendered by LocationConsentHost; resolves with what the rider tapped. */
type Presenter = (prompt: ConsentPrompt) => Promise<PromptAnswer>;
let _present: Presenter | null = null;
let _waiting: Array<() => void> = [];

export function setLocationConsentPresenter(fn: Presenter | null): void {
  _present = fn;
  if (fn) { _waiting.forEach((w) => w()); _waiting = []; }
}

// A screen can ask in its first effect, before the root host's own effect has
// registered — React runs effects child-first. Waiting briefly means that first
// ask is shown rather than silently dropped; it never prompts without the host.
function presenterReady(ms: number): Promise<void> {
  if (_present) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    _waiting.push(() => { clearTimeout(t); resolve(); });
  });
}

export interface LocationAccess {
  foreground: boolean;
  background: boolean;
  /** Fine accuracy — false when the rider chose "Approximate". */
  precise: boolean;
}

/**
 * explicit: the rider just did something that needs location (tapped Go
 *           Online, "Use my location") — always runs the flow when needed.
 * auto:     the app needs it on its own (entering the dashboard, a delivery
 *           starting) — suppressed for a while after the rider says no, so
 *           they are not asked again and again.
 */
export type ConsentMode = 'explicit' | 'auto';

const ACCEPTED_KEY = 'locationDisclosure:acceptedAt';
const DECLINED_KEY = 'locationDisclosure:declinedAt';
const AUTO_QUIET_MS = 24 * 60 * 60 * 1000;

async function readAccess(): Promise<LocationAccess & { canAskForeground: boolean; canAskBackground: boolean }> {
  const fg = await Location.getForegroundPermissionsAsync();
  let bg = { status: 'undetermined', canAskAgain: true } as Location.PermissionResponse;
  try { bg = await Location.getBackgroundPermissionsAsync(); } catch { /* not declared */ }
  return {
    foreground: fg.status === 'granted',
    background: bg.status === 'granted',
    precise: fg.status === 'granted' && (fg as any).android?.accuracy !== 'coarse',
    canAskForeground: fg.canAskAgain !== false,
    canAskBackground: bg.canAskAgain !== false,
  };
}

/** Check only — never prompts. For polls, watchers and background work. */
export async function hasForegroundLocation(): Promise<boolean> {
  try { return (await Location.getForegroundPermissionsAsync()).status === 'granted'; }
  catch { return false; }
}

export async function hasBackgroundLocation(): Promise<boolean> {
  try { return (await Location.getBackgroundPermissionsAsync()).status === 'granted'; }
  catch { return false; }
}

export async function getLocationAccess(): Promise<LocationAccess> {
  try {
    const a = await readAccess();
    return { foreground: a.foreground, background: a.background, precise: a.precise };
  } catch {
    return { foreground: false, background: false, precise: false };
  }
}

async function recentlyDeclined(): Promise<boolean> {
  try {
    const at = Number(await AsyncStorage.getItem(DECLINED_KEY));
    return !!at && Date.now() - at < AUTO_QUIET_MS;
  } catch { return false; }
}

async function remember(key: string): Promise<void> {
  try { await AsyncStorage.setItem(key, String(Date.now())); } catch { /* best effort */ }
}

async function forget(key: string): Promise<void> {
  try { await AsyncStorage.removeItem(key); } catch { /* best effort */ }
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}

// One flow at a time: going online and the dashboard's own check can both ask
// in the same moment, and two disclosures stacked on top of each other is
// exactly the kind of nagging the policy forbids.
let _inFlight: Promise<LocationAccess> | null = null;

// Whether a consent flow is running (the disclosure, Android's own dialogs, or
// the Settings page for "Allow all the time"). Other root-level prompts — the
// optional "New Update Available" screen — wait for it instead of stacking on top.
const _busyListeners = new Set<(busy: boolean) => void>();
function setBusy(busy: boolean) { _busyListeners.forEach((l) => l(busy)); }
export function onLocationConsentBusy(cb: (busy: boolean) => void): () => void {
  _busyListeners.add(cb);
  cb(_inFlight !== null);
  return () => { _busyListeners.delete(cb); };
}

/**
 * Make sure the rider has the location access a feature needs, running the
 * disclosure → foreground → background sequence only when something is missing.
 * Never throws; returns the real state afterwards.
 */
export function ensureLocationAccess(opts: { background: boolean; mode: ConsentMode }): Promise<LocationAccess> {
  if (_inFlight) return _inFlight;
  _inFlight = run(opts).finally(() => { _inFlight = null; setBusy(false); });
  setBusy(true);
  return _inFlight;
}

async function run({ background, mode }: { background: boolean; mode: ConsentMode }): Promise<LocationAccess> {
  let state;
  try { state = await readAccess(); } catch { return { foreground: false, background: false, precise: false }; }
  const result = () => ({ foreground: state.foreground, background: state.background, precise: state.precise });

  const needForeground = !state.foreground;
  const needBackground = background && !state.background;
  if (!needForeground && !needBackground) return result();   // granted: nothing to show

  // No UI mounted (a headless task) → never prompt: a system dialog must not
  // appear without the disclosure in front of it.
  await presenterReady(3000);
  if (!_present) return result();

  // A rider who said no is not asked again on every screen and every poll.
  // Automatic checks wait out the quiet period; an explicit action still asks
  // for FOREGROUND (they cannot work without it) but does not re-run the whole
  // disclosure merely because they chose "While using the app".
  const quiet = await recentlyDeclined();
  if (mode === 'auto' && quiet) return result();
  if (mode === 'explicit' && quiet && !needForeground) return result();

  // ── 1. Prominent disclosure — always before any system dialog ─────────────
  const choice = await _present('disclosure');
  if (choice !== 'agree') {
    await remember(DECLINED_KEY);
    return result();
  }
  await remember(ACCEPTED_KEY);
  // Counted as declined until Android reports the grant. On Android 11+ the
  // background choice happens on a Settings page OUTSIDE the app; a rider who
  // swipes the app away from there never returns to this function, and without
  // this the next launch would put the whole disclosure in front of them again.
  await remember(DECLINED_KEY);

  // ── 2. Foreground ─────────────────────────────────────────────────────────
  if (!state.foreground) {
    if (state.canAskForeground) {
      try {
        const r = await Location.requestForegroundPermissionsAsync();
        state.foreground = r.status === 'granted';
        state.precise = state.foreground && (r as any).android?.accuracy !== 'coarse';
        state.canAskForeground = r.canAskAgain !== false;
      } catch { /* stays denied */ }
    }
    if (!state.foreground) {
      // Denied now, or "Don't ask again" earlier: Android will not show its
      // dialog any more, so the only route back is Settings. Asked once, never
      // looped.
      await remember(DECLINED_KEY);
      if ((await _present('foreground_denied')) === 'settings') openAppSettings();
      return result();
    }
  }

  // "Approximate" was chosen — tracking a moving rider to a doorstep needs the
  // precise fix. Explained once; the rider can carry on regardless.
  if (!state.precise && Platform.OS === 'android') {
    if ((await _present('approximate')) === 'settings') openAppSettings();
  }

  // ── 3. Background — only when the feature needs it ───────────────────────
  // Requested on its own, AFTER foreground: Android 11+ refuses to offer
  // "Allow all the time" in the same request, and sends the rider to the app's
  // location settings page for it instead.
  if (background && !state.background) {
    if (state.canAskBackground) {
      try {
        const r = await Location.requestBackgroundPermissionsAsync();
        state.background = r.status === 'granted';
      } catch { /* stays denied */ }
    }
    if (!state.background) {
      await remember(DECLINED_KEY);
      if ((await _present('background_denied')) === 'settings') openAppSettings();
    }
  }
  // Everything this feature asked for was granted: lift the quiet period.
  if (state.foreground && (!background || state.background)) await forget(DECLINED_KEY);
  return result();
}

/**
 * App-update configuration — the one place the update screen's settings live.
 *
 * RESTAURANT APP. The Play Store ID here is fixed rather than read from the
 * build: the live listing is
 * https://play.google.com/store/apps/details?id=com.shinitz.restaurant, and
 * "Update Now" must open exactly that page — never another app's listing
 * because the build config could not be read.
 */

/** The Shinitz Restaurant partner listing on Google Play. */
export const PLAY_STORE_ID = 'com.shinitz.restaurant';

/** Kept under its old name for the rest of the update code. */
export const APPLICATION_ID: string = PLAY_STORE_ID;

/** Which release config to read on the backend. */
export const APP_KEY = 'restaurant';

/** Opens the Play Store app itself. */
export const PLAY_STORE_MARKET_URL = `market://details?id=${PLAY_STORE_ID}`;
/** Web fallback for devices without the Play Store app. */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;

const API_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://shinitz-backend.onrender.com')
  .replace(/\/$/, '');
export const RELEASE_CONFIG_URL = `${API_URL}/api/app-version/${APP_KEY}`;

export const UPDATE_TIMING = {
  /** Wait after start-up so the check never competes with the first screen. */
  launchDelayMs: 1500,
  /** Coming back to the foreground re-checks at most this often. */
  recheckIntervalMs: 30 * 60 * 1000,
  /** A dismissed optional update comes back after this — or straight away if a
   *  NEWER release is published in the meantime. */
  remindAfterMs: 72 * 60 * 60 * 1000,
  /** Give up on a slow network rather than hold anything up. */
  requestTimeoutMs: 8000,
};

/**
 * Testing the screen without publishing a release.
 *
 *   EXPO_PUBLIC_UPDATE_DEBUG=optional    → a sample optional update
 *   EXPO_PUBLIC_UPDATE_DEBUG=mandatory   → a sample mandatory update
 *   EXPO_PUBLIC_UPDATE_DEBUG=live        → the real check, even in development
 *   (unset)                              → development skips the check entirely
 *
 * Honoured ONLY in development builds. `__DEV__` is false in every release
 * build, so a value left in .env can never reach a user's phone.
 */
type DebugMode = 'off' | 'optional' | 'mandatory' | 'live';
const requested = (process.env.EXPO_PUBLIC_UPDATE_DEBUG || '').trim().toLowerCase();
export const UPDATE_DEBUG_MODE: DebugMode =
  __DEV__ && ['optional', 'mandatory', 'live'].includes(requested) ? (requested as DebugMode) : 'off';

/** What the debug modes show — the same shape the server returns. */
export const DEBUG_RELEASE = {
  configured: true,
  latest_version: '9.9.0',
  latest_build: 999999,
  min_supported_version: null as string | null,
  min_supported_build: null as number | null,
  mandatory: false,
  title: "What's New",
  notes: [
    'Faster app performance',
    'Improved order tracking',
    'Better user experience',
    'Bug fixes & stability improvements',
  ],
  mandatory_message:
    'This update is required to continue using Shinitz. Please update the app to get the latest version.',
};

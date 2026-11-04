/**
 * Version comparison for the update prompt.
 *
 * Version NAMES are compared numerically part by part — never as strings, where
 * "1.10.0" < "1.9.0". Missing parts count as 0, so "1.6" equals "1.6.0".
 *
 * Build NUMBERS (Android versionCode) are the more reliable signal: Shinitz has
 * shipped new builds without changing the name (the Consumer app was "1.5.5" at
 * both versionCode 12 and 13), and Play itself decides "newer" by versionCode.
 */

export type Semver = [number, number, number];

/** "1.6.0" → [1, 6, 0]. Returns null for anything that isn't a plain version. */
export function parseVersion(v: unknown): Semver | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^v?(\d{1,6})(?:\.(\d{1,6}))?(?:\.(\d{1,6}))?(?:[-+].*)?$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** -1 if a < b, 0 if equal, 1 if a > b. Null when either side is not a version. */
export function compareVersions(a: unknown, b: unknown): -1 | 0 | 1 | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

export function isOlder(installed: unknown, other: unknown): boolean {
  return compareVersions(installed, other) === -1;
}

/** A positive integer build number, or null. */
export function parseBuild(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

export interface InstalledVersion {
  version: string | null;
  build: number | null;
}

/**
 * Is `installed` behind `target`? Uses the build number when BOTH sides have
 * one (that is what Play compares), otherwise the version name. Unknown on
 * either side → false: never prompt on a guess.
 */
export function isBehind(
  installed: InstalledVersion,
  target: { version?: string | null; build?: number | null },
): boolean {
  const tb = parseBuild(target.build);
  if (tb !== null && installed.build !== null) return installed.build < tb;
  if (target.version && installed.version) return isOlder(installed.version, target.version);
  return false;
}

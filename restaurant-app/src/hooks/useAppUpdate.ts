import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { UPDATE_TIMING } from '../constants/appUpdate';
import {
  checkForUpdate, dismissOptional, openStore, type UpdateDecision,
} from '../services/updateService';

/** How fresh the release must be on a cold start — tighter than foreground re-checks. */
const LAUNCH_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * When to check, and what the screen should do about it.
 *
 *  • on launch, a moment after start-up (never holding up the splash);
 *  • on returning to the foreground — served from cache unless the last check
 *    is older than UPDATE_TIMING.recheckIntervalMs, so app-switching does not
 *    hit the network every time.
 */
export function useAppUpdate() {
  const [decision, setDecision] = useState<UpdateDecision>({ kind: 'none' });
  const inFlight = useRef(false);
  // "Update Now" on an OPTIONAL update: they went to the store; don't greet
  // them with the same screen the moment they come back. Not persisted — the
  // next launch reminds them if they didn't actually update.
  const sessionSkip = useRef<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const run = useCallback(async (maxAgeMs: number) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const d = await checkForUpdate(maxAgeMs);
      if (d.kind === 'optional' && d.key === sessionSkip.current) return;
      setDecision(d);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run(LAUNCH_MAX_AGE_MS), UPDATE_TIMING.launchDelayMs);
    const sub = AppState.addEventListener('change', (next) => {
      const wasAway = appState.current !== 'active';
      appState.current = next;
      if (next === 'active' && wasAway) run(UPDATE_TIMING.recheckIntervalMs);
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, [run]);

  const later = useCallback(async () => {
    if (decision.kind !== 'optional') return;      // a mandatory update cannot be put off
    await dismissOptional(decision.key);
    setDecision({ kind: 'none' });
  }, [decision]);

  const updateNow = useCallback(async () => {
    const opened = await openStore();
    // A mandatory update stays up: coming back without updating changes nothing.
    if (opened && decision.kind === 'optional') {
      sessionSkip.current = decision.key;
      setDecision({ kind: 'none' });
    }
    return opened;
  }, [decision]);

  return { decision, later, updateNow };
}

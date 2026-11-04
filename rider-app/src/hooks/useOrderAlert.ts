import { useEffect, useRef, useState, useCallback } from 'react';
import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Bundled alarm buzzer (generated 2-tone WAV) — loops while an order alerts.
const BUZZER = require('../../assets/sounds/new_order.wav');

/**
 * Loud new-order alert for partner apps (kirana / restaurant / delivery).
 *
 * When a new order arrives the partner CANNOT miss it:
 *   • Continuous looping BUZZER sound + looping vibration
 *   • Full-screen flashing popup (driven by `activeOrder`)
 *
 * Reliability behaviours (each fixed a real missed/stuck-alert bug):
 *   • The popup stays up until the partner ACTS — the safety cap only silences
 *     the noise (autoStopMs), it no longer dismisses the popup.
 *   • If several orders arrive in one poll, they alert one-after-another
 *     (unalerted fresh orders are NOT swallowed by the first alert).
 *   • If the active order disappears / stops being actionable (customer
 *     cancelled, another device handled it), the alert auto-dismisses —
 *     the buzzer can never get stuck ringing for a closed order.
 *   • Optional `alertOnFirstLoad` predicate: orders that arrived while the app
 *     was closed can still alert on reopen (missed-alert recovery) instead of
 *     being silently marked as "pre-existing".
 */

const VIBRATION_PATTERN = [0, 600, 400];   // buzz 600ms, pause 400ms, repeat
const DEFAULT_AUTO_STOP_MS = 120_000;      // ring up to 2 min (popup stays after)

export interface UseOrderAlert<T> {
  activeOrder: T | null;
  isAlerting: boolean;
  checkForNewOrders: (orders: T[]) => void;
  stopAlert: () => void;
}

export interface OrderAlertOptions<T> {
  /** When provided, the FIRST fetch after mount may alert too — used for
   *  missed-alert recovery (e.g. still-pending order younger than 15 min). */
  alertOnFirstLoad?: (order: T) => boolean;
}

export function useOrderAlert<T>(
  getId: (order: T) => string,
  isAlertable: (order: T) => boolean,
  autoStopMs: number = DEFAULT_AUTO_STOP_MS,
  opts?: OrderAlertOptions<T>,
): UseOrderAlert<T> {
  const [activeOrder, setActiveOrder] = useState<T | null>(null);
  const [isAlerting, setIsAlerting] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const alertingRef = useRef(false);          // avoids stale-closure races
  const activeIdRef = useRef<string | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const loopWatchdog = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSound = useCallback(() => {
    if (loopWatchdog.current) { clearInterval(loopWatchdog.current); loopWatchdog.current = null; }
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try { p.pause(); } catch {}
      try { p.remove(); } catch {}
    }
  }, []);

  /** Silence noise only — the popup remains actionable. */
  const stopNoise = useCallback(() => {
    Vibration.cancel();
    stopSound();
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
  }, [stopSound]);

  const stopAlert = useCallback(() => {
    stopNoise();
    setIsAlerting(false);
    setActiveOrder(null);
    alertingRef.current = false;
    activeIdRef.current = null;
  }, [stopNoise]);

  const startAlert = useCallback((order: T) => {
    setActiveOrder(order);
    setIsAlerting(true);
    alertingRef.current = true;
    activeIdRef.current = getId(order);

    // Looping vibration (the `true` repeats until cancelled)
    Vibration.vibrate(VIBRATION_PATTERN, true);

    // Looping buzzer sound (expo-audio — new-architecture compatible)
    (async () => {
      // Ring even on silent mode (the partner MUST hear it). Best-effort.
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      } catch {}
      try {
        stopSound();                       // don't stack players
        const player = createAudioPlayer(BUZZER);
        player.loop = true;                // primary loop
        player.volume = 1.0;
        player.play();
        playerRef.current = player;

        // Watchdog: expo-audio's `loop` intermittently fails to re-trigger, so
        // the ~2-3s clip would play ONCE and go silent. Every second, if we're
        // still alerting but the clip has stopped, restart it — guaranteeing the
        // buzzer rings CONTINUOUSLY until the partner accepts/rejects (or the
        // safety cap). Cleared in stopSound.
        if (loopWatchdog.current) clearInterval(loopWatchdog.current);
        loopWatchdog.current = setInterval(() => {
          const p = playerRef.current;
          if (!alertingRef.current || !p) return;
          try {
            if (!p.playing) { p.seekTo(0); p.play(); }
          } catch { /* player disposed mid-check */ }
        }, 1000);
      } catch (e) {
        if (__DEV__) console.warn('Alert buzzer failed (vibration still active):', e);
      }
    })();

    // Safety: never buzz forever — but keep the popup up until the partner acts.
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    autoStopTimer.current = setTimeout(() => stopNoise(), autoStopMs);
  }, [autoStopMs, getId, stopNoise, stopSound]);

  const checkForNewOrders = useCallback((orders: T[]) => {
    const alertable = orders.filter(isAlertable);

    // If the order we're alerting for vanished or is no longer actionable
    // (cancelled / handled elsewhere), dismiss — never a stuck buzzer.
    if (alertingRef.current && activeIdRef.current) {
      const stillThere = alertable.some(o => getId(o) === activeIdRef.current);
      if (!stillThere) stopAlert();
    }

    // First load: remember everything so pre-existing orders don't all buzz —
    // EXCEPT ones the recovery predicate says are still actionable (arrived
    // while the app was closed and still need a response).
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      const recover = opts?.alertOnFirstLoad
        ? alertable.find(o => opts.alertOnFirstLoad!(o))
        : undefined;
      alertable.forEach(o => { if (!recover || getId(o) !== getId(recover)) seenIds.current.add(getId(o)); });
      if (recover && !alertingRef.current) {
        startAlert(recover);
        seenIds.current.add(getId(recover));
      }
      return;
    }

    // Alert ONE fresh order at a time. Others stay un-"seen" so they alert on
    // the next poll after this one is handled (no more swallowed 2nd order).
    if (!alertingRef.current) {
      const fresh = alertable.find(o => !seenIds.current.has(getId(o)));
      if (fresh) {
        startAlert(fresh);
        seenIds.current.add(getId(fresh));
      }
    }

    // Bound the seen-set so it can't grow forever (memory hygiene).
    if (seenIds.current.size > 500) {
      const current = new Set(orders.map(getId));
      seenIds.current.forEach(id => { if (!current.has(id)) seenIds.current.delete(id); });
    }
  }, [getId, isAlertable, opts, startAlert, stopAlert]);

  // Clean up on unmount — never leave the phone buzzing or a player loaded
  useEffect(() => () => {
    Vibration.cancel();
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    const p = playerRef.current;
    if (p) { try { p.remove(); } catch {} }
  }, []);

  return { activeOrder, isAlerting, checkForNewOrders, stopAlert };
}

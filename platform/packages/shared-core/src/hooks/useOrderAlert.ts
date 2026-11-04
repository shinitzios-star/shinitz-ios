import { useEffect, useRef, useState, useCallback } from 'react';
import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Bundled alarm buzzer (generated 2-tone WAV) — loops while an order alerts.
const BUZZER = require('../../assets/sounds/new_order.wav');

/**
 * Loud new-order alert for partner apps (kirana / restaurant / delivery).
 *
 * When a new order arrives the partner CANNOT miss it:
 *   • Continuous looping BUZZER sound (assets/sounds/new-order.wav)
 *   • Continuous looping vibration
 *   • Full-screen flashing popup (driven by `activeOrder`)
 *
 * The alert stops only when the partner accepts / rejects / dismisses,
 * or after `autoStopMs` as a safety cap.
 */

const VIBRATION_PATTERN = [0, 600, 400];   // buzz 600ms, pause 400ms, repeat
const DEFAULT_AUTO_STOP_MS = 60_000;       // stop buzzing after 60s no matter what

export interface UseOrderAlert<T> {
  activeOrder: T | null;
  isAlerting: boolean;
  checkForNewOrders: (orders: T[]) => void;
  stopAlert: () => void;
}

export function useOrderAlert<T>(
  getId: (order: T) => string,
  isAlertable: (order: T) => boolean,
  autoStopMs: number = DEFAULT_AUTO_STOP_MS,
): UseOrderAlert<T> {
  const [activeOrder, setActiveOrder] = useState<T | null>(null);
  const [isAlerting, setIsAlerting] = useState(false);

  const seenIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const stopSound = useCallback(() => {
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try { p.pause(); } catch {}
      try { p.remove(); } catch {}
    }
  }, []);

  const stopAlert = useCallback(() => {
    Vibration.cancel();
    stopSound();
    setIsAlerting(false);
    setActiveOrder(null);
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
  }, [stopSound]);

  const startAlert = useCallback((order: T) => {
    setActiveOrder(order);
    setIsAlerting(true);

    // Looping vibration (the `true` repeats until cancelled)
    Vibration.vibrate(VIBRATION_PATTERN, true);

    // Looping buzzer sound (expo-audio — new-architecture compatible)
    (async () => {
      // Ring even on silent mode (the restaurant MUST hear it). Best-effort.
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      } catch {}
      try {
        stopSound();                       // don't stack players
        const player = createAudioPlayer(BUZZER);
        player.loop = true;
        player.volume = 1.0;
        player.play();
        playerRef.current = player;
      } catch (e) {
        if (__DEV__) console.warn('Alert buzzer failed (vibration still active):', e);
      }
    })();

    // Safety: never buzz forever
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    autoStopTimer.current = setTimeout(() => stopAlert(), autoStopMs);
  }, [autoStopMs, stopAlert, stopSound]);

  const checkForNewOrders = useCallback((orders: T[]) => {
    const alertable = orders.filter(isAlertable);

    // First load: remember everything, don't alarm for pre-existing orders
    if (isFirstLoad.current) {
      alertable.forEach(o => seenIds.current.add(getId(o)));
      isFirstLoad.current = false;
      return;
    }

    const fresh = alertable.find(o => !seenIds.current.has(getId(o)));
    alertable.forEach(o => seenIds.current.add(getId(o)));

    if (fresh && !isAlerting) {
      startAlert(fresh);
    }
  }, [getId, isAlertable, isAlerting, startAlert]);

  // Clean up on unmount — never leave the phone buzzing or a player loaded
  useEffect(() => () => {
    Vibration.cancel();
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    const p = playerRef.current;
    if (p) { try { p.remove(); } catch {} }
  }, []);

  return { activeOrder, isAlerting, checkForNewOrders, stopAlert };
}

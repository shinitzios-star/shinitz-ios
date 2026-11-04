/**
 * GPS tracking hook for the delivery partner.
 *
 * Connects to:  wss://.../api/ws/tracking/{orderId}/rider?token=...
 * Sends every 5 s: { "lat": number, "lng": number }
 *
 * Also calls onLocation(lat, lng) on every GPS update so the rider's own
 * map can re-centre smoothly without waiting for a round-trip.
 *
 * Battery optimisation:
 *   - Location.Accuracy.Balanced (not High) — ~50 m accuracy, much less drain
 *   - 5-second interval (not 1 s)
 *   - Disconnects automatically when `enabled` goes false (e.g. after delivery)
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { isValidCoords } from '../utils/location';
import { hasForegroundLocation } from '../delivery/locationConsent';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://shinitz-backend.onrender.com';
const WS_BASE = API_URL.replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws'));
// Rider GPS is pushed every 10s during active deliveries (cost + battery
// optimised). Smooth marker animation on the consumer side hides the gap.
const PING_INTERVAL = 10000; // ms

export function useRiderTracking(
  orderId: string | null | undefined,
  enabled: boolean,
  onLocation?: (lat: number, lng: number) => void,
) {
  const wsRef       = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef    = useRef(true);
  // Keep the latest onLocation in a ref so callers can pass an INLINE arrow
  // without churning the socket. Previously the nav screen's inline onLocation
  // was a new function every render → sendLocation → connect changed identity →
  // the [connect] effect tore down + REOPENED the WebSocket on every render
  // (i.e. on every GPS tick), causing constant reconnect churn + jank.
  const onLocationRef = useRef(onLocation);
  onLocationRef.current = onLocation;

  const sendLocation = useCallback(async (ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      // Bounded: a fix request that never answers used to swallow the whole
      // ping, so a phone with a stuck GPS simply stopped reporting.
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 12000)),
      ]);
      if (!loc) { if (__DEV__) console.log('[tracking] no fix within 12s'); return; }
      const { latitude: lat, longitude: lng, speed, heading } = loc.coords;
      // A position that is not a place must never leave the device: it lands
      // on the customer's map and throws the whole trip off.
      if (!isValidCoords(lat, lng)) {
        if (__DEV__) console.log('[tracking] refusing invalid coords', lat, lng);
        return;
      }
      // Telemetry: speed (m/s), heading (°), battery (%), and the Android
      // mock-location flag — the server rejects spoofed GPS.
      let battery: number | undefined;
      try {
        const lvl = await Battery.getBatteryLevelAsync();
        if (lvl >= 0) battery = Math.round(lvl * 100);
      } catch {}
      ws.send(JSON.stringify({
        lat, lng,
        speed: speed != null && speed >= 0 ? Math.round(speed * 10) / 10 : undefined,
        heading: heading != null && heading >= 0 ? Math.round(heading) : undefined,
        battery,
        mocked: (loc as any).mocked === true,
      }));
      onLocationRef.current?.(lat, lng);
    } catch {}
  }, []);   // stable — reads onLocation via ref

  const connect = useCallback(async () => {
    if (!orderId || !enabled || !aliveRef.current) return;

    // Use location only if it is already granted. Mounting a screen must not
    // raise the system dialog by itself — that request belongs to
    // locationConsent, which puts the prominent disclosure in front of it.
    if (!(await hasForegroundLocation())) return;

    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/api/ws/tracking/${orderId}/rider?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = async () => {
      // Send immediately, then on interval
      await sendLocation(ws);
      intervalRef.current = setInterval(() => sendLocation(ws), PING_INTERVAL);
    };

    ws.onclose = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Auto-reconnect while still active
      if (aliveRef.current && enabled) {
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [orderId, enabled, sendLocation]);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}

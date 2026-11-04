/**
 * WebSocket hook for consumers and store partners watching a live delivery.
 *
 * Connects to:  wss://.../api/ws/tracking/{orderId}/watch?token=...
 * Receives:
 *   { type: "location_update", rider_lat, rider_lng, status, eta_minutes, timestamp }
 *   { type: "delivered" }
 *
 * Auto-reconnects every 5 s on disconnect while the order is still active.
 * Stops reconnecting once status === "delivered".
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://shinitz-backend.onrender.com';
const WS_BASE = API_URL.replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws'));

export interface TrackingState {
  riderLat:    number | null;
  riderLng:    number | null;
  status:      string;
  etaMinutes:  number | null;
  connected:   boolean;
  delivered:   boolean;
}

const INITIAL: TrackingState = {
  riderLat: null, riderLng: null, status: '', etaMinutes: null,
  connected: false, delivered: false,
};

export function useTrackingSocket(
  orderId: string | null | undefined,
  /** Only connect when the order is in an active delivery phase */
  enabled = true,
) {
  const [state, setState] = useState<TrackingState>(INITIAL);
  const wsRef    = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  const connect = useCallback(async () => {
    if (!orderId || !enabled || !aliveRef.current) return;

    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/api/ws/tracking/${orderId}/watch?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'location_update') {
          setState((s) => ({
            ...s,
            riderLat:   msg.rider_lat   ?? s.riderLat,
            riderLng:   msg.rider_lng   ?? s.riderLng,
            status:     msg.status      || s.status,
            etaMinutes: msg.eta_minutes ?? s.etaMinutes,
          }));
        } else if (msg.type === 'status_update') {
          // Real-time order status change (accepted → preparing → … → delivered)
          setState((s) => ({ ...s, status: msg.status || s.status }));
        } else if (msg.type === 'delivered') {
          setState((s) => ({ ...s, status: 'delivered', delivered: true, connected: false }));
          ws.close();
        }
      } catch {}
    };

    ws.onerror  = () => setState((s) => ({ ...s, connected: false }));
    ws.onclose  = () => {
      setState((s) => ({ ...s, connected: false }));
      // Reconnect unless delivered or unmounted
      if (aliveRef.current && enabled) {
        timerRef.current = setTimeout(connect, 5000);
      }
    };
  }, [orderId, enabled]);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  return state;
}

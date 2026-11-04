/**
 * OrderAlertCenter — app-wide new-order alerting for the restaurant app.
 *
 * WHY THIS EXISTS: the buzzer used to live inside the Orders tab only (its
 * polling was focus-gated), so a restaurant sitting on Dashboard/Menu/Payouts
 * heard nothing when an order landed — the single push "ding" was the only
 * signal, and if that push was missed the order sat silent. This provider is
 * mounted at the (restaurant) layout, so alerting works on EVERY tab:
 *
 *   • Polls the order feed app-wide while the app is foregrounded
 *     (AppState-gated: pauses in background where the push channel takes over).
 *   • Instantly refetches on a foreground push (no 15s wait) and when the app
 *     returns from background (missed-alert recovery sync).
 *   • On cold open, still-pending recent orders alert instead of being
 *     silently marked as "pre-existing".
 *   • Renders the full-screen IncomingOrderAlert above ANY screen; Accept
 *     confirms the order right from the popup.
 *   • Auto-dismisses if the order is cancelled/handled elsewhere; keeps the
 *     app badge = number of pending orders.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { router as expoRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { ordersAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useOrderAlert } from '../hooks/useOrderAlert';
import { IncomingOrderAlert } from '../components/IncomingOrderAlert';
import notificationService from '../services/notifications';
import { cancelIncomingOrder } from './incomingCall';

const POLL_MS = 15_000;
const RECOVERY_WINDOW_MS = 15 * 60_000;   // cold-open recovery: pending & < 15 min old

interface AlertCenterValue {
  /** Force an immediate feed check (e.g. after an action elsewhere). */
  refreshNow: () => void;
}
const AlertCenterContext = createContext<AlertCenterValue>({ refreshNow: () => {} });
export const useOrderAlertCenter = () => useContext(AlertCenterContext);

const isPending = (o: any) => o?.status === 'pending';
const isRecentPending = (o: any) => {
  if (!isPending(o)) return false;
  const t = o?.created_at ? Date.parse(o.created_at) : NaN;
  return Number.isFinite(t) ? Date.now() - t < RECOVERY_WINDOW_MS : false;
};

export function OrderAlertCenter({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const enabled = !!(isAuthenticated && user && user.role === 'restaurant');

  const { activeOrder, isAlerting, checkForNewOrders, stopAlert } = useOrderAlert<any>(
    (o) => o.id,
    isPending,
    90_000,
    { alertOnFirstLoad: isRecentPending },
  );

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const busyRef = useRef(false);

  // When the in-app full-screen popup is showing (app in foreground), silence
  // the notifee background ring for that order so we never double-sound.
  useEffect(() => {
    if (activeOrder?.id) cancelIncomingOrder(String(activeOrder.id));
  }, [activeOrder]);

  const fetchFeed = useCallback(async () => {
    if (!enabledRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await ordersAPI.getAll();
      const list: any[] = res.data || [];
      checkForNewOrders(list);
      // Badge = actionable (pending) orders. Best-effort.
      notificationService.setBadgeCount(list.filter(isPending).length).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn('[AlertCenter] feed fetch failed:', e);
    } finally {
      busyRef.current = false;
    }
  }, [checkForNewOrders]);

  // ── App-wide poll, AppState-gated ─────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      fetchFeed();                              // immediate — no first-tick wait
      interval = setInterval(fetchFeed, POLL_MS);
    };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };

    start();
    // Pause polling in background (push channel covers it); on resume, sync
    // IMMEDIATELY so anything missed while backgrounded alerts right away.
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') start();
      else stop();
    });
    return () => { stop(); sub.remove(); };
  }, [enabled, fetchFeed]);

  // ── Instant reaction to a foreground push (don't wait for the next poll) ──
  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const type = (n.request.content.data as any)?.type;
      if (type === 'new_order' || type === 'order_update') fetchFeed();
    });
    return () => sub.remove();
  }, [enabled, fetchFeed]);

  // ── Foreground FCM data push (the incoming-order alert is data-only FCM now,
  // so rn-firebase's onMessage is the FOREGROUND path — the OS never draws it;
  // we refresh the feed → the in-app IncomingOrderAlert + buzzer take over,
  // instead of notifee, so we never double-ring). Also keeps the FCM token
  // fresh on rotation so pushes can't silently stop. ────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const unsub = messaging().onMessage(async (rm) => {
      const d: any = rm?.data || {};
      const kind = d.kind || d.type;
      if (kind === 'alert' || kind === 'new_order' || kind === 'order_update' || kind === 'cancel') {
        fetchFeed();
      }
    });
    const unsubToken = messaging().onTokenRefresh(() => {
      notificationService.saveFcmTokenToServer().catch(() => {});
    });
    return () => { unsub(); unsubToken(); };
  }, [enabled, fetchFeed]);

  // Accept straight from the popup (same transition the Orders screen uses).
  const acceptFromAlert = useCallback(async () => {
    const id = activeOrder?.id;
    stopAlert();
    if (!id) return;
    try {
      await ordersAPI.updateStatus(id, 'accepted');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to accept the order');
    }
    fetchFeed();
    try { expoRouter.push('/(restaurant)/orders'); } catch {}
  }, [activeOrder, stopAlert, fetchFeed]);

  return (
    <AlertCenterContext.Provider value={{ refreshNow: fetchFeed }}>
      {children}
      <IncomingOrderAlert
        order={activeOrder}
        visible={isAlerting}
        acceptLabel="Accept Order"
        onAccept={acceptFromAlert}
        onReject={stopAlert}
      />
    </AlertCenterContext.Provider>
  );
}

export default OrderAlertCenter;

/**
 * OrderAlertCenter — app-wide new-delivery alerting for the rider app.
 *
 * WHY THIS EXISTS: the buzzer used to live inside the Available screen only
 * (focus-gated polling). After the Home-dashboard redesign the app no longer
 * opens on Available, so WITHOUT this provider a rider sitting on Home /
 * Earnings / More heard nothing when a pickup landed. Mounted at the
 * (delivery) layout, alerting now works on EVERY tab:
 *
 *   • Polls the delivery feed app-wide while foregrounded (AppState-gated;
 *     in background the push channel takes over).
 *   • Instantly refetches on a foreground push and on return from background
 *     (missed-offer recovery sync).
 *   • On cold open, a still-claimable recent pickup alerts instead of being
 *     silently marked "pre-existing".
 *   • Same eligibility as the Available screen: rider online + within 3 km of
 *     the store (client-side re-check; server enforces radius on accept too).
 *   • Accept ("delivery_assigned") / Reject (re-offer to next rider) straight
 *     from the popup; auto-dismisses if another rider claims the order first.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { router as expoRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import * as Location from 'expo-location';
import { ordersAPI, authAPI, locationAPI } from '../services/api';
import { syncActiveDelivery, stopActiveDelivery } from '../delivery/activeDeliveryMode';
import { OrderInProgressCard } from '../components/OrderInProgressCard';
import { useAuthStore } from '../store/authStore';
import { useOrderAlert } from '../hooks/useOrderAlert';
import { IncomingOrderAlert } from '../components/IncomingOrderAlert';
import notificationService from '../services/notifications';
import { cancelIncomingOrder } from './incomingCall';
import { hasForegroundLocation } from '../delivery/locationConsent';

const POLL_MS = 12_000;
const LOCATION_PUSH_MS = 30_000;         // keep users.location fresh while online
const RECOVERY_WINDOW_MS = 10 * 60_000;  // cold-open recovery: claimable & < 10 min old

interface AlertCenterValue {
  refreshNow: () => void;
  /** The rider's live deliveries (delivery_assigned → out_for_delivery),
   *  refreshed by the same feed poll — powers the Order-in-Progress card. */
  activeDeliveries: any[];
}
const AlertCenterContext = createContext<AlertCenterValue>({ refreshNow: () => {}, activeDeliveries: [] });
export const useOrderAlertCenter = () => useContext(AlertCenterContext);

// A store may start cooking before a rider is found, which moves the order
// to `preparing` — it is still waiting for a delivery partner and must
// still ring. Treating only `accepted` as claimable made those orders
// invisible here until they auto-cancelled at the assignment SLA.
const CLAIMABLE = ['accepted', 'preparing'];
const isClaimable = (o: any) => CLAIMABLE.includes(o?.status);
const isRecentClaimable = (o: any) => {
  if (!isClaimable(o)) return false;
  const t = o?.updated_at || o?.preparing_at || o?.accepted_at || o?.created_at;
  const ms = t ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? Date.now() - ms < RECOVERY_WINDOW_MS : false;
};

export function OrderAlertCenter({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const enabled = !!(isAuthenticated && user && user.role === 'delivery');

  const { activeOrder, isAlerting, checkForNewOrders, stopAlert } = useOrderAlert<any>(
    (o) => o.id,
    isClaimable,
    90_000,
    { alertOnFirstLoad: isRecentClaimable },
  );

  // Active Delivery Mode: restore-navigation runs at most once per app session
  // (cold start mid-delivery → land straight on the Active screen).
  const restoreCheckedRef = useRef(false);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const activeKeyRef = useRef('');
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const busyRef = useRef(false);
  const verifiedRef = useRef(!!user?.verified);

  // In-app popup showing (foreground) → silence the notifee background ring.
  useEffect(() => {
    if (activeOrder?.id) cancelIncomingOrder(String(activeOrder.id));
  }, [activeOrder]);
  const lastLocPushRef = useRef(0);

  // Keep the rider's SERVER-SIDE location fresh while online. The assignment
  // engine only offers orders to riders whose users.location is within 1–3 km
  // of the store — before the Home redesign this was fed by the Available
  // screen's GPS watcher (always mounted); now Home is the resting screen, so
  // the alert center owns it. A stale location = the engine silently skips the
  // rider = "not receiving orders".
  const pushLocation = useCallback(async () => {
    const now = Date.now();
    if (now - lastLocPushRef.current < LOCATION_PUSH_MS) return;
    lastLocPushRef.current = now;
    try {
      // A poll must never raise a permission dialog: it would appear out of the
      // blue every 15 s, with no prominent disclosure in front of it. Location
      // is asked for in locationConsent (going online, a delivery starting);
      // here it is only used if it has already been granted.
      if (!(await hasForegroundLocation())) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await locationAPI.update(pos.coords.latitude, pos.coords.longitude);
    } catch {
      lastLocPushRef.current = 0;   // failed — allow the next cycle to retry
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    if (!enabledRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      // Fresh me + feed together: is_online / verified may have changed from
      // any screen (Home toggle, admin action) — never alert an offline rider.
      // (A getMe-throttle optimization was tried + reverted for stability.)
      const [meRes, ordersRes] = await Promise.allSettled([authAPI.getMe(), ordersAPI.getAll()]);
      const me = meRes.status === 'fulfilled' ? meRes.value.data : null;
      if (me) verifiedRef.current = !!me.verified;
      const online = !!(me?.is_online);
      const list: any[] = ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : [];

      // ── Active Delivery Mode lifecycle ─────────────────────────────────────
      // Runs BEFORE the online gate: a rider mid-delivery is locked online
      // server-side, but the mode must never flap on a stale `me` read.
      // State source = the server feed → crash/restart recovery is automatic.
      if (ordersRes.status === 'fulfilled') {
        const myId = me?.id || user?.id;
        const mine = list.filter((o: any) =>
          ['delivery_assigned', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o?.status)
          && o?.delivery_partner_id === myId);
        // Only re-render the in-progress card when something it shows changed
        // (id/status/eta) — not on every 12s poll.
        const key = mine.map((o: any) => `${o.id}:${o.status}:${o.route_eta_minutes ?? ''}`).join('|');
        if (key !== activeKeyRef.current) {
          activeKeyRef.current = key;
          setActiveDeliveries(mine);
        }
        if (mine.length) {
          syncActiveDelivery(mine[0]).catch(() => {});
          if (!restoreCheckedRef.current) {
            // Cold start with a live job → restore the Active screen. Deferred a
            // tick: navigating before the root layout mounts throws in expo-router.
            setTimeout(() => { try { expoRouter.navigate('/(delivery)/active' as any); } catch {} }, 400);
          }
        } else {
          stopActiveDelivery().catch(() => {});
        }
        restoreCheckedRef.current = true;
      }

      if (!online) {
        // Offline riders get no offers — also clears any now-stale alert.
        checkForNewOrders([]);
        return;
      }

      // Online → keep the server location fresh so the offer engine can pick us.
      pushLocation();   // fire-and-forget; throttled internally

      // NOTE: no client-side radius filter here. The feed only contains orders
      // the server ALREADY offered to this rider (current_offer.rider_id = me)
      // plus their own active deliveries — re-filtering with a possibly-stale
      // device fix could only hide valid offers (false negatives).
      checkForNewOrders(list);
      notificationService.setBadgeCount(list.filter(isClaimable).length).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn('[AlertCenter] feed fetch failed:', e);
    } finally {
      busyRef.current = false;
    }
  }, [checkForNewOrders, pushLocation]);

  // ── App-wide poll, AppState-gated ─────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      fetchFeed();
      interval = setInterval(fetchFeed, POLL_MS);
    };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    start();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') start();     // resume → immediate missed-offer sync
      else stop();                     // background → push channel covers it
    });
    return () => { stop(); sub.remove(); };
  }, [enabled, fetchFeed]);

  // ── Instant reaction to a foreground push ─────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const type = (n.request.content.data as any)?.type;
      // 'delivery_offer' is what the assignment engine actually sends;
      // 'new_pickup' is the legacy broadcast path. React instantly to both.
      if (type === 'delivery_offer' || type === 'new_pickup' || type === 'new_order' || type === 'order_update') fetchFeed();
    });
    return () => sub.remove();
  }, [enabled, fetchFeed]);

  // ── Foreground FCM data push (the pickup offer is data-only FCM now, so
  // rn-firebase's onMessage is the FOREGROUND path — the OS never draws it; we
  // refresh the feed → the in-app IncomingOrderAlert + buzzer take over instead
  // of notifee, so we never double-ring). Also keeps the FCM token fresh on
  // rotation so offers can't silently stop arriving. ───────────────────────
  useEffect(() => {
    if (!enabled) return;
    const unsub = messaging().onMessage(async (rm) => {
      const d: any = rm?.data || {};
      const kind = d.kind || d.type;
      if (kind === 'alert' || kind === 'delivery_offer' || kind === 'new_pickup'
          || kind === 'new_order' || kind === 'order_update' || kind === 'cancel') {
        fetchFeed();
      }
    });
    const unsubToken = messaging().onTokenRefresh(() => {
      notificationService.saveFcmTokenToServer().catch(() => {});
    });
    return () => { unsub(); unsubToken(); };
  }, [enabled, fetchFeed]);

  // Accept / reject straight from the popup — same paths as the Available screen.
  const acceptFromAlert = useCallback(async () => {
    const id = activeOrder?.id;
    stopAlert();
    if (!id) return;
    if (!verifiedRef.current) {
      Alert.alert('Verification Pending', 'You can accept orders once an admin verifies your account.');
      return;
    }
    try {
      await ordersAPI.updateStatus(id, 'delivery_assigned');
      try { expoRouter.push('/(delivery)/active'); } catch {}
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to accept delivery');
    }
    fetchFeed();
  }, [activeOrder, stopAlert, fetchFeed]);

  const rejectFromAlert = useCallback(async () => {
    const id = activeOrder?.id;
    stopAlert();
    if (!id) return;
    try { await ordersAPI.rejectOffer(id); } catch { /* offer may have expired */ }
    fetchFeed();
  }, [activeOrder, stopAlert, fetchFeed]);

  return (
    <AlertCenterContext.Provider value={{ refreshNow: fetchFeed, activeDeliveries }}>
      {children}
      {/* Swiggy-style persistent bottom card — visible on every tab while a
          delivery is live; tap → Active screen. Driven by the feed above, so
          it restores automatically after restarts and never needs a timer. */}
      <OrderInProgressCard />
      <IncomingOrderAlert
        order={activeOrder}
        visible={isAlerting}
        acceptLabel="Accept Delivery"
        rejectLabel="Reject"
        onAccept={acceptFromAlert}
        onReject={rejectFromAlert}
      />
    </AlertCenterContext.Provider>
  );
}

export default OrderAlertCenter;

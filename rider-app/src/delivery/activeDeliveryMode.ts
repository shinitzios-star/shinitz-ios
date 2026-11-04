/**
 * activeDeliveryMode — the rider's "on a job" runtime (Swiggy-partner style).
 *
 * Turns ON automatically when the rider carries a live order and OFF when the
 * order is delivered/cancelled (driven by OrderAlertCenter, which already
 * watches the order feed). While ON it provides:
 *
 *  1. BACKGROUND GPS — expo-location's location task runs inside its own
 *     Android foreground service (type "location"), so tracking continues with
 *     the app minimized, screen locked, or the phone dozing. Each fix is
 *     pushed to the backend (locationAPI.update) → customer map + ETA + admin
 *     panel stay live. Works headless: the axios client reads the auth token
 *     from AsyncStorage.
 *
 *  2. PERSISTENT NOTIFICATION — the same foreground service shows an ongoing,
 *     lock-screen-visible notification with the current step ("Heading to
 *     pickup…"). If the rider declines background permission we degrade to a
 *     notifee ongoing notification (no service) + the existing in-app GPS
 *     streaming — never a hard block.
 *
 *  3. STATE RESTORATION — mode state lives on the SERVER (the active order),
 *     so a crash/restart simply re-enters the mode when the feed reloads.
 *
 * The task MUST be defined at module scope from the app entry (index.js) so
 * Android can dispatch into it headlessly.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { locationAPI } from '../services/api';
import { ensureLocationAccess } from './locationConsent';

export const ACTIVE_DELIVERY_TASK = 'SHINITZ_ACTIVE_DELIVERY_LOCATION';
const FALLBACK_NOTIF_ID = 'active_delivery_fallback';

// Human step labels per order status (also used by the notification body).
export const STEP_LABEL: Record<string, string> = {
  delivery_assigned: 'Heading to the restaurant',
  preparing: 'Order is being prepared',
  ready_for_pickup: 'Pick up the order',
  out_for_delivery: 'Deliver to the customer',
};

// ── Headless location task ────────────────────────────────────────────────────
// Defined at import time (index.js imports this module before the React tree).
TaskManager.defineTask(ACTIVE_DELIVERY_TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;
  const loc = data.locations[data.locations.length - 1];
  try {
    await locationAPI.update(loc.coords.latitude, loc.coords.longitude);
  } catch {
    // transient network failure — next fix retries; the server keeps last-known
  }
});

let _running = false;
let _lastStatus = '';
// The order the rider has already been asked about. The feed poll calls
// syncActiveDelivery on every step change (assigned → preparing → ready → out
// for delivery); asking at each step would be four prompts for one delivery.
let _askedForOrder = '';

/** True when the background task is registered AND actively delivering fixes. */
export async function isActiveDeliveryTracking(): Promise<boolean> {
  try { return await Location.hasStartedLocationUpdatesAsync(ACTIVE_DELIVERY_TASK); }
  catch { return false; }
}

async function startBackgroundUpdates(order: any): Promise<boolean> {
  try {
    // The prominent disclosure, then foreground, then "Allow all the time" —
    // all in locationConsent, which also refuses to show a system dialog with
    // no disclosure in front of it. Asked once per delivery, and not at all
    // within a day of the rider saying no; declining degrades gracefully to
    // the fallback below, so they can keep working.
    const orderId = String(order?.id || '');
    const mode = orderId && orderId !== _askedForOrder ? 'auto' : null;
    if (mode) _askedForOrder = orderId;
    const access = mode
      ? await ensureLocationAccess({ background: true, mode })
      : { foreground: false, background: false };
    const ready = access.background || (await Location.getBackgroundPermissionsAsync()).status === 'granted';
    if (!ready) return false;
    const already = await isActiveDeliveryTracking();
    if (already) await Location.stopLocationUpdatesAsync(ACTIVE_DELIVERY_TASK);
    await Location.startLocationUpdatesAsync(ACTIVE_DELIVERY_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 20_000,          // ≥20s between fixes
      distanceInterval: 40,          // or 40 m of movement
      pausesUpdatesAutomatically: false,
      // The Android foreground service = background survival + the persistent,
      // lock-screen/AOD-visible notification, in one shot.
      foregroundService: {
        notificationTitle: `Active Delivery · ${STEP_LABEL[order?.status] || 'On the job'}`,
        notificationBody: order?.delivery_address
          ? `Drop: ${order.delivery_address}`
          : 'Location sharing is on so the customer can track you.',
        notificationColor: '#0F3D2E',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Fallback persistent notification (no service) when bg permission is denied.
 *  Ongoing + lock-screen visible; in-app foreground GPS streaming still runs. */
async function showFallbackNotification(order: any): Promise<void> {
  try {
    await notifee.createChannel({
      id: 'active_delivery',
      name: 'Active Delivery',
      importance: AndroidImportance.LOW,   // silent — it's a status pin, not an alert
    });
    await notifee.displayNotification({
      id: FALLBACK_NOTIF_ID,
      title: `Active Delivery · ${STEP_LABEL[order?.status] || 'On the job'}`,
      body: order?.delivery_address ? `Drop: ${order.delivery_address}` : 'Complete your delivery in the app.',
      android: {
        channelId: 'active_delivery',
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } catch { /* notification is best-effort */ }
}

/**
 * Enter/refresh Active Delivery Mode for the given order. Idempotent — safe to
 * call on every poll; it only restarts the service when the STEP changed (so
 * the notification text stays current without churn).
 */
export async function syncActiveDelivery(order: any): Promise<void> {
  const status = order?.status || '';
  if (_running && status === _lastStatus) return;
  _lastStatus = status;
  _running = true;
  const ok = await startBackgroundUpdates(order);
  if (!ok) await showFallbackNotification(order);
  else await notifee.cancelNotification(FALLBACK_NOTIF_ID).catch(() => {});
}

/** Exit Active Delivery Mode (order delivered / cancelled / released). */
export async function stopActiveDelivery(): Promise<void> {
  _running = false;
  _lastStatus = '';
  try {
    if (await isActiveDeliveryTracking()) {
      await Location.stopLocationUpdatesAsync(ACTIVE_DELIVERY_TASK);
    }
  } catch { /* ignore */ }
  try { await notifee.cancelNotification(FALLBACK_NOTIF_ID); } catch { /* ignore */ }
}

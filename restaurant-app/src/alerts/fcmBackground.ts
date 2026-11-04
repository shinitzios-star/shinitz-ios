/**
 * fcmBackground — the KILLED / BACKGROUND transport for incoming-order rings.
 *
 * WHY THIS REPLACED THE expo-notifications BACKGROUND TASK: expo-notifications'
 * `registerTaskAsync` does NOT reliably wake JS for a data-only FCM message when
 * the Android app is fully killed — so notifee never got the signal to ring, and
 * closed-app alerts were silent. `@react-native-firebase/messaging`'s
 * `setBackgroundMessageHandler` DOES run headless JS on a data message even when
 * the app is terminated (its FCM service outranks expo-notifications', which sets
 * its own MESSAGING_EVENT filter to android:priority="-1" precisely to yield).
 *
 * This module MUST be imported from the app entry (index.js) BEFORE
 * `expo-router/entry` so the handler + foreground-service runner are registered
 * in the headless context that Android spins up for a killed-app message.
 */
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import {
  showIncomingOrder,
  cancelIncomingOrder,
  registerIncomingCallForegroundService,
} from './incomingCall';

// Module-scope side effect — MUST run on import (incl. the headless/killed JS
// context) so the looping foreground-service ring can start.
registerIncomingCallForegroundService();

/** FCM v1 delivers `data` as a flat string map; some fields may be JSON strings. */
function extractData(remoteMessage: any): Record<string, any> | null {
  const d = remoteMessage?.data;
  if (!d || typeof d !== 'object') return null;
  // A nested JSON blob under `payload`/`body` is merged up if present.
  for (const key of ['payload', 'body']) {
    const v = d[key];
    if (typeof v === 'string' && v.startsWith('{')) {
      try { return { ...d, ...JSON.parse(v) }; } catch { /* keep flat d */ }
    }
  }
  return d;
}

async function handlePayload(data: Record<string, any> | null): Promise<void> {
  if (!data) return;
  const kind = data.kind || data.type;
  if (kind === 'cancel') {
    await cancelIncomingOrder(data.orderId ? String(data.orderId) : undefined);
  } else if (kind === 'alert' || kind === 'new_order' || kind === 'delivery_offer') {
    await showIncomingOrder(data);
  }
}

// KILLED / BACKGROUND data message → ring (or cancel a ring).
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    await handlePayload(extractData(remoteMessage));
  } catch (e) {
    if (__DEV__) console.warn('[fcmBackground] handle failed', e);
  }
});

// notifee events while backgrounded/killed: stop the ring if the user dismisses.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const orderId = detail?.notification?.id;
  if (type === EventType.DISMISSED && orderId) {
    await cancelIncomingOrder(orderId);
  }
  // PRESS / full-screen open launches the app; the in-app popup then takes over
  // and cancels the ring (see OrderAlertCenter).
});

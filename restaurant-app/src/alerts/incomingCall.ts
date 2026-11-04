/**
 * incomingCall — notifee-backed "incoming-call" style order alert.
 *
 * notifee is a DISPLAY library only (it registers no FCM receiver → no conflict
 * with expo-notifications, which owns the FCM transport + background task). This
 * module renders a full-screen, continuously-looping, CALL-category notification
 * that fires over the lock screen and keeps ringing (via a foreground service)
 * until it's cancelled by an Accept/Reject action or a backend "cancel" signal.
 */
import notifee, {
  AndroidImportance, AndroidCategory, AndroidVisibility, AndroidColor,
} from '@notifee/react-native';

const CHANNEL_ID = 'incoming_orders';
// Bundled sound resource name WITHOUT extension (android/app/src/main/res/raw/new_order.wav).
const SOUND = 'new_order';

let _channelReady = false;
const _active = new Set<string>();

export async function ensureChannel(): Promise<void> {
  if (_channelReady) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Incoming Orders',
    importance: AndroidImportance.HIGH,
    sound: SOUND,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
    lights: true,
    lightColor: AndroidColor.RED,
    visibility: AndroidVisibility.PUBLIC,
  });
  _channelReady = true;
}

/** Show (or refresh) the ringing full-screen alert for an order. Keyed by orderId. */
export async function showIncomingOrder(data: Record<string, any>): Promise<void> {
  const orderId = String(data?.orderId || 'order');
  const title = String(data?.title || 'New Order!');
  const body = String(data?.body || 'Tap to respond');
  try {
    await ensureChannel();
    _active.add(orderId);
    await notifee.displayNotification({
      id: orderId,                         // stable id → later cancel targets it
      title,
      body,
      data: { ...data, orderId },
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.CALL,     // ring/heads-up like a phone call
        visibility: AndroidVisibility.PUBLIC,
        loopSound: true,                    // keep ringing (not one-shot)
        ongoing: true,                      // can't be swiped away accidentally
        autoCancel: false,
        // Full-screen intent → launches the app over the lock screen.
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
        // Foreground service keeps the loop alive when the app is killed.
        asForegroundService: true,
        // Hard safety cap so a stuck ring can't run forever (server also cancels).
        timeoutAfter: 120_000,
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('[incomingCall] show failed', e);
  }
}

/** Stop ringing one order (accepted / rejected / expired / reassigned / cancelled). */
export async function cancelIncomingOrder(orderId?: string): Promise<void> {
  try {
    if (orderId) {
      _active.delete(String(orderId));
      await notifee.cancelNotification(String(orderId));
    } else {
      _active.clear();
      await notifee.cancelAllNotifications();
    }
  } catch { /* ignore */ }
  // Stop the foreground-service ring once nothing is active.
  if (_active.size === 0) {
    try { await notifee.stopForegroundService(); } catch { /* ignore */ }
  }
}

export function hasActiveAlerts(): boolean {
  return _active.size > 0;
}

/**
 * notifee requires a registered foreground-service runner; the returned promise
 * intentionally never resolves so the service (and the looping ring) stays alive
 * until we cancel it. Registered once at app entry.
 */
export function registerIncomingCallForegroundService(): void {
  notifee.registerForegroundService(() => new Promise(() => { /* keep alive */ }));
}

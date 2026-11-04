import { useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { router as expoRouter } from 'expo-router';
import notificationService, { NotificationData } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { offersAPI } from '../services/api';

// Map a broadcast deep link (internal path or a shinitz:// scheme) to a route.
const DEEP_LINK_TARGETS: Record<string, string> = {
  offers: '/(consumer)/home',
  home: '/(consumer)/home',
  orders: '/(consumer)/orders',
  wallet: '/(consumer)/wallet',
  refer: '/(consumer)/refer',
  refunds: '/(consumer)/refunds',
};

function resolveDeepLink(dl?: string): string | null {
  if (!dl) return null;
  if (dl.startsWith('/')) return dl;                       // already an app path
  const target = dl.replace(/^[a-z]+:\/\//i, '').split(/[/?]/)[0].toLowerCase();
  return DEEP_LINK_TARGETS[target] || '/(consumer)/home';
}

/**
 * Push-notification hook.
 *
 * In expo-notifications 0.28+ the listener-removal API changed:
 *   OLD:  Notifications.removeNotificationSubscription(sub)
 *   NEW:  sub.remove()
 *
 * We hold subscription instances in refs and call .remove() on unmount.
 */
export function useNotifications() {
  const { user, isAuthenticated } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  // Type the refs as the subscription value (or null), not as the EventSubscription type
  // — which expo-notifications declares as a generic with required args.
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const handleNotificationNavigation = useCallback((data: NotificationData) => {
    if (!data) return;
    // Consumer app: sessions are consumer (or admin). Only the consumer order
    // deep-link is handled here — no rider/restaurant/kirana routes.
    try {
      switch (data.type) {
        case 'order_update':
        case 'new_order':
        case 'cancellation_submitted':
        case 'cancellation_under_review':
        case 'cancellation_approved':
        case 'cancellation_rejected':
          if (user?.role === 'consumer') {
            expoRouter.push('/(consumer)/orders');
          }
          break;
        case 'refund_update':
          if (user?.role === 'consumer') {
            const rid = (data as any).refund_id;
            expoRouter.push(rid
              ? { pathname: '/(consumer)/refund-detail', params: { refundId: rid } }
              : '/(consumer)/refunds');
          }
          break;
        case 'broadcast': {
          // Report the open (powers admin open-rate) and follow the deep link.
          const bid = (data as any).broadcast_id;
          if (bid) offersAPI.markOpened(bid).catch(() => {});
          const dest = resolveDeepLink((data as any).deep_link);
          if (dest && user?.role === 'consumer') expoRouter.push(dest as any);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      // Navigation can fire before the router mounts; safe to ignore.
      if (__DEV__) console.warn('Navigation not ready yet:', e);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    // Register for push notifications (non-blocking)
    (async () => {
      try {
        const token = await notificationService.registerForPushNotifications();
        if (mounted && token) setExpoPushToken(token);
      } catch (e) {
        if (__DEV__) console.warn('Push registration failed:', e);
      }
    })();

    // Foreground received → log only (UI handled by setNotificationHandler)
    try {
      notificationListener.current = notificationService.addNotificationReceivedListener(
        (notification) => {
          if (__DEV__) console.log('Notification received:', notification.request.content.title);
        },
      );
    } catch (e) {
      if (__DEV__) console.warn('addNotificationReceivedListener failed:', e);
    }

    // User tapped notification → navigate
    try {
      responseListener.current = notificationService.addNotificationResponseListener(
        (response) => {
          const data = response.notification.request.content.data as unknown as NotificationData;
          handleNotificationNavigation(data);
        },
      );
    } catch (e) {
      if (__DEV__) console.warn('addNotificationResponseListener failed:', e);
    }

    return () => {
      mounted = false;
      // Modern API: subscription.remove() — replaces deprecated
      // Notifications.removeNotificationSubscription(sub)
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [handleNotificationNavigation]);

  // ── Notifications delivered by Firebase directly ──────────────────────────
  // The server pushes through Firebase now, not the Expo relay, so these
  // messages never pass through expo-notifications' listeners above:
  //   • background / killed — the OS renders and the OS handles the tap, which
  //     surfaces here as onNotificationOpenedApp / getInitialNotification;
  //   • foreground — NOTHING displays a notification-type message while the app
  //     is open, so we present it ourselves.
  useEffect(() => {
    const unsubForeground = messaging().onMessage(async (msg) => {
      const n = msg.notification;
      if (!n?.title && !n?.body) return;
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: n?.title || '', body: n?.body || '', data: (msg.data || {}) as any,
                     sound: 'default' },
          trigger: null,                       // immediately
        });
      } catch (e) {
        if (__DEV__) console.warn('Foreground notification display failed:', e);
      }
    });

    const unsubOpened = messaging().onNotificationOpenedApp((msg) => {
      handleNotificationNavigation((msg?.data || {}) as unknown as NotificationData);
    });

    // Opened from a cold start: the tap that launched the app.
    messaging()
      .getInitialNotification()
      .then((msg) => {
        if (msg) handleNotificationNavigation((msg.data || {}) as unknown as NotificationData);
      })
      .catch(() => {});

    return () => { unsubForeground(); unsubOpened(); };
  }, [handleNotificationNavigation]);

  // Persist tokens to the backend once authenticated.
  //
  // The Firebase token is saved on EVERY launch and is deliberately NOT gated
  // on `expoPushToken`: a reinstall rotates the Firebase token, and chaining it
  // behind the Expo registration (which needs a round trip to Expo) is exactly
  // how the partner apps lost their alerts after a reinstall.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    notificationService.saveFcmTokenToServer();
    const unsub = notificationService.onFcmTokenRefresh(() => {
      notificationService.saveFcmTokenToServer();
    });
    return () => { try { unsub(); } catch { /* ignore */ } };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user && expoPushToken) {
      notificationService.savePushTokenToServer(user.id);
    }
  }, [isAuthenticated, user, expoPushToken]);

  return {
    expoPushToken,
    scheduleNotification: notificationService.scheduleLocalNotification.bind(notificationService),
  };
}

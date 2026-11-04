import { useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { router as expoRouter } from 'expo-router';
import notificationService, { NotificationData } from '../services/notifications';
import { useAuthStore } from '../store/authStore';

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
  const tokenListener = useRef<Notifications.EventSubscription | null>(null);

  const handleNotificationNavigation = useCallback((data: NotificationData) => {
    if (!data) return;
    // Rider app: the session is always a delivery user, so only delivery
    // deep-links are handled here. No consumer/restaurant/kirana routes.
    try {
      switch (data.type) {
        // A claimable pickup offer → the Available feed (where Accept lives).
        case 'delivery_offer':
        case 'new_pickup':
        case 'new_order':
          expoRouter.push('/(delivery)/available');
          break;
        case 'order_update':
        case 'delivery_assigned':
          expoRouter.push('/(delivery)/active');
          break;
        default:
          break;
      }
    } catch (e) {
      // Navigation can fire before the router mounts; safe to ignore.
      if (__DEV__) console.warn('Navigation not ready yet:', e);
    }
  }, []);

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

    // Device push token ROTATED (reinstall / OS refresh) → fetch the new Expo
    // token and update state; the persist-effect below re-saves it to the
    // server. Without this, the server kept pushing to a dead token and this
    // device silently stopped receiving order alerts.
    try {
      tokenListener.current = Notifications.addPushTokenListener(() => {
        notificationService.registerForPushNotifications()
          .then((t) => { if (mounted && t) setExpoPushToken(t); })
          .catch(() => {});
      });
    } catch (e) {
      if (__DEV__) console.warn('addPushTokenListener failed:', e);
    }

    return () => {
      mounted = false;
      // Modern API: subscription.remove() — replaces deprecated
      // Notifications.removeNotificationSubscription(sub)
      notificationListener.current?.remove();
      responseListener.current?.remove();
      tokenListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
      tokenListener.current = null;
    };
  }, [handleNotificationNavigation]);

  // Persist token to backend once authenticated
  useEffect(() => {
    if (isAuthenticated && user && expoPushToken) {
      notificationService.savePushTokenToServer(user.id);
    }
  }, [isAuthenticated, user, expoPushToken]);

  // FCM token must reach the server INDEPENDENTLY of the Expo token: the
  // killed-app ring is FCM-only, while the Expo registration above needs a
  // round trip to exp.host that can fail or stall — and it gated the FCM save.
  // After an APK reinstall the FCM token ROTATES; without this
  // save-on-every-launch the server kept ringing the dead token (FCM accepts
  // sends to recently-uninstalled tokens, so they even log as "sent") — which
  // is exactly how the rider buzzer went silent after an app update.
  useEffect(() => {
    if (isAuthenticated && user) {
      notificationService.saveFcmTokenToServer().catch(() => {});
    }
  }, [isAuthenticated, user]);

  return {
    expoPushToken,
    scheduleNotification: notificationService.scheduleLocalNotification.bind(notificationService),
  };
}

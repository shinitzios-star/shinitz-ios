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

  const handleNotificationNavigation = useCallback((data: NotificationData) => {
    if (!data) return;
    try {
      switch (data.type) {
        case 'order_update':
        case 'new_order':
          if (user?.role === 'consumer') {
            expoRouter.push('/(consumer)/orders');
          } else if (user?.role === 'kirana') {
            expoRouter.push('/(kirana)/orders');
          } else if (user?.role === 'delivery') {
            expoRouter.push('/(delivery)/active');
          } else if (user?.role === 'restaurant') {
            expoRouter.push('/(restaurant)/orders');
          }
          break;
        case 'delivery_assigned':
          if (user?.role === 'delivery') {
            expoRouter.push('/(delivery)/active');
          }
          break;
        case 'verification_update':
          if (user?.role === 'restaurant') {
            expoRouter.push('/(restaurant)/verification' as any);
          } else if (user?.role === 'kirana') {
            expoRouter.push('/(kirana)/verification' as any);
          }
          break;
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

  // Persist token to backend once authenticated
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

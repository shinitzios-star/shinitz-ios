import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Read the EAS projectId from the resolved app config so push tokens are always
// scoped to the correct project. (A hard-coded, mismatched id silently breaks
// background push delivery.)
const PROJECT_ID =
  (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
  (Constants as any)?.easConfig?.projectId ||
  '26f7651a-68bb-4bcb-ba83-bd9669f7647e';

// Custom loud buzzer for new orders (bundled via the expo-notifications plugin).
// Android resource names can't contain hyphens → file is new_order.wav.
const NEW_ORDER_SOUND = 'new_order.wav';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'order_update' | 'new_order' | 'delivery_assigned' | 'promotion' | 'verification_update';
  orderId?: string;
  message?: string;
}

class NotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permissions not granted');
        return null;
      }

      // Get Expo push token (scoped to THIS project)
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: PROJECT_ID,
      });

      this.expoPushToken = tokenData.data;
      console.log('Expo Push Token:', this.expoPushToken);

      // Save token locally
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  async setupAndroidChannels(): Promise<void> {
    // NEW ORDER / NEW PICKUP — loudest channel, custom buzzer. Partners & riders
    // must hear this even when the app is closed. MAX importance + custom sound.
    // Android FREEZES a channel's sound/importance at creation, so a build that
    // first created this channel without the custom buzzer would be stuck on the
    // default forever. Delete-then-recreate guarantees the new_order.wav sound +
    // MAX importance are actually applied (cost: resets channel to our defaults).
    await Notifications.deleteNotificationChannelAsync('new_orders').catch(() => {});
    await Notifications.setNotificationChannelAsync('new_orders', {
      name: 'New Orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 400, 600, 400, 600],
      lightColor: '#ef4444',
      sound: NEW_ORDER_SOUND,            // bundled new_order.wav
      bypassDnd: true,
      enableVibrate: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });

    // Order updates channel
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
      sound: 'default',
    });

    // Promotions channel
    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Promotions & Offers',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    // Delivery updates channel
    await Notifications.setNotificationChannelAsync('delivery', {
      name: 'Delivery Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
      sound: 'default',
    });
  }

  /** Current notification permission ('granted' | 'denied' | 'undetermined'). */
  async getPermissionStatus(): Promise<string> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch {
      return 'undetermined';
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted' && Platform.OS === 'android') await this.setupAndroidChannels();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Android only — ask the OS to exclude us from battery optimization so the
   * loud new-order buzzer fires reliably even when the app is closed/dozing.
   * Opens the system dialog; we only nudge once (flag stored).
   */
  async requestBatteryOptimizationExemption(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await AsyncStorage.setItem('batteryOptAsked', '1');
      // The battery-optimization LIST — no special permission, no Play-policy risk.
      // User finds Shinitz and chooses "Don't optimize".
      await IntentLauncher.startActivityAsync(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' as any,
      );
    } catch {
      // Fallback: open this app's settings page so the user can find Battery there.
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: 'package:' + ((Constants?.expoConfig as any)?.android?.package || 'com.shinitz.app') },
        );
      } catch {}
    }
  }

  async hasAskedBatteryOpt(): Promise<boolean> {
    return (await AsyncStorage.getItem('batteryOptAsked')) === '1';
  }

  async savePushTokenToServer(userId: string): Promise<void> {
    if (!this.expoPushToken) {
      await this.registerForPushNotifications();
    }

    if (this.expoPushToken) {
      try {
        await api.post('/users/push-token', {
          user_id: userId,
          token: this.expoPushToken,
          platform: Platform.OS,
        });
      } catch (error) {
        console.error('Error saving push token to server:', error);
      }
    }
  }

  // Add notification listeners
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Schedule local notification
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    seconds: number = 1
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as any,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}

export const notificationService = new NotificationService();
export default notificationService;

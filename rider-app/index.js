// Custom app entry. The FCM background/killed message handler + notifee
// foreground-service runner MUST be registered at the very top of the JS bundle
// (before the React app) so Android's headless launch for a killed-app message
// finds them already wired — this is what makes the incoming-order ring survive
// an app kill. Then hand off to Expo Router's normal entry.
import './src/alerts/fcmBackground';
// Active Delivery Mode's background location task must also be defined at
// entry so Android can dispatch GPS fixes into it headlessly (app minimized,
// screen locked, or relaunched by the location foreground service).
import './src/delivery/activeDeliveryMode';
import 'expo-router/entry';

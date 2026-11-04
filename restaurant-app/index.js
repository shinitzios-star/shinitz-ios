// Custom app entry. The FCM background/killed message handler + notifee
// foreground-service runner MUST be registered at the very top of the JS bundle
// (before the React app) so Android's headless launch for a killed-app message
// finds them already wired — this is what makes the incoming-order ring survive
// an app kill. Then hand off to Expo Router's normal entry.
import './src/alerts/fcmBackground';
import 'expo-router/entry';

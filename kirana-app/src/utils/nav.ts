import { Platform, Linking } from 'react-native';

/**
 * Open the device's native Google Maps app for turn-by-turn navigation.
 *
 * This is a DEEP LINK — it costs nothing (no Directions API call from us) and
 * gives the rider professional, live turn-by-turn in the app they already know.
 * Android uses the google.navigation intent; iOS falls back to the Maps URL.
 */
export function openNativeNavigation(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const url = Platform.select({
    ios: web,
    android: `google.navigation:q=${lat},${lng}&mode=d`,
    default: web,
  })!;
  Linking.openURL(url).catch(() => Linking.openURL(web).catch(() => {}));
}

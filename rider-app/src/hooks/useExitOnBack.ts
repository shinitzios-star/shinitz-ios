import { useCallback, useRef } from 'react';
import { BackHandler, ToastAndroid, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Stops the Android back button / edge-swipe gesture from popping the whole
 * role area off the root stack and landing the user on the Welcome screen —
 * which looks exactly like an accidental logout.
 *
 * Behaviour: on the focused main screen, the first back press shows a
 * "Press back again to exit" toast; a second press within 2s exits the app.
 *
 * Attach ONLY to the FIRST tab of each role area (home / dashboard / available).
 * In a bottom-tab navigator, back from any non-first tab already returns to the
 * first tab, and pushed screens (edit-profile, order-detail…) keep their normal
 * back behaviour because this hook isn't mounted there.
 *
 * iOS has no hardware back; the edge swipe there is handled by gestureEnabled:false
 * on the role group in the root layout.
 */
export function useExitOnBack() {
  const lastPress = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastPress.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastPress.current = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true; // block default → never pop to the Welcome screen
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, []),
  );
}

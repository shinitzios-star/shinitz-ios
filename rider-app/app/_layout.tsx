import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useCartStore } from '../src/store/cartStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useNotifications } from '../src/hooks/useNotifications';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ToastProvider } from '../src/components/Toast';
import { OfflineBanner } from '../src/components/OfflineBanner';
import AppUpdateGate from '../src/components/AppUpdateGate';
import { onLocationConsentBusy } from '../src/delivery/locationConsent';
import { registerUnauthorizedHandler } from '../src/services/api';
import LocationConsentHost from '../src/delivery/LocationConsentHost';
// NOTE: the killed-app incoming-order transport (FCM setBackgroundMessageHandler
// + notifee foreground service + notifee background events) is registered in
// ../index.js BEFORE this React tree so it survives an app kill.
import '../src/i18n';
import { useTranslation } from 'react-i18next';

// Keep the native Shinitz splash up until JS is ready (prevents the white flash /
// second blank splash). Hidden once storage loads in RootLayout.
SplashScreen.preventAutoHideAsync().catch(() => {});

function NotificationHandler() {
  useNotifications();
  return null;
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const loggingOut = React.useRef(false);

  // Wire the axios 401 interceptor → auto-logout flow.
  // Guarded so a burst of 401s (multiple polls failing at once) triggers exactly
  // ONE logout+redirect instead of a redirect loop / repeated navigation.
  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      try {
        await logout();
        router.replace('/');
      } finally {
        setTimeout(() => { loggingOut.current = false; }, 1500);
      }
    });
  }, [logout]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* The prominent location disclosure + permission explanations. At the
          root so it can appear over any screen, registration included; ahead
          of the Stack so it is ready before any screen asks. */}
      <LocationConsentHost />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        {/*
          Authenticated role areas: disable the edge swipe-back gesture.
          Without this, swiping from the screen edge pops the role group off
          the root stack and lands the user on the Welcome screen — which looks
          exactly like an accidental logout. Users move around inside each role
          area via the bottom tabs, not an edge swipe, so nothing is lost.
        */}
        <Stack.Screen name="(delivery)"   options={{ gestureEnabled: false }} />
      </Stack>
      <NotificationHandler />
      <OfflineBanner />
      <RiderUpdateGate />
    </>
  );
}

/**
 * "New Update Available". An optional update waits while the location consent
 * flow is on screen (the disclosure, Android's dialogs, the Settings page) so
 * the two never stack; a mandatory update does not wait for anything.
 */
function RiderUpdateGate() {
  const [consentBusy, setConsentBusy] = useState(false);
  useEffect(() => onLocationConsentBusy(setConsentBusy), []);
  return <AppUpdateGate canPromptOptional={!consentBusy} />;
}

export default function RootLayout() {
  const { loadFromStorage, isLoading } = useAuthStore();
  const { loadFromStorage: loadCart } = useCartStore();
  const { loadSettings, language } = useSettingsStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    loadFromStorage();
    loadCart();
    loadSettings();
    // Safety: never let the native splash hang if storage loading stalls.
    const cap = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 3000);
    return () => clearTimeout(cap);
  }, []);

  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // Storage ready → hide the native splash, going straight to the app (the green
  // role-gate), with no intermediate white/JS splash on any device.
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}


import React, { useEffect } from 'react';
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
import { registerUnauthorizedHandler } from '../src/services/api';
import ConsentGate from '../src/components/ConsentGate';
import { useConsentStore } from '../src/store/consentStore';
import SwitchRestaurantSheet from '../src/components/SwitchRestaurantSheet';
import AppUpdateGate from '../src/components/AppUpdateGate';
import '../src/i18n';
import { useTranslation } from 'react-i18next';

// Keep the native Shinitz splash up until JS is ready (removes the white/JS splash).
SplashScreen.preventAutoHideAsync().catch(() => {});

function NotificationHandler() {
  useNotifications();
  return null;
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const loggingOut = React.useRef(false);
  // The Stack is mounted beneath the consent overlay, but push registration asks
  // for the notification permission on mount — that prompt must not appear over
  // the consent screen, so the handler waits for consent as it always did.
  const consentAccepted = useConsentStore((s) => s.status === 'accepted');

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
        <Stack.Screen name="(consumer)"   options={{ gestureEnabled: false }} />
      </Stack>
      {consentAccepted && <NotificationHandler />}
      <OfflineBanner />
      {/* One cart = one restaurant — mounted once so every Add path is covered. */}
      <SwitchRestaurantSheet />
      {/* "New Update Available". An optional update waits for the legal consent
          to be accepted; a mandatory one does not wait for anything. */}
      <AppUpdateGate canPromptOptional={consentAccepted} />
    </>
  );
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

  // Storage ready -> hide the native splash, going straight to the app with no
  // intermediate white/JS splash on any device.
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
            {/* Legal consent is an overlay ABOVE the navigator, never a
                replacement for it: expo-router needs the Stack mounted on the
                root layout's first render, or the first navigation rebuilds the
                whole tree and throws the tabs back to Home. Screens that must
                not run before consent (index's redirect, the (consumer) group)
                check useConsentStore themselves. */}
            <ConsentGate>
              <AppContent />
            </ConsentGate>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}


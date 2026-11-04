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
        <Stack.Screen name="(kirana)"     options={{ gestureEnabled: false }} />
      </Stack>
      <NotificationHandler />
      <OfflineBanner />
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
            <AppContent />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}


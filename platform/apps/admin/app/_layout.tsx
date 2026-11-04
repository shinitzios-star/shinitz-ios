import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary, ThemeProvider, ToastProvider, i18n } from '@shinitz/shared-core';

// i18n is initialised by importing it (side effect).
void i18n;

/** Root layout for the  app — only knows (auth) + its own role group. */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(admin)" options={{ gestureEnabled: false }} />
            </Stack>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

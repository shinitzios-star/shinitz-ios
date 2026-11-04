import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import OrderAlertCenter from '../../src/alerts/OrderAlertCenter';
import { ensureLocationAccess } from '../../src/delivery/locationConsent';


/**
 * Catches a render error in ANY screen of this group. Without it the only
 * boundary is the root one, which replaces the entire app — which is what a
 * "broken" or blank screen looks like to the person holding the phone.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView contentContainerStyle={eb.wrap}>
      <Text style={eb.title}>This screen didn't load</Text>
      <Text style={eb.body}>
        Something went wrong while showing this page. Nothing has been lost — try again.
      </Text>
      <TouchableOpacity style={eb.btn} onPress={retry} activeOpacity={0.85}>
        <Text style={eb.btnText}>Try again</Text>
      </TouchableOpacity>
      {__DEV__ && <Text style={eb.detail}>{String(error?.message || error)}</Text>}
    </ScrollView>
  );
}

const eb = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 12, backgroundColor: '#0F3D2E',
    paddingHorizontal: 26, paddingVertical: 12, borderRadius: 24,
  },
  btnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  detail: { fontSize: 11, color: '#9CA3AF', marginTop: 14, textAlign: 'center' },
});

export default function DeliveryLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Entering the rider dashboard is opening the delivery functionality, so this
  // is the first — and most reachable — place the location disclosure appears,
  // straight after sign-in. Only when something is missing, and not again
  // within a day of the rider saying "Not now".
  useEffect(() => {
    ensureLocationAccess({ background: true, mode: 'auto' });
  }, []);

  return (
    <OrderAlertCenter>
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 62 + insets.bottom,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'My Shifts',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons name={focused ? 'calendar-check' : 'calendar-check-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="refer"
        options={{
          title: 'Refer',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-arrow-right-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
          ),
        }}
      />

      {/* Order-handling + utility screens — kept fully functional, reached from
          Home/Earnings, hidden from the tab bar (href:null leaves no empty slot). */}
      <Tabs.Screen name="available" options={{ href: null }} />
      <Tabs.Screen name="active" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="navigation" options={{ href: null }} />
      <Tabs.Screen name="verification" options={{ href: null }} />
    </Tabs>
    </OrderAlertCenter>
  );
}

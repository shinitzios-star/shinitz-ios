import React from 'react';
import { Platform, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/contexts/ThemeContext';
import { elevation, radius } from '../../src/constants/designSystem';
import OrderAlertCenter from '../../src/alerts/OrderAlertCenter';

/** Focused tabs get the FILLED icon, unfocused the OUTLINE — the subtle
 *  premium cue used by every tier-1 merchant app. */
function tabIcon(filled: any, outline: any) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

// Light haptic tick on every tab switch.
const haptic = { tabPress: () => { Haptics.selectionAsync().catch(() => {}); } } as any;


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

export default function RestaurantLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <OrderAlertCenter>
    <Tabs
      screenOptions={{
        headerShown: false,
        // Floating rounded dock — sits above content with soft elevation.
        tabBarStyle: {
          position: 'absolute',
          left: 12, right: 12,
          bottom: Math.max(insets.bottom - 4, 10),
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          borderRadius: radius.xl,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          ...elevation(3),
          ...(Platform.OS === 'android' ? { borderWidth: 1, borderColor: colors.tabBarBorder } : {}),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
        tabBarItemStyle: { borderRadius: radius.lg },
      }}
    >
      <Tabs.Screen name="dashboard" listeners={haptic}
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid', 'grid-outline') }} />
      <Tabs.Screen name="menu" listeners={haptic}
        options={{ title: 'Menu', tabBarIcon: tabIcon('restaurant', 'restaurant-outline') }} />
      <Tabs.Screen name="orders" listeners={haptic}
        options={{ title: 'Orders', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="verification" listeners={haptic}
        options={{ title: 'Verify', tabBarIcon: tabIcon('shield-checkmark', 'shield-checkmark-outline') }} />
      <Tabs.Screen name="profile" listeners={haptic}
        options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }} />
      {/* Edit profile — hidden from the tab bar, opened from Profile */}
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      {/* Earnings & Payouts — hidden, opened from the Dashboard */}
      <Tabs.Screen name="payouts" options={{ href: null }} />
      {/* Ad Campaigns — hidden, opened from the Dashboard */}
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="campaign-create" options={{ href: null }} />
      <Tabs.Screen name="campaign-detail" options={{ href: null }} />
      <Tabs.Screen name="ad-wallet" options={{ href: null }} />
    </Tabs>
    </OrderAlertCenter>
  );
}

import React from 'react';
import { Tabs } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../src/store/cartStore';
import { useFavoritesStore } from '../../src/store/favoritesStore';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useConsentStore } from '../../src/store/consentStore';

/**
 * Catches a render error in ANY consumer screen.
 *
 * Without this, the only boundary is the root one, which swaps the whole app
 * for a recovery screen — from the outside that is the app "breaking" or going
 * blank. Here the tab bar survives, the person can switch tabs, and the failed
 * screen offers a retry.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView contentContainerStyle={styles.errWrap}>
      <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
      <Text style={styles.errTitle}>This screen didn't load</Text>
      <Text style={styles.errBody}>
        Something went wrong while showing this page. Your account and your cart are safe.
      </Text>
      <TouchableOpacity style={styles.errBtn} onPress={retry} activeOpacity={0.85}>
        <Text style={styles.errBtnText}>Try again</Text>
      </TouchableOpacity>
      {__DEV__ && <Text style={styles.errDetail}>{String(error?.message || error)}</Text>}
    </ScrollView>
  );
}

export default function ConsumerLayout() {
  // Subscribe to the NUMBERS, not the stores: taking the whole store re-rendered
  // this navigator on every cart or favourites change.
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + (i.quantity || 0), 0));
  const favCount = useFavoritesStore((s) => s.favorites.length);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const consentAccepted = useConsentStore((s) => s.status === 'accepted');

  // Adds the bottom safe area inset to the tab bar so it doesn't collide
  // with the system gesture / 3-button nav on edge-to-edge displays.
  const bottomInset = insets.bottom;

  // Nothing in the signed-in area may run before the terms are accepted — Home
  // asks for location on mount. The consent overlay sits above the navigator
  // (see ConsentGate), so this guard is what stops a deep link from mounting
  // these screens underneath it. After all hooks, per the rules of hooks.
  if (!consentAccepted) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // NOTE: `animation: 'fade'` was REMOVED here — with this
        // react-navigation/bottom-tabs version it broke the tab bar's geometry:
        // the bar PAINTED at the bottom but its touch targets were laid out
        // ~100px higher (verified via uiautomator bounds vs screenshots), so
        // every tab tap at the visible position was silently dead. Emulator-
        // bisected: the admin Tabs (no animation) worked, the consumer Tabs
        // (fade) didn't, on the same build. Do not re-add without re-testing
        // taps at the PAINTED tab position on a real device/emulator.
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Math.max(bottomInset, 10),
          paddingTop: 8,
          height: 70 + bottomInset,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="heart" size={size} color={color} />
              {favCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.badgeText}>{favCount > 9 ? '9+' : favCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="cart" size={size} color={color} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="refer" options={{ href: null }} />
      <Tabs.Screen name="addresses" options={{ href: null }} />
      <Tabs.Screen name="order-detail" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="payment-success" options={{ href: null }} />
      <Tabs.Screen name="payment-failed" options={{ href: null }} />
      <Tabs.Screen name="payment-methods" options={{ href: null }} />
      <Tabs.Screen name="store" options={{ href: null }} />
      {/* Reachable from Profile, not shown as tabs */}
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
      {/* Tier-1 screens — routed from the bell icon / Profile, never tabs.
          (Without these entries expo-router auto-registers every file in this
          group as a VISIBLE tab — that's how "wallet / notifi… / delet…"
          showed up in the tab bar with broken ▯ icons.) */}
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="delete-account" options={{ href: null }} />
      {/* Refund flow — reached from an order or from Profile, never a tab. */}
      <Tabs.Screen name="refund-request" options={{ href: null }} />
      <Tabs.Screen name="refunds" options={{ href: null }} />
      <Tabs.Screen name="refund-detail" options={{ href: null }} />
    </Tabs>
  );
}

// Static fallback colors here (used inside the badge rendered above)
// because StyleSheet.create can't reference hook values. The badges remain
// brand-green which is the same in both themes by design.
const BADGE_PRIMARY = '#0F3D2E';

const styles = StyleSheet.create({
  errWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 6 },
  errBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  errBtn: {
    marginTop: 12, backgroundColor: '#0F3D2E',
    paddingHorizontal: 26, paddingVertical: 12, borderRadius: 24,
  },
  errBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  errDetail: { fontSize: 11, color: '#9CA3AF', marginTop: 14, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: BADGE_PRIMARY,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
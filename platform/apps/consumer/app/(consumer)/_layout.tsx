import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../src/store/cartStore';
import { useFavoritesStore } from '../../src/store/favoritesStore';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function ConsumerLayout() {
  const { getItemCount } = useCartStore();
  const cartCount = getItemCount();
  const { favorites } = useFavoritesStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Adds the bottom safe area inset to the tab bar so it doesn't collide
  // with the system gesture / 3-button nav on edge-to-edge displays.
  const bottomInset = insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Smooth crossfade between tabs — makes opening Profile from the home
        // hamburger feel intentional instead of an abrupt, flashing tab swap.
        animation: 'fade',
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
              {favorites.length > 0 && (
                <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.badgeText}>{favorites.length > 9 ? '9+' : favorites.length}</Text>
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
    </Tabs>
  );
}

// Static fallback colors here (used inside the badge rendered above)
// because StyleSheet.create can't reference hook values. The badges remain
// brand-green which is the same in both themes by design.
const BADGE_PRIMARY = '#0F3D2E';

const styles = StyleSheet.create({
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
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function DeliveryLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 60 + insets.bottom,
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
        name="available"
        options={{
          title: 'Available',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: 'Active',
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      {/* Navigation screen — full-screen map, hidden from tab bar */}
      <Tabs.Screen
        name="navigation"
        options={{ tabBarButton: () => null, headerShown: false }}
      />
      {/* Verification / onboarding — hidden from tab bar, opened from the gate */}
      <Tabs.Screen
        name="verification"
        options={{ tabBarButton: () => null, headerShown: false }}
      />
      {/* Wallet — hidden from tab bar, opened from Earnings / Profile */}
      <Tabs.Screen
        name="wallet"
        options={{ tabBarButton: () => null, headerShown: false }}
      />
    </Tabs>
  );
}

import React from 'react';
import { Tabs } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';


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

export default function KiranaLayout() {
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
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          title: 'Verify',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

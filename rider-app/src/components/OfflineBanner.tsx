import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '../constants/theme';

/**
 * Global offline indicator.
 * Listens to NetInfo and slides a banner down whenever the device loses
 * connectivity. Auto-hides when connection returns.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // null at startup means "unknown" — treat as online
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOffline ? 0 : -60,
      tension: 70,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isOffline, translateY]);

  return (
    <Animated.View
      // NEVER 'auto': this bar is purely informational, but it is full-width,
      // pinned to the top and above everything (zIndex 9999) — with touch
      // enabled it silently ate every tap in that band (back buttons, headers)
      // for as long as NetInfo believed the device was offline.
      pointerEvents="none"
      style={[styles.banner, { transform: [{ translateY }] }]}
    >
      <Ionicons name="cloud-offline" size={16} color="#fff" />
      <Text style={styles.text}>You're offline. Some features may be unavailable.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingTop: SPACING.lg + SPACING.sm,  // safe area top
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    zIndex: 9999,
    elevation: 10,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
});

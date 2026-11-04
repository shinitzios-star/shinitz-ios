import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  areaName?: string;
  reason?: string | null;            // available | service_disabled | no_stores | no_riders
  refreshing?: boolean;
  notified?: boolean;
  onChangeAddress: () => void;
  onRefresh: () => void;
  onNotify: () => void;
}

const REASON_SUB: Record<string, string> = {
  service_disabled: 'Service is temporarily paused in your area. We’ll be back soon.',
  no_riders: 'No delivery partners are available in your area right now. Please try again shortly.',
  no_stores: 'We’re expanding quickly and will be available in your area soon.',
};

export function UnserviceableScreen({ areaName, reason, refreshing, notified, onChangeAddress, onRefresh, onNotify }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Float + entrance animations.
  const float = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const sub = (reason && REASON_SUB[reason]) || 'We’re expanding quickly and will be available in your area soon.';

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primary, colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center' }}>
          <View style={styles.badge}><Text style={styles.badgeText}>HANG TIGHT</Text></View>
          <Text style={styles.title}>Service Not Available Yet</Text>
          <Text style={styles.sub}>{sub}</Text>
        </Animated.View>

        {/* Branded rider illustration */}
        <View style={styles.scene}>
          <View style={[styles.cloud, { left: 24, top: 14 }]} />
          <View style={[styles.cloud, { right: 28, top: 30, width: 54 }]} />
          <Animated.View style={[styles.riderWrap, { transform: [{ translateY }] }]}>
            <View style={styles.riderCircle}>
              <Ionicons name="bicycle" size={84} color="#fff" />
            </View>
            <View style={styles.shadow} />
          </Animated.View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.locRow}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.locText} numberOfLines={1}>{areaName || 'Your selected location'}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onChangeAddress}>
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={styles.primaryText}>Change Address</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineBtn, notified && { borderColor: colors.success, backgroundColor: colors.success + '12' }]}
          activeOpacity={0.85}
          onPress={onNotify}
          disabled={notified}
        >
          <Ionicons name={notified ? 'checkmark-circle' : 'notifications-outline'} size={18} color={notified ? colors.success : colors.primary} />
          <Text style={[styles.outlineText, notified && { color: colors.success }]}>
            {notified ? 'You’re on the waitlist' : 'Notify Me When Available'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={onRefresh} disabled={refreshing}>
          {refreshing ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Ionicons name="refresh" size={16} color={colors.textSecondary} />}
          <Text style={styles.ghostText}>{refreshing ? 'Checking…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { paddingTop: SPACING.xl, paddingBottom: SPACING.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  badge: { backgroundColor: '#1a1a1a', paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full, marginBottom: SPACING.sm },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: FONTS.sizes.md, letterSpacing: 1 },
  title: { color: '#fff', fontSize: FONTS.sizes.xxxl, fontWeight: '900', textAlign: 'center', paddingHorizontal: SPACING.lg, letterSpacing: -0.5 },
  sub: { color: 'rgba(255,255,255,0.95)', fontSize: FONTS.sizes.md, textAlign: 'center', marginTop: SPACING.sm, paddingHorizontal: SPACING.xl, lineHeight: 22 },
  scene: { height: 220, marginTop: SPACING.md, alignItems: 'center', justifyContent: 'center' },
  cloud: { position: 'absolute', width: 44, height: 16, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)' },
  riderWrap: { alignItems: 'center' },
  riderCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  shadow: { width: 90, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.15)', marginTop: 10 },
  body: { padding: SPACING.lg, paddingTop: SPACING.xl },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: SPACING.lg },
  locText: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, fontWeight: '600', maxWidth: '80%' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.primary, borderRadius: RADIUS.lg, paddingVertical: 15, marginBottom: SPACING.sm, ...SHADOWS.md },
  primaryText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1.5, borderColor: colors.primary, borderRadius: RADIUS.lg, paddingVertical: 14, marginBottom: SPACING.sm },
  outlineText: { color: colors.primary, fontSize: FONTS.sizes.md, fontWeight: '800' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  ghostText: { color: colors.textSecondary, fontSize: FONTS.sizes.md, fontWeight: '600' },
});

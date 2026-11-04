// ─────────────────────────────────────────────────────────────────────────────
// OrderInProgressCard — Swiggy-style persistent bottom card shown on EVERY tab
// while the rider has a live delivery. Slides up on acceptance, updates its
// status pill in real time (fed by OrderAlertCenter's poll — no own timers),
// slides down when the job completes. Tap → Active Order screen.
// Positioned absolutely just above the bottom tab bar; never covers it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { space, radius, elevation } from '../constants/designSystem';
import { useOrderAlertCenter } from '../alerts/OrderAlertCenter';

const TAB_BAR_BASE = 62;   // must match (delivery)/_layout tabBarStyle height

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  delivery_assigned: { label: 'Heading to restaurant', color: '#3b82f6' },
  preparing: { label: 'Waiting for pickup', color: '#f59e0b' },
  ready_for_pickup: { label: 'Pick up now', color: '#f59e0b' },
  out_for_delivery: { label: 'On the way', color: '#10b981' },
};

export function OrderInProgressCard() {
  const { activeDeliveries } = useOrderAlertCenter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(140)).current;   // offscreen (below)
  const pulse = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(false);
  // Keep rendering the LAST order during the slide-down so the card doesn't
  // blank out mid-animation.
  const lastRef = useRef<any[]>([]);
  if (activeDeliveries.length) lastRef.current = activeDeliveries;
  const orders = activeDeliveries.length ? activeDeliveries : lastRef.current;
  const order = orders[0];

  // Slide up when a delivery starts, down when it ends.
  useEffect(() => {
    if (activeDeliveries.length) {
      setVisible(true);
      Animated.spring(slide, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }).start();
    } else if (visible) {
      Animated.timing(slide, { toValue: 140, duration: 260, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setVisible(false); });
    }
  }, [activeDeliveries.length]);

  // Gentle pulse on the live dot.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible]);

  if (!visible || !order) return null;

  const badge = STATUS_BADGE[order.status] || STATUS_BADGE.delivery_assigned;
  const many = orders.length > 1;
  const eta = order.route_eta_minutes ?? order.rider_eta_minutes;
  const meta = [
    order.distance != null ? `${order.distance} km` : null,
    eta != null ? `ETA ${eta} min` : null,
    `#${String(order.id || '').slice(-4).toUpperCase()}`,
  ].filter(Boolean).join(' • ');

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[s.wrap, {
        bottom: TAB_BAR_BASE + Math.max(insets.bottom, 8) + 8,
        transform: [{ translateY: slide }],
      }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          try { router.push('/(delivery)/active' as any); } catch {}
        }}
        style={[s.card, { backgroundColor: colors.primary }, elevation(3)]}
      >
        <View style={s.iconWrap}>
          <Ionicons name="bicycle" size={22} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Animated.View style={[s.liveDot, { transform: [{ scale: pulse }] }]} />
            <Text style={s.title} numberOfLines={1}>
              {many ? `Orders in Progress (${orders.length})` : 'Order in Progress'}
            </Text>
          </View>
          <Text style={s.sub} numberOfLines={1}>
            {order.kirana_name || 'Pickup'}{order.user_name ? ` → ${order.user_name}` : ''}
          </Text>
          <View style={s.metaRow}>
            <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <View style={[s.badgeDot, { backgroundColor: badge.color }]} />
              <Text style={s.badgeText}>{badge.label}</Text>
            </View>
            {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderRadius: radius.xl, paddingVertical: space.md, paddingHorizontal: space.lg,
    minHeight: 76,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  title: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: -0.2 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 5 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '600', flexShrink: 1 },
});

export default OrderInProgressCard;

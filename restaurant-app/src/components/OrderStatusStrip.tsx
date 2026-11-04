// Horizontal mini-timeline shown under each order card — the merchant sees at
// a glance exactly where an order is in its lifecycle (Zomato-Partner style).
// Purely presentational: reads order.status (+created/accepted timestamps for
// the live prep timer). Cancelled orders show a struck-through red strip.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

// Icons for the backend's canonical steps (order.progress). The strip used to
// keep its own list and folded "delivery partner assigned" into Preparing, so
// the merchant could not tell whether anyone was coming for the food — the one
// thing standing between "cooked" and "ready for pickup".
const STEP_ICONS: Record<string, any> = {
  placed: 'sparkles',
  accepted: 'checkmark',
  preparing: 'flame',
  delivery_assigned: 'bicycle',
  ready_for_pickup: 'bag-check',
  out_for_delivery: 'navigate',
  delivered: 'home',
};
const SHORT_LABEL: Record<string, string> = {
  placed: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  delivery_assigned: 'Rider',
  ready_for_pickup: 'Ready',
  out_for_delivery: 'Picked up',
  delivered: 'Delivered',
};

/** Steps for this order: the backend's list, or a bare fallback if it is missing. */
function stepsFor(order: any): { key: string; label: string; icon: any; done: boolean }[] {
  const progress = Array.isArray(order?.progress) ? order.progress : [];
  if (!progress.length) {
    return [{ key: 'placed', label: 'New', icon: STEP_ICONS.placed, done: true }];
  }
  return progress.map((st: any) => ({
    key: st.key,
    label: SHORT_LABEL[st.key] || st.label,
    icon: STEP_ICONS[st.key] || 'ellipse',
    done: !!st.done,
  }));
}

/** "12m" elapsed since a timestamp — live-updating prep timer. */
function useElapsedMin(iso?: string | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60_000)) : null;
}

export function OrderStatusStrip({ order }: { order: any }) {
  const { colors } = useTheme();
  const status = order?.status || 'pending';
  const cancelled = status === 'cancelled' || status === 'canceled' || status === 'rejected';
  const STEPS = stepsFor(order);
  // The furthest step actually reached — each one carries its own done flag,
  // so nothing here infers a sequence from `status`.
  const active = STEPS.reduce((acc: number, st, i) => (st.done ? i : acc), 0);
  // Live kitchen timer while the order is actually being worked on.
  const inKitchen = ['accepted', 'preparing', 'delivery_assigned'].includes(status);
  const elapsed = useElapsedMin(inKitchen ? (order.accepted_at || order.created_at) : null);

  if (cancelled) {
    return (
      <View style={[s.cancelStrip, { backgroundColor: colors.error + '12' }]}>
        <Ionicons name="close-circle" size={14} color={colors.error} />
        <Text style={[s.cancelText, { color: colors.error }]}>Order cancelled</Text>
      </View>
    );
  }

  return (
    <View style={[s.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {STEPS.map((st, i) => {
        const done = st.done && i < active;
        const current = i === active;
        const tint = done ? colors.success : current ? colors.primary : colors.textMuted;
        return (
          <React.Fragment key={st.key}>
            {i > 0 && <View style={[s.line, { backgroundColor: done || current ? colors.success : colors.border }]} />}
            <View style={s.step}>
              <View style={[s.dot, {
                backgroundColor: done ? colors.success : current ? colors.primary : colors.surfaceLight,
                borderColor: tint,
              }]}>
                <Ionicons name={done ? 'checkmark' : st.icon} size={9}
                  color={done || current ? '#fff' : colors.textMuted} />
              </View>
              <Text style={[s.label, { color: tint, fontWeight: current ? '800' : '600' }]} numberOfLines={1}>
                {current && elapsed != null ? `${st.label} · ${elapsed}m` : st.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderWidth: 1, borderTopWidth: 0,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    paddingHorizontal: 10, paddingVertical: 8, marginTop: -6, marginBottom: 12,
  },
  step: { alignItems: 'center', width: 52 },
  dot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { flex: 1, height: 2, borderRadius: 1, marginTop: 8, marginHorizontal: -14 },
  label: { fontSize: 8.5, marginTop: 3, textAlign: 'center' },
  cancelStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    paddingVertical: 7, marginTop: -6, marginBottom: 12,
  },
  cancelText: { fontSize: 12, fontWeight: '800' },
});

export default OrderStatusStrip;

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../constants/theme';

interface OrderItem { name: string; quantity: number; price: number; }
interface AlertOrder {
  id: string;
  total_amount: number;
  items?: OrderItem[];
  delivery_address?: string;
  distance?: number;
  user_name?: string;
  /** ISO expiry for the response countdown (rider offers); absent for restaurants. */
  offer_expires_at?: string;
}

interface Props {
  order: AlertOrder | null;
  visible: boolean;
  onAccept: () => void;
  onReject: () => void;
  /** Accept label changes per role: kirana "Accept", delivery "Accept Delivery" */
  acceptLabel?: string;
  /** Reject/dismiss label, e.g. "Decline" for a push offer */
  rejectLabel?: string;
}

export function IncomingOrderAlert({ order, visible, onAccept, onReject, acceptLabel = 'Accept', rejectLabel = 'Dismiss' }: Props) {
  // Flashing background between two reds to grab attention
  const flash = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]),
    );
    loop.start();
    Animated.spring(scale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    return () => { loop.stop(); scale.setValue(0.9); };
  }, [visible, flash, scale]);

  // Response countdown (only when the order carries an expiry, e.g. rider offers).
  const expiresAt = order?.offer_expires_at ? Date.parse(order.offer_expires_at) : NaN;
  useEffect(() => {
    if (!visible || !Number.isFinite(expiresAt)) { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visible, expiresAt]);

  if (!order) return null;

  const bg = flash.interpolate({ inputRange: [0, 1], outputRange: ['#7f1d1d', '#dc2626'] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onReject}>
      <Animated.View style={[styles.overlay, { backgroundColor: bg }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {/* Pulsing bell */}
          <View style={styles.bellWrap}>
            <Ionicons name="notifications" size={44} color={COLORS.error} />
          </View>

          <Text style={styles.title}>NEW ORDER!</Text>
          <Text style={styles.subtitle}>
            ₹{order.total_amount}
            {order.distance !== undefined ? `  ·  ${order.distance} km away` : ''}
          </Text>

          {secondsLeft !== null && (
            <View style={styles.countdown}>
              <Ionicons name="time" size={16} color={secondsLeft <= 10 ? COLORS.error : '#fff'} />
              <Text style={[styles.countdownText, secondsLeft <= 10 && { color: COLORS.error }]}>
                {secondsLeft}s to respond
              </Text>
            </View>
          )}

          {order.user_name ? <Text style={styles.customer}>{order.user_name}</Text> : null}

          {/* Items preview */}
          {order.items && order.items.length > 0 && (
            <ScrollView style={styles.items} contentContainerStyle={{ paddingVertical: 4 }}>
              {order.items.slice(0, 5).map((it, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{it.quantity}×</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                </View>
              ))}
              {order.items.length > 5 && (
                <Text style={styles.more}>+{order.items.length - 5} more</Text>
              )}
            </ScrollView>
          )}

          {order.delivery_address ? (
            <View style={styles.addr}>
              <Ionicons name="location" size={14} color={COLORS.textSecondary} />
              <Text style={styles.addrText} numberOfLines={2}>{order.delivery_address}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.reject]} onPress={onReject} activeOpacity={0.85}>
              <Ionicons name="close" size={20} color="#fff" />
              <Text style={styles.btnText}>{rejectLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.accept]} onPress={onAccept} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.btnText}>{acceptLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl + 6, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.lg,
  },
  bellWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.error + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: '800', color: COLORS.error, letterSpacing: 1 },
  subtitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, backgroundColor: COLORS.error + '22', paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.lg },
  countdownText: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
  customer: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: 2 },
  items: { maxHeight: 140, alignSelf: 'stretch', marginTop: SPACING.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: SPACING.sm },
  itemQty: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.primary, width: 32 },
  itemName: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text },
  more: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
  addr: { flexDirection: 'row', gap: 6, marginTop: SPACING.md, alignSelf: 'stretch', alignItems: 'flex-start' },
  addrText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg, alignSelf: 'stretch' },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: RADIUS.lg },
  reject: { backgroundColor: COLORS.textMuted },
  accept: { backgroundColor: COLORS.success },
  btnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
});

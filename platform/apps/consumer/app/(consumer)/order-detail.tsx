import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import api from '../../src/services/api';
import { TrackingMap } from '../../src/components/TrackingMap';
import { useTrackingSocket } from '../../src/hooks/useTrackingSocket';
import { formatPhone, telLink } from '../../src/utils/format';

export default function OrderDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [tipBusy, setTipBusy] = useState(false);

  // WebSocket live tracking — only active during delivery phases
  const deliveryActive = ['delivery_assigned', 'ready_for_pickup', 'out_for_delivery'].includes(order?.status ?? '');
  const tracking = useTrackingSocket(orderId, deliveryActive);
  const lastTrackedStatus = useRef<string>('');

  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data);
    } catch (e) {
      if (__DEV__) console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  // When a real-time status_update arrives over the socket, refresh the order
  // so the timeline + all fields update instantly (no waiting for the poll).
  useEffect(() => {
    if (tracking.status && tracking.status !== lastTrackedStatus.current) {
      lastTrackedStatus.current = tracking.status;
      fetchOrder();
    }
  }, [tracking.status, fetchOrder]);

  // Poll only while screen is focused — stops draining battery when the user
  // navigates away (the previous useEffect kept polling forever).
  useFocusEffect(
    useCallback(() => {
      fetchOrder();
      const interval = setInterval(fetchOrder, 10000);
      return () => clearInterval(interval);
    }, [fetchOrder]),
  );

  const isCancelled = order?.status === 'cancelled';

  // Blinkit-style live tracking: show the green hero while a rider is on the job.
  const riderAssigned = !!order?.delivery_partner_name &&
    ['delivery_assigned', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(order?.status ?? '');
  const etaMin = tracking.etaMinutes ?? order?.rider_eta_minutes ?? order?.route_eta_minutes;

  const heroText = (() => {
    const s = order?.status;
    if (s === 'out_for_delivery') {
      if (etaMin != null && etaMin <= 3) return { sub: 'Be ready to collect your order', title: 'Almost at your doorstep' };
      return { sub: etaMin != null ? `Arriving in ~${etaMin} min` : 'Your order is on the way', title: 'On the way to you' };
    }
    if (s === 'ready_for_pickup') return { sub: 'Your rider is picking it up', title: 'Order is ready' };
    if (s === 'preparing') return { sub: 'The store is preparing your order', title: 'Preparing your order' };
    return { sub: 'Your rider is heading to the store', title: 'Rider assigned' };
  })();

  const addTip = async (amount: number) => {
    if (!order) return;
    setTipBusy(true);
    try {
      await api.post(`/orders/${order.id}/tip`, { amount });
      setOrder((o: any) => ({ ...o, tip_amount: amount }));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not add tip');
    } finally { setTipBusy(false); }
  };

  const submitRating = async (stars: number) => {
    setRatingValue(stars);
    setRatingSubmitting(true);
    try {
      await api.post(`/orders/${order.id}/rate-rider`, { rating: stars });
      setOrder((o: any) => ({ ...o, rider_rating: stars }));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('orderDetails')}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>{t('loadingOrder')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Consumer-facing milestone timeline (flag-aware, correctly ordered) ─────
  const STATUS_RANK: Record<string, number> = {
    pending: 0, accepted: 1, delivery_assigned: 2, preparing: 3,
    ready_for_pickup: 4, out_for_delivery: 5, delivered: 6,
  };
  const rank = STATUS_RANK[order.status] ?? -1;
  const reached = (s: string) => rank >= (STATUS_RANK[s] ?? 99);
  const milestones = [
    { key: 'pending',           label: 'Order Placed',             icon: 'receipt-outline' as const,          reached: rank >= 0 },
    { key: 'accepted',          label: 'Restaurant Accepted',      icon: 'checkmark-circle-outline' as const, reached: reached('accepted') },
    { key: 'delivery_assigned', label: 'Rider Assigned',           icon: 'bicycle-outline' as const,          reached: reached('delivery_assigned') },
    { key: 'preparing',         label: 'Preparing Order',          icon: 'restaurant-outline' as const,       reached: reached('preparing') },
    { key: 'rider_reached',     label: 'Rider Reached Restaurant', icon: 'storefront-outline' as const,       reached: !!order.rider_arrived_at_store || reached('out_for_delivery') },
    { key: 'out_for_delivery',  label: 'Out for Delivery',         icon: 'navigate-outline' as const,         reached: reached('out_for_delivery') },
    { key: 'delivered',         label: 'Delivered',                icon: 'checkmark-done-outline' as const,   reached: reached('delivered') },
  ];
  const lastReachedIdx = milestones.reduce((acc, m, i) => (m.reached ? i : acc), -1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: riderAssigned ? '#3FA34D' : colors.background }]} edges={['top']}>
      {riderAssigned ? (
        <View style={styles.heroHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.heroBack}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroHeaderSub}>{heroText.sub}</Text>
          <Text style={styles.heroHeaderTitle} numberOfLines={1}>{heroText.title}</Text>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            #{order.id.slice(-8).toUpperCase()}
          </Text>
          <View style={{ width: 44 }} />
        </View>
      )}

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchOrder(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Blinkit-style live tracking hero ──────────────────────────────── */}
        {riderAssigned && (
          <View style={styles.hero}>
            {deliveryActive && order.kirana_location?.lat != null && order.delivery_location?.lat != null && (
              <View style={styles.heroMap}>
                <TrackingMap
                  storeLat={order.kirana_location.lat}
                  storeLng={order.kirana_location.lng}
                  destLat={order.delivery_location.lat}
                  destLng={order.delivery_location.lng}
                  riderLat={tracking.riderLat ?? order.rider_location?.lat}
                  riderLng={tracking.riderLng ?? order.rider_location?.lng}
                  route={Array.isArray(order.route_polyline)
                    ? order.route_polyline.map((p: [number, number]) => ({ latitude: p[0], longitude: p[1] }))
                    : null}
                  etaMinutes={etaMin}
                  distanceKm={order.route_distance_km ?? null}
                  height={230}
                  showRecenter
                />
              </View>
            )}

            {/* Rider card */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroRiderRow}>
                <View style={[styles.heroAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="bicycle" size={26} color={colors.primary} />
                </View>
                <Text style={[styles.heroRiderName, { color: colors.text }]}>
                  I&apos;m {order.delivery_partner_name}, your delivery partner
                </Text>
                {order.delivery_partner_phone && (
                  <TouchableOpacity
                    style={styles.heroCall}
                    onPress={() => { const u = telLink(order.delivery_partner_phone); if (u) Linking.openURL(u); }}
                  >
                    <Ionicons name="call" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.heroBubble, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.heroBubbleText, { color: colors.success }]}>
                  {order.status === 'out_for_delivery'
                    ? (etaMin != null && etaMin <= 3 ? "I'm near your location and will be at your doorstep soon" : "I'm on my way to you")
                    : order.status === 'ready_for_pickup' ? "I'm picking up your order now"
                    : "I'm heading to the store to pick up your order"}
                </Text>
              </View>
            </View>

            {/* Tip card */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.tipTitle, { color: colors.text }]}>A little kindness can make their day</Text>
              <Text style={[styles.tipSub, { color: colors.textSecondary }]}>Say thanks with a tip</Text>
              <View style={styles.tipRow}>
                {[{ a: 20, e: '🫰' }, { a: 30, e: '💌' }, { a: 50, e: '❤️' }, { a: 100, e: '👏' }].map(({ a, e }) => {
                  const sel = order.tip_amount === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      disabled={tipBusy}
                      onPress={() => addTip(sel ? 0 : a)}
                      style={[styles.tipChip, { borderColor: colors.border }, sel && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                    >
                      <Text style={styles.tipEmoji}>{e}</Text>
                      <Text style={[styles.tipAmt, { color: sel ? colors.primary : colors.text }]}>₹{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {order.tip_amount > 0 ? (
                <Text style={[styles.tipThanks, { color: colors.success }]}>₹{order.tip_amount} tip added — your rider gets it on delivery 💚</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Status Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('orderStatus')}</Text>
          {isCancelled ? (
            <View style={[styles.cancelledBanner, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="close-circle" size={24} color={colors.error} />
              <Text style={[styles.cancelledText, { color: colors.error }]}>{t('orderCancelled')}</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {milestones.map((step, idx) => {
                const isCompleted = step.reached;
                const isCurrent = idx === lastReachedIdx;
                return (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          isCompleted && { backgroundColor: colors.success, borderColor: colors.success },
                          isCurrent && { backgroundColor: colors.primary, borderColor: colors.primary, ...SHADOWS.sm },
                        ]}
                      >
                        {isCompleted ? (
                          <Ionicons name="checkmark" size={14} color={'#ffffff'} />
                        ) : (
                          <Ionicons name={step.icon} size={14} color={colors.textMuted} />
                        )}
                      </View>
                      {idx < milestones.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: colors.border },
                            isCompleted && { backgroundColor: colors.success },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          { color: colors.textMuted },
                          isCompleted && { color: colors.text, fontWeight: '500' },
                          isCurrent && { color: colors.primary, fontWeight: '700' },
                        ]}
                      >
                        {step.label}
                      </Text>
                      {isCurrent && (
                        <Text
                          style={[
                            styles.timelineCurrentTag,
                            { backgroundColor: colors.primary + '20', color: colors.primary },
                          ]}
                        >
                          {t('current')}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Items */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('items')}</Text>
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={[styles.itemQty, { color: colors.primary }]}>{item.quantity}x</Text>
              <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          {/* Bill breakdown (GST). Older orders without the fields just show total. */}
          {order.subtotal != null && (
            <>
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.itemName, { color: colors.textSecondary }]}>Item Total</Text>
                <Text style={[styles.itemPrice, { color: colors.text }]}>₹{Number(order.subtotal).toFixed(2)}</Text>
              </View>
              {order.food_gst ? (
                <View style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: colors.textSecondary }]}>GST (5%)</Text>
                  <Text style={[styles.itemPrice, { color: colors.text }]}>₹{Number(order.food_gst).toFixed(2)}</Text>
                </View>
              ) : null}
              <View style={styles.itemRow}>
                <Text style={[styles.itemName, { color: colors.textSecondary }]}>Delivery Fee {order.delivery_gst ? '(incl. taxes)' : ''}</Text>
                <Text style={[styles.itemPrice, { color: colors.text }]}>
                  {Number(order.delivery_fee) === 0 ? 'FREE' : `₹${Number(order.delivery_fee).toFixed(2)}`}
                </Text>
              </View>
            </>
          )}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('total')}</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>₹{Number(order.total_amount).toFixed(2)}</Text>
          </View>
          {order.payment_method && (
            <View style={styles.itemRow}>
              <Text style={[styles.itemName, { color: colors.textSecondary }]}>
                {order.payment_method === 'online' ? 'Paid online' : 'Cash on Delivery'}
              </Text>
              <Text style={[styles.itemPrice, { color: order.payment_status === 'paid' ? colors.success : colors.warning, fontWeight: '700' }]}>
                {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </Text>
            </View>
          )}
        </View>

        {/* Delivery */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('deliveryDetails')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{order.delivery_address}</Text>
          </View>
          {order.kirana_name && (
            <View style={styles.infoRow}>
              <Ionicons name="storefront" size={18} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.text }]}>{order.kirana_name}</Text>
            </View>
          )}
          {order.delivery_partner_name && !riderAssigned && (
            <View style={styles.riderCard}>
              <View style={styles.riderAvatar}>
                <Ionicons name="person" size={22} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riderName, { color: colors.text }]}>{order.delivery_partner_name}</Text>
                <Text style={[styles.riderMeta, { color: colors.textSecondary }]}>
                  {order.delivery_partner_vehicle ? `${order.delivery_partner_vehicle} · ` : ''}
                  {formatPhone(order.delivery_partner_phone) || 'Delivery Partner'}
                </Text>
              </View>
              {order.delivery_partner_phone && (
                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: colors.success + '20' }]}
                  onPress={() => { const u = telLink(order.delivery_partner_phone); if (u) Linking.openURL(u); }}
                >
                  <Ionicons name="call" size={18} color={colors.success} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Rate the delivery partner — after delivery, once */}
          {order.status === 'delivered' && order.delivery_partner_id && (
            <View style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.ratingTitle, { color: colors.text }]}>
                {order.rider_rating ? 'You rated your delivery' : 'Rate your delivery partner'}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => {
                  const filled = (order.rider_rating || ratingValue) >= s;
                  return (
                    <TouchableOpacity
                      key={s}
                      disabled={!!order.rider_rating || ratingSubmitting}
                      onPress={() => submitRating(s)}
                      hitSlop={6}
                    >
                      <Ionicons name={filled ? 'star' : 'star-outline'} size={32} color={filled ? '#f59e0b' : colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              {ratingSubmitting && <ActivityIndicator size="small" color={colors.primary} />}
              {order.rider_rating ? <Text style={[styles.ratingThanks, { color: colors.textSecondary }]}>Thanks for your feedback!</Text> : null}
            </View>
          )}

          {/* Live tracking map — shown from rider assignment through delivery */}
          {/* Live rider ETA — updates via WebSocket as the rider moves */}
          {deliveryActive && !riderAssigned && (tracking.etaMinutes ?? order.rider_eta_minutes) != null && (
            <View style={[styles.etaBox, { backgroundColor: colors.info + '15' }]}>
              <Ionicons name="navigate-circle" size={22} color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.etaTitle, { color: colors.text }]}>
                  Arriving in ~{tracking.etaMinutes ?? order.rider_eta_minutes} min
                </Text>
                {tracking.connected && (
                  <Text style={[styles.etaSub, { color: colors.textSecondary }]}>
                    Live tracking active
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Delivery OTP — the customer reads this to the rider at the door.
              Backend only sends delivery_otp to the order's owner. Shown when
              the rider is on the way or arriving. */}
          {order.delivery_otp && ['out_for_delivery', 'ready_for_pickup', 'delivery_assigned'].includes(order.status) && (
            <View style={[styles.verifyBox, { backgroundColor: colors.success + '15' }]}>
              <Text style={[styles.verifyLabel, { color: colors.textSecondary }]}>
                Delivery OTP — give to rider
              </Text>
              <Text style={[styles.verifyCode, { color: colors.success }]}>{order.delivery_otp}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700' },
  // ── Blinkit-style live tracking hero ──
  heroHeader: { backgroundColor: '#3FA34D', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, paddingBottom: SPACING.md, position: 'relative' },
  heroBack: { position: 'absolute', left: SPACING.sm, top: SPACING.xs, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  heroHeaderSub: { color: 'rgba(255,255,255,0.92)', fontSize: FONTS.sizes.sm, textAlign: 'center', fontWeight: '600' },
  heroHeaderTitle: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  hero: { gap: SPACING.sm, marginBottom: SPACING.sm },
  heroMap: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  heroCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md },
  heroRiderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  heroAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  heroRiderName: { flex: 1, fontSize: FONTS.sizes.lg, fontWeight: '800' },
  heroCall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center' },
  heroBubble: { marginTop: SPACING.sm, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, alignSelf: 'flex-start' },
  heroBubbleText: { fontSize: FONTS.sizes.md, fontWeight: '600' },
  tipTitle: { fontSize: FONTS.sizes.md, fontWeight: '800' },
  tipSub: { fontSize: FONTS.sizes.sm, marginTop: 2, marginBottom: SPACING.sm },
  tipRow: { flexDirection: 'row', gap: SPACING.sm },
  tipChip: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1.5 },
  tipEmoji: { fontSize: 18 },
  tipAmt: { fontSize: FONTS.sizes.sm, fontWeight: '800' },
  tipThanks: { fontSize: FONTS.sizes.xs, fontWeight: '700', marginTop: SPACING.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  card: { borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1 },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', marginBottom: SPACING.md },
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md },
  cancelledText: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  timeline: { paddingLeft: SPACING.xs },
  timelineStep: { flexDirection: 'row', minHeight: 48 },
  timelineLeft: { alignItems: 'center', width: 30, marginRight: SPACING.sm },
  timelineDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineRight: { flex: 1, paddingBottom: SPACING.sm, flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  timelineLabel: { fontSize: FONTS.sizes.sm, paddingTop: 4 },
  timelineCurrentTag: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs },
  itemQty: { fontSize: FONTS.sizes.sm, fontWeight: '700', width: 30 },
  itemName: { flex: 1, fontSize: FONTS.sizes.md },
  itemPrice: { fontSize: FONTS.sizes.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1 },
  totalLabel: { fontSize: FONTS.sizes.md, fontWeight: '600' },
  totalValue: { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  infoText: { flex: 1, fontSize: FONTS.sizes.md },
  riderCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  ratingCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.xs },
  ratingTitle: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: SPACING.xs },
  ratingThanks: { fontSize: FONTS.sizes.xs },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59,130,246,0.12)', justifyContent: 'center', alignItems: 'center' },
  riderName: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  riderMeta: { fontSize: FONTS.sizes.sm, marginTop: 1 },
  callBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  etaBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  etaTitle: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  etaSub: { fontSize: FONTS.sizes.sm, marginTop: 1 },
  verifyBox: { borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, alignItems: 'center' },
  verifyLabel: { fontSize: FONTS.sizes.xs },
  verifyCode: { fontSize: FONTS.sizes.xxl + 4, fontWeight: '800', letterSpacing: 6, marginTop: 4 },
});

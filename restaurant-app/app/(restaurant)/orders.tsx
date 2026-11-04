// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Restaurant — Orders (premium merchant redesign, pass 4).
// The last screen still on the old static theme. Chrome only: gradient hero
// with live "new orders" pill, glass search, themed filter chips with count
// badges, dark-mode via useTheme. ALL order logic is untouched — fetch/poll,
// filters, search, pagination, status actions, OrderCard, timeline strip,
// audio note, live tracking map.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { OrderCard } from '../../src/components/OrderCard';
import { AudioNotePlayer } from '../../src/components/AudioNotePlayer';
import { OrderListSkeleton } from '../../src/components/SkeletonLoader';
import { ordersAPI } from '../../src/services/api';
import { TrackingMap } from '../../src/components/TrackingMap';
import { useTrackingSocket } from '../../src/hooks/useTrackingSocket';
import { OrderStatusStrip } from '../../src/components/OrderStatusStrip';

/**
 * Restaurant orders screen — mirrors the kirana flow.
 * Backend `/orders` returns pending+accepted orders for restaurant role.
 * Restaurant valid_transitions: pending → accepted → preparing → ready_for_pickup
 */
const PAGE = 15;

// A rider claiming an order flips its status to `delivery_assigned` whether or
// not the kitchen has started, so these read `preparing_at` to file the order
// where the merchant expects it rather than trusting the status alone.
const cooking = (o: any) => !!o.preparing_at;
const FILTERS: { key: string; label: string; match: (o: any) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'pending', label: 'New', match: (o) => o.status === 'pending' },
  { key: 'accepted', label: 'Accepted',
    match: (o) => o.status === 'accepted' || (o.status === 'delivery_assigned' && !cooking(o)) },
  { key: 'preparing', label: 'Preparing',
    match: (o) => o.status === 'preparing' || (o.status === 'delivery_assigned' && cooking(o)) },
  { key: 'ready', label: 'Ready', match: (o) => o.status === 'ready_for_pickup' },
  { key: 'delivery', label: 'Out for Delivery',
    match: (o) => o.status === 'out_for_delivery' || o.status === 'picked_up' },
  { key: 'delivered', label: 'Delivered', match: (o) => o.status === 'delivered' },
  { key: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled' },
];

const matchesQuery = (o: any, q: string) => {
  const ql = q.trim().toLowerCase();
  if (!ql) return true;
  const hay = [
    o.id, o.customer?.name, o.customer_name, o.delivery_address,
    ...((o.items || []).map((i: any) => i.name)),
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(ql);
};

export default function RestaurantOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [visible, setVisible] = useState(PAGE);

  // Reset pagination whenever the filter or search changes.
  useEffect(() => { setVisible(PAGE); }, [filter, query]);

  // New-order alerting (buzzer + full-screen popup) is handled APP-WIDE by
  // OrderAlertCenter in the (restaurant) layout — this screen only shows the list.
  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getAll();
      setOrders(res.data || []);
    } catch (err) {
      if (__DEV__) console.warn('Restaurant orders fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Poll only while the screen is focused (saves battery)
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const id = setInterval(fetchOrders, 15000);
      return () => clearInterval(id);
    }, [fetchOrders]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleOrderAction = async (orderId: string, newStatus: string) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      fetchOrders();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update order');
    }
  };

  const pending = orders.filter(o => o.status === 'pending');
  const filterDef = FILTERS.find(f => f.key === filter) || FILTERS[0];
  const filtered = orders.filter(o => filterDef.match(o) && matchesQuery(o, query));
  const paged = filtered.slice(0, visible);

  const Hero = (
    <LinearGradient
      colors={gradients.hero as any}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.hero, { paddingTop: insets.top + space.md }]}
    >
      <View style={s.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroKicker}>MANAGE</Text>
          <Text style={s.heroTitle}>Orders</Text>
        </View>
        {pending.length > 0 && (
          <LinearGradient colors={gradients.gold as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.newPill}>
            <Ionicons name="notifications" size={13} color="#3a2d05" />
            <Text style={s.newPillText}>{pending.length} new</Text>
          </LinearGradient>
        )}
      </View>

      {/* Glass search inside the hero */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.75)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by order, customer or item"
          placeholderTextColor="rgba(255,255,255,0.55)"
          style={s.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        {Hero}
        <View style={{ padding: space.lg }}>
          <OrderListSkeleton count={4} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {Hero}

      {/* Status filter chips with live counts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
        {FILTERS.map((f) => {
          const count = orders.filter((o) => f.match(o)).length;
          const on = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
              style={[
                s.chip,
                { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border },
                !on && elevation(1),
              ]}
            >
              <Text style={[s.chipText, { color: on ? '#fff' : colors.textSecondary }]}>{f.label}</Text>
              {count > 0 && (
                <View style={[s.chipBadge, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.primary + '14' }]}>
                  <Text style={[s.chipBadgeText, { color: on ? '#fff' : colors.primary }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={paged}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <OrderTrackingCard
            order={item}
            onAction={(action) => handleOrderAction(item.id, action)}
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (visible < filtered.length) setVisible((v) => v + PAGE); }}
        ListHeaderComponent={
          pending.length > 0 && filter === 'all' && !query ? (
            <View style={[s.alertBanner, { backgroundColor: colors.warning + '1c', borderColor: colors.warning + '55' }]}>
              <Ionicons name="notifications" size={20} color={colors.warning} />
              <Text style={[s.alertText, { color: colors.warning }]}>
                {pending.length} new order{pending.length > 1 ? 's' : ''} waiting — accept before they expire
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          filtered.length > paged.length
            ? <Text style={[typography.caption as any, s.footerText, { color: colors.textMuted }]}>Showing {paged.length} of {filtered.length}</Text>
            : null
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <View style={[s.emptyIconWrap, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name={query || filter !== 'all' ? 'funnel-outline' : 'restaurant-outline'} size={40} color={colors.primary} />
            </View>
            <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.lg }]}>
              {query || filter !== 'all' ? 'No matching orders' : 'No orders yet'}
            </Text>
            <Text style={[typography.caption as any, s.emptySubtext, { color: colors.textSecondary }]}>
              {query || filter !== 'all'
                ? 'Try a different filter or search term'
                : 'Orders from nearby customers will appear here the moment they’re placed'}
            </Text>
            {(query || filter !== 'all') ? (
              <TouchableOpacity
                onPress={() => { setQuery(''); setFilter('all'); }}
                style={[s.clearBtn, { borderColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Text style={[typography.bodyStrong as any, { color: colors.primary }]}>Clear filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  hero: {
    paddingHorizontal: space.lg, paddingBottom: space.lg,
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroKicker: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },
  newPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
  },
  newPillText: { color: '#3a2d05', fontSize: 12.5, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.lg, paddingHorizontal: space.md, height: 44,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  searchInput: { flex: 1, fontSize: 14.5, color: '#fff', padding: 0, fontWeight: '500' },
  // flexGrow:0 pins the horizontal chips strip to its content height. Without
  // it the ScrollView flex-grabs leftover vertical space in the column layout,
  // and the stretch-aligned chips balloon into giant pills (or get clipped when
  // space is tight) depending on how long the list below is.
  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.md, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md, height: 36, justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 1,
  },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  chipBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  chipBadgeText: { fontSize: 11, fontWeight: '800' },
  footerText: { textAlign: 'center', paddingVertical: space.md },
  list: { paddingHorizontal: space.lg, paddingBottom: 110 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space.xxxl * 2, paddingHorizontal: space.xl },
  emptyIconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  emptySubtext: { marginTop: space.xs, textAlign: 'center' },
  clearBtn: {
    marginTop: space.lg, paddingHorizontal: space.xl, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1.5,
  },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    padding: space.md, borderRadius: radius.md, borderWidth: 1, marginBottom: space.md,
  },
  alertText: { fontSize: 14, fontWeight: '700', flex: 1 },
});

/** Wraps OrderCard + live TrackingMap for out_for_delivery orders. */
function OrderTrackingCard({ order, onAction }: { order: any; onAction: (a: string) => void }) {
  const inDelivery = order.status === 'out_for_delivery';
  const tracking = useTrackingSocket(inDelivery ? order.id : null, inDelivery);
  return (
    <View>
      <OrderCard order={order} userRole="kirana" onAction={onAction} />
      {/* Lifecycle timeline — where this order is right now, with a live
          kitchen timer while it's being prepared. */}
      <OrderStatusStrip order={order} />
      {order.has_audio_note && (
        <View style={{ paddingHorizontal: space.md, marginTop: 8 }}>
          <AudioNotePlayer orderId={order.id} hasNote durationSec={order.audio_note?.duration} />
        </View>
      )}
      {inDelivery && order.kirana_location?.lat != null && order.delivery_location?.lat != null && (
        <View style={{ paddingHorizontal: space.md, marginTop: -space.sm, marginBottom: space.sm }}>
          <TrackingMap
            storeLat={order.kirana_location.lat}
            storeLng={order.kirana_location.lng}
            destLat={order.delivery_location.lat}
            destLng={order.delivery_location.lng}
            riderLat={tracking.riderLat ?? order.rider_location?.lat}
            riderLng={tracking.riderLng ?? order.rider_location?.lng}
            etaMinutes={tracking.etaMinutes}
            height={180}
          />
        </View>
      )}
    </View>
  );
}

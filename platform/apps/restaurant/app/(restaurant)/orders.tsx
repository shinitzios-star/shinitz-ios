import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '../../src/constants/theme';
import { OrderCard } from '../../src/components/OrderCard';
import { OrderListSkeleton } from '../../src/components/SkeletonLoader';
import { IncomingOrderAlert } from '../../src/components/IncomingOrderAlert';
import { useOrderAlert } from '../../src/hooks/useOrderAlert';
import { ordersAPI } from '../../src/services/api';
import { TrackingMap } from '../../src/components/TrackingMap';
import { useTrackingSocket } from '../../src/hooks/useTrackingSocket';

/**
 * Restaurant orders screen — mirrors the kirana flow.
 * Backend `/orders` now returns pending+accepted orders for restaurant role.
 * Restaurant valid_transitions: pending → accepted → preparing → ready_for_pickup
 */
export default function RestaurantOrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { activeOrder, isAlerting, checkForNewOrders, stopAlert } = useOrderAlert<any>(
    (o) => o.id,
    (o) => o.status === 'pending',
  );

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getAll();
      const list: any[] = res.data || [];
      checkForNewOrders(list);
      setOrders(list);
    } catch (err) {
      if (__DEV__) console.warn('Restaurant orders fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkForNewOrders]);

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

  const acceptFromAlert = async () => {
    const id = activeOrder?.id;
    stopAlert();
    if (id) await handleOrderAction(id, 'accepted');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Orders</Text></View>
        <View style={{ padding: SPACING.md }}>
          <OrderListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  const pending = orders.filter(o => o.status === 'pending');
  const active = orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        {pending.length > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pending.length} New</Text>
          </View>
        )}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => (
          <OrderTrackingCard
            order={item}
            onAction={(action) => handleOrderAction(item.id, action)}
          />
        )}
        ListHeaderComponent={
          pending.length > 0 ? (
            <View style={styles.alertBanner}>
              <Ionicons name="notifications" size={20} color={COLORS.warning} />
              <Text style={styles.alertText}>
                {pending.length} new order{pending.length > 1 ? 's' : ''} waiting!
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>
              Orders from nearby customers will appear here
            </Text>
          </View>
        }
      />

      <IncomingOrderAlert
        order={activeOrder}
        visible={isAlerting}
        acceptLabel="Accept Order"
        onAccept={acceptFromAlert}
        onReject={stopAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text },
  pendingBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  pendingBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: '#ffffff' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center', paddingHorizontal: SPACING.lg },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  alertText: { fontSize: FONTS.sizes.md, color: COLORS.warning, fontWeight: '600', flex: 1 },
});

/** Wraps OrderCard + live TrackingMap for out_for_delivery orders. */
function OrderTrackingCard({ order, onAction }: { order: any; onAction: (a: string) => void }) {
  const inDelivery = order.status === 'out_for_delivery';
  const tracking = useTrackingSocket(inDelivery ? order.id : null, inDelivery);
  return (
    <View>
      <OrderCard order={order} userRole="kirana" onAction={onAction} />
      {inDelivery && order.kirana_location?.lat != null && order.delivery_location?.lat != null && (
        <View style={{ paddingHorizontal: SPACING.md, marginTop: -SPACING.sm, marginBottom: SPACING.sm }}>
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

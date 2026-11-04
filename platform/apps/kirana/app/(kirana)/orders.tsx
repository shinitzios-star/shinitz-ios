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
import { TrackingMap } from '../../src/components/TrackingMap';
import { useTrackingSocket } from '../../src/hooks/useTrackingSocket';
import { OrderListSkeleton } from '../../src/components/SkeletonLoader';
import { IncomingOrderAlert } from '../../src/components/IncomingOrderAlert';
import { useOrderAlert } from '../../src/hooks/useOrderAlert';
import { ordersAPI } from '../../src/services/api';

export default function KiranaOrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Loud alert when a NEW pending order arrives (buzzer + full-screen popup)
  const { activeOrder, isAlerting, checkForNewOrders, stopAlert } = useOrderAlert<any>(
    (o) => o.id,
    (o) => o.status === 'pending',
  );

  const fetchOrders = useCallback(async () => {
    try {
      const response = await ordersAPI.getAll();
      const newOrders: any[] = response.data || [];
      checkForNewOrders(newOrders);   // triggers buzzer + popup on new pending orders
      setOrders(newOrders);
    } catch (error) {
      if (__DEV__) console.warn('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkForNewOrders]);

  // Only poll while screen is focused — saves battery + network when user is elsewhere
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const interval = setInterval(fetchOrders, 15000);
      return () => clearInterval(interval);
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
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update order');
    }
  };

  // Accept straight from the full-screen alert
  const acceptFromAlert = async () => {
    const id = activeOrder?.id;
    stopAlert();
    if (id) await handleOrderAction(id, 'accepted');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orders</Text>
        </View>
        <View style={{ padding: SPACING.md }}>
          <OrderListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.badgeRow}>
          {pendingOrders.length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingOrders.length} New</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => (
          <KiranaOrderTrackingCard
            order={item}
            onAction={(action) => handleOrderAction(item.id, action)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>New orders from nearby customers will appear here</Text>
          </View>
        }
        ListHeaderComponent={
          pendingOrders.length > 0 ? (
            <View style={styles.alertBanner}>
              <Ionicons name="notifications" size={20} color={COLORS.warning} />
              <Text style={styles.alertText}>
                You have {pendingOrders.length} new order{pendingOrders.length > 1 ? 's' : ''} waiting!
              </Text>
            </View>
          ) : null
        }
      />

      {/* Loud full-screen alert + buzzer when a new order arrives */}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  pendingBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  alertText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.warning,
    fontWeight: '600',
    flex: 1,
  },
});

function KiranaOrderTrackingCard({ order, onAction }: { order: any; onAction: (a: string) => void }) {
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

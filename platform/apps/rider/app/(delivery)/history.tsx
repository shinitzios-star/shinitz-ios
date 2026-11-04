import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { OrderListSkeleton } from '../../src/components/SkeletonLoader';
import api from '../../src/services/api';

// Flat payout per completed delivery (matches the rider earnings model).
const PER_DELIVERY = 30;

export default function DeliveryHistoryScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/delivery/history');
      setOrders(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const { deliveredCount, earned } = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    return { deliveredCount: delivered.length, earned: delivered.length * PER_DELIVERY };
  }, [orders]);

  const getStatusColor = (status: string) => {
    if (status === 'delivered') return COLORS.success;
    if (status === 'cancelled') return COLORS.error;
    return COLORS.textSecondary;
  };

  const fmtDate = (d?: string) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride History</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{orders.length}</Text></View>
      </View>

      {loading ? (
        <View style={{ padding: SPACING.md }}><OrderListSkeleton count={5} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            orders.length > 0 ? (
              <View style={styles.summary}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryValue}>{deliveredCount}</Text>
                  <Text style={styles.summaryLabel}>Delivered</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryValue, { color: COLORS.success }]}>₹{earned}</Text>
                  <Text style={styles.summaryLabel}>Total earned</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.idRow}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                  <Text style={styles.orderId}>#{item.id?.slice(-8)?.toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status?.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.infoText} numberOfLines={1}>{item.delivery_address || 'No address'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cart-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.infoText}>
                    {item.items?.length || 0} items{item.created_at ? ` · ${fmtDate(item.created_at)}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.amount}>Order ₹{item.total_amount || 0}</Text>
                {item.status === 'delivered' && <Text style={styles.earning}>+₹{PER_DELIVERY} earned</Text>}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="time-outline" size={48} color={COLORS.primary} /></View>
              <Text style={styles.emptyText}>No delivery history yet</Text>
              <Text style={styles.emptySubtext}>Complete deliveries to see your history</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  countBadge: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  countText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  summary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: COLORS.text },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  summaryDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  orderId: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBody: { marginTop: SPACING.sm, gap: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  amount: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  earning: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.success },
  empty: { justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.xs },
  emptySubtext: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: SPACING.xs },
});

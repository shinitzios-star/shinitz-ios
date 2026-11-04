// SHINITZ Rider — Ride History. Restyled to the design system; data/logic
// (fetch, delivered count + earnings, status colours, skeleton, empty) preserved.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation } from '../../src/constants/designSystem';
import { Card } from '../../src/components/ui';
import { OrderListSkeleton } from '../../src/components/SkeletonLoader';
import api from '../../src/services/api';

const PER_DELIVERY = 30;

export default function DeliveryHistoryScreen() {
  const { colors } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/delivery/history');
      setOrders(res.data);
    } catch (e) { if (__DEV__) console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const { deliveredCount, earned } = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    return { deliveredCount: delivered.length, earned: delivered.length * PER_DELIVERY };
  }, [orders]);

  const statusColor = (status: string) =>
    status === 'delivered' ? colors.success : status === 'cancelled' ? colors.error : colors.textSecondary;

  const fmtDate = (d?: string) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; }
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={[typography.h1 as any, { color: colors.text }]}>Ride History</Text>
        <View style={s.countBadge}><Text style={s.countText}>{orders.length}</Text></View>
      </View>

      {loading ? (
        <View style={{ padding: space.lg }}><OrderListSkeleton count={5} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor={colors.primary} />}
          ListHeaderComponent={orders.length > 0 ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
              <View style={s.summaryCol}>
                <Text style={[typography.h1 as any, { color: colors.text }]}>{deliveredCount}</Text>
                <Text style={[typography.caption as any, { color: colors.textSecondary }]}>Delivered</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.summaryCol}>
                <Text style={[typography.h1 as any, { color: colors.success }]}>₹{earned}</Text>
                <Text style={[typography.caption as any, { color: colors.textSecondary }]}>Total earned</Text>
              </View>
            </Card>
          ) : null}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: space.sm }}>
              <View style={s.rowBetween}>
                <View style={s.idRow}>
                  <View style={[s.dot, { backgroundColor: statusColor(item.status) }]} />
                  <Text style={[typography.bodyStrong as any, { color: colors.text }]}>#{item.id?.slice(-8)?.toUpperCase()}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[s.statusText, { color: statusColor(item.status) }]}>{item.status?.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <View style={{ marginTop: space.sm, gap: 4 }}>
                <View style={s.infoRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={[typography.caption as any, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>{item.delivery_address || 'No address'}</Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="cart-outline" size={14} color={colors.textSecondary} />
                  <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
                    {item.items?.length || 0} items{item.created_at ? ` · ${fmtDate(item.created_at)}` : ''}
                  </Text>
                </View>
              </View>
              <View style={[s.footer, { borderTopColor: colors.border }]}>
                <Text style={[typography.bodyStrong as any, { color: colors.text }]}>Order ₹{item.total_amount || 0}</Text>
                {item.status === 'delivered' && <Text style={[typography.bodyStrong as any, { color: colors.success }]}>+₹{PER_DELIVERY} earned</Text>}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: colors.accentLight }]}><Ionicons name="time-outline" size={44} color={colors.primaryDark} /></View>
              <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.md }]}>No delivery history yet</Text>
              <Text style={[typography.body as any, { color: colors.textSecondary, marginTop: 4 }]}>Complete deliveries to see your history</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  countBadge: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  countText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 36 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { justifyContent: 'center', alignItems: 'center', paddingVertical: space.xxxl * 1.5 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { useAuthStore } from '../../src/store/authStore';
import { adminAPI } from '../../src/services/api';
import { useExitOnBack } from '../../src/hooks/useExitOnBack';

export default function AdminDashboard() {
  useExitOnBack();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.allSettled([
        adminAPI.getStats(),
        adminAPI.getAnalytics(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const maxRevenue = analytics?.daily_revenue?.length
    ? Math.max(...analytics.daily_revenue.map((d: any) => d.revenue), 1)
    : 1;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Admin Panel</Text>
            <Text style={styles.adminName}>{user?.name || 'Admin'}</Text>
          </View>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        </View>

        {/* Revenue Summary Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View>
              <Text style={styles.revenueLabel}>Revenue (7 Days)</Text>
              <Text style={styles.revenueAmount}>
                {'\u20b9'}{analytics?.total_revenue_7d?.toLocaleString() || '0'}
              </Text>
            </View>
            <View style={styles.revenueIcon}>
              <Ionicons name="trending-up" size={32} color={COLORS.success} />
            </View>
          </View>
          <View style={styles.revenueStats}>
            <View style={styles.revenueStat}>
              <Text style={styles.revenueStatValue}>{analytics?.total_orders_7d || 0}</Text>
              <Text style={styles.revenueStatLabel}>Orders</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueStat}>
              <Text style={styles.revenueStatValue}>{analytics?.new_users_7d || 0}</Text>
              <Text style={styles.revenueStatLabel}>New Users</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueStat}>
              <Text style={styles.revenueStatValue}>{analytics?.total_users || 0}</Text>
              <Text style={styles.revenueStatLabel}>Total Users</Text>
            </View>
          </View>
        </View>

        {/* Revenue Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Daily Revenue</Text>
          <View style={styles.chart}>
            {analytics?.daily_revenue?.map((d: any, idx: number) => {
              const date = new Date(d.date);
              const dayLabel = date.toLocaleDateString('en', { weekday: 'short' });
              return (
                <View key={idx} style={styles.barGroup}>
                  <Text style={styles.barValue}>
                    {d.orders > 0 ? `${'\u20b9'}${d.revenue}` : ''}
                  </Text>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max((d.revenue / maxRevenue) * 100, 4),
                          backgroundColor: d.revenue > 0 ? COLORS.primary : COLORS.surface,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barDate}>{dayLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Users Stats */}
        <Text style={styles.sectionTitle}>Users Overview</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="people" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats?.users?.total || 0}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="person" size={28} color={COLORS.info} />
            <Text style={styles.statValue}>{stats?.users?.consumers || 0}</Text>
            <Text style={styles.statLabel}>Consumers</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="storefront" size={28} color={COLORS.success} />
            <Text style={styles.statValue}>{stats?.users?.kiranas || 0}</Text>
            <Text style={styles.statLabel}>Kiranas</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="bicycle" size={28} color={COLORS.warning} />
            <Text style={styles.statValue}>{stats?.users?.delivery || 0}</Text>
            <Text style={styles.statLabel}>Delivery</Text>
          </Card>
        </View>

        {/* Orders Overview */}
        <Text style={styles.sectionTitle}>Orders Overview</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="receipt" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{analytics?.order_stats?.total || stats?.orders?.total || 0}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="time" size={28} color={COLORS.warning} />
            <Text style={styles.statValue}>{analytics?.order_stats?.pending || stats?.orders?.pending || 0}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
            <Text style={styles.statValue}>{analytics?.order_stats?.delivered || stats?.orders?.completed || 0}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="close-circle" size={28} color={COLORS.error} />
            <Text style={styles.statValue}>{analytics?.order_stats?.cancelled || 0}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </Card>
        </View>

        {/* Top Stores */}
        {analytics?.top_stores?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Stores (7 Days)</Text>
            <View style={styles.topStoresCard}>
              {analytics.top_stores.map((store: any, idx: number) => (
                <View key={idx} style={styles.storeRow}>
                  <View style={styles.storeRank}>
                    <Text style={styles.storeRankText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{store.name || 'Unknown Store'}</Text>
                    <Text style={styles.storeOrders}>{store.orders} orders</Text>
                  </View>
                  <Text style={styles.storeRevenue}>{'\u20b9'}{store.revenue}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  adminName: { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  adminBadgeText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },

  // Revenue Card
  revenueCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: SPACING.md,
  },
  revenueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  revenueAmount: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  revenueIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  revenueStat: { alignItems: 'center' },
  revenueStatValue: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  revenueStatLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  revenueDivider: { width: 1, backgroundColor: COLORS.border, height: '100%' },

  // Chart
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: SPACING.md,
  },
  barGroup: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 9, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '700' },
  barContainer: { width: '65%', justifyContent: 'flex-end', height: 100 },
  bar: { width: '100%', borderRadius: RADIUS.sm, minHeight: 4 },
  barDate: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' },

  // General
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: { width: '48%', alignItems: 'center', paddingVertical: SPACING.md },
  statValue: { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm },
  statLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },

  // Top Stores
  topStoresCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  storeRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  storeRankText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary },
  storeInfo: { flex: 1 },
  storeName: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text },
  storeOrders: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 1 },
  storeRevenue: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.success },
});

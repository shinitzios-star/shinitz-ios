import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import api from '../../src/services/api';

export default function AnalyticsScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get('/kirana/analytics');
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const maxRevenue = data?.daily_revenue?.length
    ? Math.max(...data.daily_revenue.map((d: any) => d.revenue), 1)
    : 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnalytics(); }} tintColor={COLORS.primary} />}
      >
        <Text style={styles.title}>Sales Analytics</Text>
        <Text style={styles.subtitle}>Last 7 days</Text>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="cash" size={24} color={COLORS.success} />
            <Text style={styles.summaryValue}>₹{data?.total_revenue_7d || 0}</Text>
            <Text style={styles.summaryLabel}>Revenue</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="receipt" size={24} color={COLORS.primary} />
            <Text style={styles.summaryValue}>{data?.total_orders_7d || 0}</Text>
            <Text style={styles.summaryLabel}>Orders</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-up" size={24} color={COLORS.info} />
            <Text style={styles.summaryValue}>₹{data?.avg_order_value || 0}</Text>
            <Text style={styles.summaryLabel}>Avg Order</Text>
          </View>
        </View>

        {/* Revenue Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Daily Revenue</Text>
          <View style={styles.chart}>
            {data?.daily_revenue?.map((d: any, idx: number) => (
              <View key={idx} style={styles.barGroup}>
                <Text style={styles.barValue}>{d.revenue > 0 ? `₹${d.revenue}` : ''}</Text>
                <View style={styles.barContainer}>
                  <View style={[
                    styles.bar,
                    {
                      height: Math.max((d.revenue / maxRevenue) * 120, 4),
                      backgroundColor: d.revenue > 0 ? COLORS.primary : COLORS.surface,
                    }
                  ]} />
                </View>
                <Text style={styles.barDate}>{d.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Products */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          {data?.top_products?.length > 0 ? (
            data.top_products.map((p: any, idx: number) => (
              <View key={idx} style={styles.topProduct}>
                <View style={styles.rankCircle}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <Text style={styles.topProductName} numberOfLines={1}>{p.name}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{p.count} sold</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noData}>No sales data yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  summaryValue: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xs },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  chartCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 170, paddingTop: SPACING.md },
  barGroup: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 9, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '600' },
  barContainer: { width: '70%', justifyContent: 'flex-end', height: 120 },
  bar: { width: '100%', borderRadius: RADIUS.sm, minHeight: 4 },
  barDate: { fontSize: 9, color: COLORS.textMuted, marginTop: 4 },
  topProduct: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.primary },
  topProductName: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: '500' },
  countBadge: { backgroundColor: COLORS.success + '20', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  countText: { fontSize: FONTS.sizes.xs, color: COLORS.success, fontWeight: '700' },
  noData: { fontSize: FONTS.sizes.md, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.lg },
});

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import api from '../../src/services/api';

export default function EarningsScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await api.get('/delivery/earnings');
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Refetch every time the tab regains focus so "Today's Earnings" reflects
  // deliveries the rider just completed — no stale/static numbers.
  useFocusEffect(useCallback(() => { fetchEarnings(); }, [fetchEarnings]));

  const maxEarnings = data?.daily_breakdown?.length
    ? Math.max(...data.daily_breakdown.map((d: any) => d.earnings), 1)
    : 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEarnings(); }} tintColor={COLORS.primary} />}
      >
        <Text style={styles.title}>Earnings</Text>

        {/* Wallet CTA */}
        <TouchableOpacity style={styles.walletCta} onPress={() => router.push('/(delivery)/wallet' as any)} activeOpacity={0.85}>
          <Ionicons name="wallet" size={20} color={COLORS.primary} />
          <Text style={styles.walletCtaText}>Wallet · ₹{(data?.wallet?.available ?? 0).toFixed(2)} available</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Today Card */}
        <View style={styles.todayCard}>
          <View style={styles.todayLeft}>
            <Text style={styles.todayLabel}>Today's Earnings</Text>
            <Text style={styles.todayAmount}>₹{data?.today_earnings || 0}</Text>
            <Text style={styles.todayDeliveries}>{data?.today_deliveries || 0} deliveries</Text>
          </View>
          <View style={styles.todayIcon}>
            <Ionicons name="wallet" size={40} color={COLORS.primary} />
          </View>
        </View>

        {/* Daily Incentive Card */}
        <View style={styles.incentiveCard}>
          <View style={styles.incentiveHeader}>
            <Ionicons name="rocket" size={20} color={COLORS.warning} />
            <Text style={styles.incentiveTitle}>Daily Incentive</Text>
            {data?.bonus_earned ? (
              <View style={styles.bonusBadge}>
                <Text style={styles.bonusBadgeText}>+₹{data?.incentive_net}</Text>
              </View>
            ) : null}
          </View>

          {!data?.incentive_eligible ? (
            <Text style={styles.incentiveSub}>Complete your first delivery to unlock incentives.</Text>
          ) : data?.bonus_earned ? (
            <Text style={styles.incentiveSub}>
              🎉 You hit {data?.incentive_threshold} deliveries today and earned a ₹{data?.incentive_gross} bonus!
            </Text>
          ) : (
            <Text style={styles.incentiveSub}>
              Complete {data?.orders_to_bonus} more {data?.orders_to_bonus === 1 ? 'order' : 'orders'} today to earn a ₹{data?.incentive_bonus_amount} bonus.
            </Text>
          )}

          {data?.incentive_eligible ? (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, ((data?.today_deliveries || 0) / (data?.incentive_threshold || 5)) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {data?.today_deliveries || 0}/{data?.incentive_threshold || 5} deliveries today
              </Text>
            </>
          ) : null}

          {data?.incentive_penalty > 0 ? (
            <View style={styles.penaltyRow}>
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
              <Text style={styles.penaltyText}>
                −₹{data?.incentive_penalty} penalty from a cancelled order will reduce your next bonus.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="calendar" size={20} color={COLORS.info} />
            <Text style={styles.summaryValue}>₹{data?.week_earnings || 0}</Text>
            <Text style={styles.summaryLabel}>This Week</Text>
            <Text style={styles.summaryDeliveries}>{data?.week_deliveries || 0}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="calendar-clear" size={20} color={COLORS.warning} />
            <Text style={styles.summaryValue}>₹{data?.month_earnings || 0}</Text>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={styles.summaryDeliveries}>{data?.month_deliveries || 0}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-up" size={20} color={COLORS.success} />
            <Text style={styles.summaryValue}>₹{data?.total_earnings || 0}</Text>
            <Text style={styles.summaryLabel}>All Time</Text>
            <Text style={styles.summaryDeliveries}>{data?.total_deliveries || 0}</Text>
          </View>
        </View>

        {/* Bonus tiers (weekly / monthly) */}
        {Array.isArray(data?.incentive_tiers) && data.incentive_tiers.filter((t: any) => t.period !== 'daily').length > 0 && (
          <View style={styles.tiersCard}>
            <Text style={styles.tiersTitle}>Bonus tiers</Text>
            {data.incentive_tiers.filter((t: any) => t.period !== 'daily').map((t: any) => (
              <View key={t.period} style={styles.tierRow}>
                <Ionicons name={t.achieved ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={t.achieved ? COLORS.success : COLORS.textMuted} />
                <Text style={styles.tierText}>
                  <Text style={{ textTransform: 'capitalize' }}>{t.period}</Text>: {t.threshold} orders → ₹{t.amount}
                </Text>
                <Text style={styles.tierProgress}>{Math.min(t.progress, t.threshold)}/{t.threshold}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rate Info */}
        <View style={styles.rateCard}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.rateText}>You earn <Text style={styles.rateBold}>₹{data?.per_delivery_rate || 30}</Text> per delivery</Text>
        </View>

        {/* Daily Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.chart}>
            {data?.daily_breakdown?.map((d: any, idx: number) => (
              <View key={idx} style={styles.barGroup}>
                <Text style={styles.barValue}>{d.deliveries > 0 ? d.deliveries : ''}</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { height: Math.max((d.earnings / maxEarnings) * 100, 4), backgroundColor: d.earnings > 0 ? COLORS.success : COLORS.surface }]} />
                </View>
                <Text style={styles.barDate}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  walletCta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.primary + '40', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  walletCtaText: { flex: 1, color: COLORS.text, fontWeight: '700', fontSize: FONTS.sizes.sm },
  todayCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.primary, marginBottom: SPACING.md },
  todayLeft: {},
  todayLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  todayAmount: { fontSize: 36, fontWeight: '800', color: COLORS.primary, marginVertical: 4 },
  todayDeliveries: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  todayIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' },
  incentiveCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.warning + '40', marginBottom: SPACING.md },
  incentiveHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  incentiveTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text, flex: 1 },
  bonusBadge: { backgroundColor: COLORS.success + '20', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  bonusBadgeText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.success },
  incentiveSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 18 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.surface, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.warning },
  progressLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' },
  penaltyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm, backgroundColor: COLORS.error + '12', padding: SPACING.sm, borderRadius: RADIUS.sm },
  penaltyText: { fontSize: FONTS.sizes.xs, color: COLORS.error, flex: 1, lineHeight: 16 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tiersCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  tiersTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 5 },
  tierText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  tierProgress: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  summaryValue: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xs },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  summaryDeliveries: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  rateCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary + '10', padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.md },
  rateText: { fontSize: FONTS.sizes.sm, color: COLORS.text },
  rateBold: { fontWeight: '800', color: COLORS.primary },
  chartCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingTop: SPACING.md },
  barGroup: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '700' },
  barContainer: { width: '65%', justifyContent: 'flex-end', height: 100 },
  bar: { width: '100%', borderRadius: RADIUS.sm, minHeight: 4 },
  barDate: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' },
});

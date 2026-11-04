// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Rider — Earnings. Restyled to the SHINITZ design system (green/gold
// hero + cards) with ALL existing data/logic preserved: wallet, today, daily
// incentive (eligibility / bonus / penalty), week·month·all-time, bonus tiers,
// per-delivery rate and the 7-day chart. Still refetches on focus.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { Card, SectionTitle } from '../../src/components/ui';
import api from '../../src/services/api';

export default function EarningsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await api.get('/delivery/earnings');
      setData(res.data);
    } catch (e) { if (__DEV__) console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchEarnings(); }, [fetchEarnings]));

  const maxEarnings = data?.daily_breakdown?.length
    ? Math.max(...data.daily_breakdown.map((d: any) => d.earnings), 1)
    : 1;

  const s = makeStyles(colors);

  if (loading) {
    return <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <View style={s.screen}>
      {/* ── Hero: today's earnings ── */}
      <LinearGradient colors={gradients.heroWarm as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + space.md }]}>
        <Text style={s.heroTitle}>Earnings</Text>
        <Text style={s.heroLabel}>Today's Earnings</Text>
        <Text style={s.heroAmount}>₹{data?.today_earnings || 0}</Text>
        <Text style={s.heroSub}>{data?.today_deliveries || 0} deliveries today</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEarnings(); }} tintColor={colors.primary} />}>

        {/* Wallet CTA */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(delivery)/wallet' as any)} style={{ marginBottom: space.lg }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.iconWrap, { backgroundColor: colors.accentLight }]}><Ionicons name="wallet" size={20} color={colors.primaryDark} /></View>
            <Text style={[typography.bodyStrong as any, { color: colors.text, flex: 1, marginLeft: space.md }]}>
              Wallet · ₹{(data?.wallet?.available ?? 0).toFixed(2)} available
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </TouchableOpacity>

        {/* Daily Incentive */}
        <Card style={{ marginBottom: space.lg, borderColor: colors.accent + '55' }}>
          <View style={s.rowCenter}>
            <MaterialCommunityIcons name="rocket-launch-outline" size={20} color={colors.accentDark} />
            <Text style={[typography.h3 as any, { color: colors.text, flex: 1, marginLeft: space.sm }]}>Daily Incentive</Text>
            {data?.bonus_earned ? (
              <View style={[s.pill, { backgroundColor: colors.success + '22' }]}><Text style={[s.pillText, { color: colors.successDark }]}>+₹{data?.incentive_net}</Text></View>
            ) : null}
          </View>

          <Text style={[typography.caption as any, { color: colors.textSecondary, marginTop: space.sm, marginBottom: space.sm, lineHeight: 18 }]}>
            {!data?.incentive_eligible
              ? 'Complete your first delivery to unlock incentives.'
              : data?.bonus_earned
                ? `🎉 You hit ${data?.incentive_threshold} deliveries today and earned a ₹${data?.incentive_gross} bonus!`
                : `Complete ${data?.orders_to_bonus} more ${data?.orders_to_bonus === 1 ? 'order' : 'orders'} today to earn a ₹${data?.incentive_bonus_amount} bonus.`}
          </Text>

          {data?.incentive_eligible ? (
            <>
              <View style={s.track}>
                <View style={[s.fill, { backgroundColor: colors.accent, width: `${Math.min(100, ((data?.today_deliveries || 0) / (data?.incentive_threshold || 5)) * 100)}%` }]} />
              </View>
              <Text style={[typography.label as any, { color: colors.textMuted, marginTop: 4 }]}>
                {data?.today_deliveries || 0}/{data?.incentive_threshold || 5} deliveries today
              </Text>
            </>
          ) : null}

          {data?.incentive_penalty > 0 ? (
            <View style={[s.penalty, { backgroundColor: colors.error + '12' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[typography.caption as any, { color: colors.error, flex: 1 }]}>
                −₹{data?.incentive_penalty} penalty from a cancelled order will reduce your next bonus.
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Summary: week / month / all-time */}
        <View style={s.summaryRow}>
          <Summary colors={colors} ic="calendar" tint={colors.info} value={data?.week_earnings || 0} label="This Week" sub={data?.week_deliveries || 0} />
          <Summary colors={colors} ic="calendar-clear" tint={colors.warning} value={data?.month_earnings || 0} label="This Month" sub={data?.month_deliveries || 0} />
          <Summary colors={colors} ic="trending-up" tint={colors.success} value={data?.total_earnings || 0} label="All Time" sub={data?.total_deliveries || 0} />
        </View>

        {/* Bonus tiers */}
        {Array.isArray(data?.incentive_tiers) && data.incentive_tiers.filter((t: any) => t.period !== 'daily').length > 0 && (
          <Card style={{ marginTop: space.lg }}>
            <SectionTitle style={{ textAlign: 'left' }}>Bonus Tiers</SectionTitle>
            {data.incentive_tiers.filter((t: any) => t.period !== 'daily').map((t: any) => (
              <View key={t.period} style={s.tierRow}>
                <Ionicons name={t.achieved ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={t.achieved ? colors.success : colors.textMuted} />
                <Text style={[typography.body as any, { color: colors.textSecondary, flex: 1 }]}>
                  <Text style={{ textTransform: 'capitalize', color: colors.text, fontWeight: '700' }}>{t.period}</Text>: {t.threshold} orders → ₹{t.amount}
                </Text>
                <Text style={[typography.label as any, { color: colors.text }]}>{Math.min(t.progress, t.threshold)}/{t.threshold}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Rate */}
        <View style={[s.rate, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[typography.body as any, { color: colors.text }]}>You earn <Text style={{ fontWeight: '800', color: colors.primary }}>₹{data?.per_delivery_rate || 30}</Text> per delivery</Text>
        </View>

        {/* 7-day chart */}
        <Card style={{ marginTop: space.lg }}>
          <SectionTitle style={{ textAlign: 'left' }}>Last 7 Days</SectionTitle>
          <View style={s.chart}>
            {data?.daily_breakdown?.map((d: any, idx: number) => (
              <View key={idx} style={s.barGroup}>
                <Text style={[typography.label as any, { color: colors.textSecondary, marginBottom: 4 }]}>{d.deliveries > 0 ? d.deliveries : ''}</Text>
                <View style={s.barContainer}>
                  <View style={[s.bar, { height: Math.max((d.earnings / maxEarnings) * 100, 4), backgroundColor: d.earnings > 0 ? colors.success : colors.surfaceLight }]} />
                </View>
                <Text style={[typography.label as any, { color: colors.textMuted, marginTop: 4 }]}>{d.day}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function Summary({ colors, ic, tint, value, label, sub }: any) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: space.md, paddingHorizontal: 6 }}>
      <Ionicons name={ic} size={20} color={tint} />
      <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.xs }]}>₹{value}</Text>
      <Text style={[typography.label as any, { color: colors.textSecondary, marginTop: 2 }]}>{label}</Text>
      <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{sub} orders</Text>
    </Card>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: space.lg, paddingBottom: space.xl, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: space.md },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, marginVertical: 2 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  pill: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 13, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  penalty: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, padding: space.sm, borderRadius: radius.sm },
  summaryRow: { flexDirection: 'row', gap: space.sm },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, marginTop: space.lg },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingTop: space.md },
  barGroup: { alignItems: 'center', flex: 1 },
  barContainer: { width: '60%', justifyContent: 'flex-end', height: 100 },
  bar: { width: '100%', borderRadius: radius.sm, minHeight: 4 },
});

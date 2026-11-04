import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { adminAPI } from '../../src/services/api';

const RANGES = [{ label: '7D', value: 7 }, { label: '30D', value: 30 }, { label: '90D', value: 90 }];
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function AdminAnalyticsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [range, setRange] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminAPI.analyticsPro(range)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [range]);

  const t = data?.totals || {};
  const series: any[] = data?.series || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Range */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity key={r.value} onPress={() => setRange(r.value)}
            style={[styles.rangeBtn, range === r.value && { backgroundColor: colors.primary }]}>
            <Text style={[styles.rangeText, { color: range === r.value ? '#fff' : colors.textSecondary }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* KPIs */}
          <View style={styles.kpiGrid}>
            <Kpi styles={styles} label="Revenue" value={inr(t.revenue)} tone={colors.primary} />
            <Kpi styles={styles} label={`Commission (~${data?.commission_pct ?? 0}%)`} value={inr(t.commission)} tone="#D4AF37" />
            <Kpi styles={styles} label="Orders" value={t.orders ?? 0} tone="#3b82f6" />
            <Kpi styles={styles} label="Avg order" value={inr(t.aov)} tone={colors.primary} />
            <Kpi styles={styles} label="Delivered" value={t.delivered ?? 0} tone="#10b981" />
            <Kpi styles={styles} label="Cancelled" value={t.cancelled ?? 0} tone="#ef4444" />
            <Kpi styles={styles} label="New customers" value={t.new_customers ?? 0} tone="#a855f7" />
            <Kpi styles={styles} label="Total customers" value={t.total_customers ?? 0} tone="#14b8a6" />
          </View>

          <ChartCard styles={styles} title="Revenue per day">
            <Bars data={series} valueKey="revenue" color={colors.primary} />
            <AxisHint styles={styles} series={series} fmt={inr} valueKey="revenue" />
          </ChartCard>

          <ChartCard styles={styles} title="Orders per day">
            <Bars data={series} valueKey="orders" color="#3b82f6" />
            <AxisHint styles={styles} series={series} fmt={(n: number) => String(n)} valueKey="orders" />
          </ChartCard>

          <ChartCard styles={styles} title="Order status">
            {(data?.status_breakdown || []).map((s: any, i: number) => (
              <RankRow key={i} styles={styles} label={s.status} value={s.count}
                max={Math.max(1, ...(data.status_breakdown || []).map((x: any) => x.count))} color={colors.primary} suffix="" />
            ))}
          </ChartCard>

          <ChartCard styles={styles} title="Top restaurants by revenue">
            {(data?.top_restaurants || []).length === 0 && <Text style={styles.empty}>No data</Text>}
            {(data?.top_restaurants || []).map((s: any, i: number) => (
              <RankRow key={i} styles={styles} label={s.name} value={s.revenue}
                max={Math.max(1, ...(data.top_restaurants || []).map((x: any) => x.revenue))} color={colors.primary} fmt={inr} />
            ))}
          </ChartCard>

          <ChartCard styles={styles} title="Peak order hours">
            <Bars data={data?.peak_hours || []} valueKey="orders" color="#D4AF37" />
            <View style={styles.hourAxis}>
              <Text style={styles.axisLabel}>0h</Text><Text style={styles.axisLabel}>6h</Text>
              <Text style={styles.axisLabel}>12h</Text><Text style={styles.axisLabel}>18h</Text>
              <Text style={styles.axisLabel}>23h</Text>
            </View>
          </ChartCard>
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Kpi({ styles, label, value, tone }: any) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiDot, { backgroundColor: tone }]} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ChartCard({ styles, title, children }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bars({ data, valueKey, color }: any) {
  const max = Math.max(1, ...data.map((d: any) => Number(d[valueKey]) || 0));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2 }}>
      {data.map((d: any, i: number) => (
        <View key={i} style={{ flex: 1, height: Math.max(2, (Number(d[valueKey]) / max) * 116), backgroundColor: color, borderRadius: 2, opacity: 0.9 }} />
      ))}
    </View>
  );
}

function AxisHint({ styles, series, fmt, valueKey }: any) {
  if (!series.length) return null;
  const max = Math.max(...series.map((s: any) => Number(s[valueKey]) || 0));
  return (
    <View style={styles.axisRow}>
      <Text style={styles.axisLabel}>{series[0]?.date?.slice(5)}</Text>
      <Text style={styles.axisLabel}>peak {fmt(max)}</Text>
      <Text style={styles.axisLabel}>{series[series.length - 1]?.date?.slice(5)}</Text>
    </View>
  );
}

function RankRow({ styles, label, value, max, color, fmt, suffix }: any) {
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.rankBarTrack}>
        <View style={[styles.rankBarFill, { width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.rankValue}>{fmt ? fmt(value) : value}{suffix ?? ''}</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  rangeRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  rangeBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rangeText: { fontSize: FONTS.sizes.sm, fontWeight: '800' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpiCard: { width: '47.5%', backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border },
  kpiDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  kpiValue: { fontSize: FONTS.sizes.xl, fontWeight: '900', color: colors.text },
  kpiLabel: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border, marginTop: SPACING.md },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text, marginBottom: SPACING.md },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  hourAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 10, color: colors.textMuted },
  empty: { fontSize: FONTS.sizes.sm, color: colors.textMuted, paddingVertical: SPACING.sm },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  rankLabel: { width: 90, fontSize: FONTS.sizes.xs, color: colors.text },
  rankBarTrack: { flex: 1, height: 10, backgroundColor: colors.surface, borderRadius: 5, overflow: 'hidden' },
  rankBarFill: { height: 10, borderRadius: 5 },
  rankValue: { width: 70, textAlign: 'right', fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.text },
});

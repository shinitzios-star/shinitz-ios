// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Restaurant — Earnings & Payouts (premium merchant redesign, pass 2).
// Data wiring untouched (payoutAPI summary/incentives/earnings/history,
// setCycle, requestPayout). New on top: green→gold gradient hero, icon-chip
// balance cards, a 7-day net-earnings chart aggregated from the existing
// ledger, gold settle button, themed lists — full dark-mode support.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { Card } from '../../src/components/ui';
import { payoutAPI } from '../../src/services/api';

const inr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function PayoutsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [summary, setSummary] = useState<any>(null);
  const [incentive, setIncentive] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [savingCycle, setSavingCycle] = useState(false);

  const STATUS: Record<string, { fg: string; label: string }> = {
    pending: { fg: colors.warning, label: 'Pending' },
    processing: { fg: colors.primary, label: 'Processing' },
    settled: { fg: colors.success, label: 'Paid' },
    failed: { fg: colors.error, label: 'Failed' },
  };

  const load = useCallback(async () => {
    setError(false);
    try {
      const [s2, inc, e, h] = await Promise.all([
        payoutAPI.summary(), payoutAPI.incentives(), payoutAPI.earnings(50), payoutAPI.history(),
      ]);
      setSummary(s2.data);
      setIncentive(inc.data);
      setEarnings(e.data || []);
      setHistory(h.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const setCycle = async (cycle: 'daily' | 'weekly') => {
    if (savingCycle || summary?.cycle === cycle) return;
    Haptics.selectionAsync().catch(() => {});
    setSavingCycle(true);
    try {
      const r = await payoutAPI.setCycle(cycle);
      setSummary((s2: any) => ({ ...s2, cycle: r.data.cycle, next_settlement_at: r.data.next_settlement_at }));
    } catch {
      Alert.alert('Error', 'Could not update settlement cycle.');
    } finally {
      setSavingCycle(false);
    }
  };

  const requestPayout = async () => {
    setRequesting(true);
    try {
      await payoutAPI.requestPayout();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Settlement requested', 'Your earnings are queued for payout.');
      load();
    } catch (e: any) {
      Alert.alert('Cannot request', e?.response?.data?.detail || 'Please try again later.');
    } finally {
      setRequesting(false);
    }
  };

  // 7-day net-earnings series aggregated from the per-order ledger.
  const week = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-IN', { weekday: 'narrow' }),
        total: 0,
      });
    }
    for (const o of earnings) {
      const k = o.date ? String(o.date).slice(0, 10) : '';
      const slot = days.find((x) => x.key === k);
      if (slot) slot.total += Number(o.net || 0);
    }
    return days;
  }, [earnings]);
  const weekMax = Math.max(...week.map((d) => d.total), 1);

  const Header = () => (
    <View style={st.header}>
      <TouchableOpacity onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[typography.h3 as any, { color: colors.text }]}>Earnings & Payouts</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[st.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Header />
        <View style={st.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[st.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Header />
        <View style={st.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.md }]}>Couldn't load earnings</Text>
          <TouchableOpacity style={[st.retryBtn, { backgroundColor: colors.primary }]} onPress={() => { setLoading(true); load(); }}>
            <Text style={st.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const s = summary || {};
  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Header />
      <ScrollView
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Total earned — gradient hero */}
        <LinearGradient colors={gradients.hero as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, elevation(2)]}>
          <Text style={st.heroLabel}>TOTAL EARNED · AFTER {Math.round(s.commission_pct || 0)}% COMMISSION</Text>
          <Text style={st.heroValue}>{inr(s.total_earned)}</Text>
          <View style={st.heroFootRow}>
            <Ionicons name="checkmark-done" size={13} color="#efd27a" />
            <Text style={st.heroSub}>{s.lifetime_orders || 0} delivered orders</Text>
          </View>
        </LinearGradient>

        {/* Balance triplet */}
        <View style={st.row}>
          <BalanceCard colors={colors} icon="hourglass-outline" tint={colors.warning}
            label="Pending" value={inr(s.pending)} sub={`${s.pending_orders || 0} orders`} />
          <BalanceCard colors={colors} icon="sync-outline" tint={colors.primary}
            label="Processing" value={inr(s.processing)} />
          <BalanceCard colors={colors} icon="checkmark-circle-outline" tint={colors.success}
            label="Settled" value={inr(s.settled)} />
        </View>

        {/* 7-day earnings chart (gold = best day) */}
        <Card style={{ marginTop: space.md }}>
          <Text style={[typography.bodyStrong as any, { color: colors.text, marginBottom: space.lg }]}>
            Net earnings · last 7 days
          </Text>
          <View style={st.chart}>
            {week.map((d, i) => {
              const h = Math.max(5, (d.total / weekMax) * 88);
              const best = d.total > 0 && d.total === weekMax;
              return (
                <View key={i} style={st.barCol}>
                  {d.total > 0 && (
                    <Text style={[st.barValue, { color: best ? '#D4AF37' : colors.textMuted }]} numberOfLines={1}>
                      {inr(d.total)}
                    </Text>
                  )}
                  <View style={[st.bar, { height: h, backgroundColor: best ? '#D4AF37' : d.total > 0 ? colors.primary : colors.surfaceLight }]} />
                  <Text style={[st.barDay, { color: best ? '#D4AF37' : colors.textMuted, fontWeight: best ? '800' : '500' }]}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Settlement */}
        <Text style={[st.sectionLabel, { color: colors.textMuted }]}>SETTLEMENT</Text>
        <Card>
          <Text style={[typography.bodyStrong as any, { color: colors.text }]}>Settlement cycle</Text>
          <Text style={[typography.caption as any, { color: colors.textSecondary, marginTop: 2 }]}>
            Next settlement {s.next_settlement_at ? `on ${fmtDate(s.next_settlement_at)}` : 'soon'}
          </Text>
          <View style={[st.cycleRow, { backgroundColor: colors.surfaceLight }]}>
            {(['daily', 'weekly'] as const).map((c) => {
              const active = s.cycle === c;
              return (
                <TouchableOpacity key={c} disabled={savingCycle} onPress={() => setCycle(c)}
                  style={[st.cycleBtn, active && { backgroundColor: colors.primary, ...elevation(1) }]}>
                  <Text style={[st.cycleText, { color: active ? '#fff' : colors.textSecondary }]}>
                    {c === 'daily' ? 'Daily' : 'Weekly'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            disabled={!s.can_request || requesting}
            onPress={requestPayout}
            activeOpacity={0.85}
            style={{ marginTop: space.lg }}
          >
            <LinearGradient
              colors={(s.can_request && !requesting ? gradients.gold : [colors.surfaceLight, colors.surfaceLight]) as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={st.requestBtn}
            >
              {requesting
                ? <ActivityIndicator color={colors.text} />
                : <Text style={[st.requestText, { color: s.can_request ? '#3a2d08' : colors.textMuted }]}>
                    {s.can_request ? `Settle now · ${inr(s.pending)}` : `Min. settlement ${inr(s.min_payout)}`}
                  </Text>}
            </LinearGradient>
          </TouchableOpacity>
        </Card>

        {/* Order-streak incentive */}
        {!!incentive && (
          <>
            <Text style={[st.sectionLabel, { color: colors.textMuted }]}>ORDER STREAK BONUS</Text>
            <Card>
              <View style={st.incHead}>
                <View style={[st.trophyChip, { backgroundColor: '#D4AF3720' }]}>
                  <Ionicons name="trophy" size={16} color="#D4AF37" />
                </View>
                <Text style={[typography.bodyStrong as any, { color: colors.text, flex: 1 }]}>
                  +{incentive.pct}% bonus every {incentive.threshold} orders
                </Text>
              </View>
              <View style={[st.progressTrack, { backgroundColor: colors.surfaceLight }]}>
                <LinearGradient colors={gradients.gold as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[st.progressFill, { width: `${Math.min(100, (incentive.progress / incentive.threshold) * 100)}%` }]} />
              </View>
              <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
                {incentive.progress} / {incentive.threshold} delivered · {incentive.remaining} more to your next bonus
              </Text>
              <View style={[st.incStatsRow, { borderTopColor: colors.borderLight }]}>
                <View style={st.incStat}>
                  <Text style={[typography.h3 as any, { color: colors.text }]}>{inr(incentive.total_bonus)}</Text>
                  <Text style={[typography.caption as any, { color: colors.textSecondary }]}>Total bonus earned</Text>
                </View>
                <View style={st.incStat}>
                  <Text style={[typography.h3 as any, { color: '#D4AF37' }]}>{inr(incentive.pending_bonus)}</Text>
                  <Text style={[typography.caption as any, { color: colors.textSecondary }]}>Awaiting payout</Text>
                </View>
              </View>
            </Card>
            {(incentive.history?.length || 0) > 0 && (
              <Card style={{ marginTop: space.md, paddingVertical: 4 }}>
                {incentive.history.slice(0, 5).map((rec: any, i: number) => {
                  const n = Math.min(incentive.history.length, 5);
                  return (
                    <View key={rec.id || i} style={[st.listRow, { borderBottomColor: colors.borderLight }, i === n - 1 && st.lastRow]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.bodyStrong as any, { color: colors.text }]}>
                          +{inr(rec.bonus)} <Text style={{ color: colors.textMuted, fontWeight: '500' }}>bonus</Text>
                        </Text>
                        <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
                          Tier {rec.tier} · {rec.orders} orders · {fmtDate(rec.created_at)}
                        </Text>
                      </View>
                      <StatusPill fg={rec.status === 'paid' ? colors.success : colors.warning}
                        label={rec.status === 'paid' ? 'Paid' : 'Pending'} />
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

        {/* Payout history */}
        <Text style={[st.sectionLabel, { color: colors.textMuted }]}>PAYOUT HISTORY</Text>
        {history.length === 0 ? (
          <Card><EmptyRow colors={colors} icon="document-text-outline" text="No settlements yet" /></Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {history.map((p, i) => {
              const stt = STATUS[p.status] || STATUS.pending;
              return (
                <View key={p.id || i} style={[st.listRow, { borderBottomColor: colors.borderLight }, i === history.length - 1 && st.lastRow]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyStrong as any, { color: colors.text }]}>{inr(p.net)}</Text>
                    <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
                      {p.orders_count || 0} orders · {fmtDate(p.created_at)}
                    </Text>
                  </View>
                  <StatusPill fg={stt.fg} label={stt.label} />
                </View>
              );
            })}
          </Card>
        )}

        {/* Per-order earnings ledger */}
        <Text style={[st.sectionLabel, { color: colors.textMuted }]}>RECENT EARNINGS</Text>
        {earnings.length === 0 ? (
          <Card><EmptyRow colors={colors} icon="receipt-outline" text="No delivered orders yet" /></Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {earnings.map((o, i) => (
              <View key={o.order_id || i} style={[st.listRow, { borderBottomColor: colors.borderLight }, i === earnings.length - 1 && st.lastRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong as any, { color: colors.text }]}>
                    {inr(o.net)} <Text style={{ color: colors.textMuted, fontWeight: '500' }}>net</Text>
                  </Text>
                  <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
                    {fmtDate(o.date)} · {o.items} item{o.items === 1 ? '' : 's'} · {inr(o.gross)} gross
                  </Text>
                </View>
                <StatusPill fg={o.paid ? colors.success : colors.warning} label={o.paid ? 'Paid' : 'Unpaid'} />
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BalanceCard({ colors, icon, tint, label, value, sub }: any) {
  return (
    <Card style={st.balance}>
      <View style={[st.balanceIcon, { backgroundColor: tint + '16' }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <Text style={[st.balanceValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[st.balanceLabel, { color: colors.textSecondary }]}>{label}</Text>
      {sub ? <Text style={[st.balanceSub, { color: colors.textMuted }]}>{sub}</Text> : null}
    </Card>
  );
}

function StatusPill({ fg, label }: { fg: string; label: string }) {
  return (
    <View style={[st.pill, { backgroundColor: fg + '1c' }]}>
      <Text style={[st.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function EmptyRow({ colors, icon, text }: any) {
  return (
    <View style={st.emptyRow}>
      <Ionicons name={icon} size={22} color={colors.textMuted} />
      <Text style={[typography.caption as any, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.sm },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  content: { paddingHorizontal: space.lg },
  hero: {
    borderRadius: radius.xl, padding: space.xl, alignItems: 'center',
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  heroValue: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
  heroFootRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  heroSub: { color: '#efd27a', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  balance: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md },
  balanceIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  balanceValue: { fontSize: 16, fontWeight: '800', marginTop: space.sm },
  balanceLabel: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  balanceSub: { fontSize: 10, marginTop: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 118 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  barValue: { fontSize: 8.5, fontWeight: '700' },
  bar: { width: '48%', borderRadius: 5, minHeight: 5 },
  barDay: { fontSize: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: space.xxl, marginBottom: space.sm },
  cycleRow: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3, marginTop: space.md },
  cycleBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md - 3 },
  cycleText: { fontSize: 13, fontWeight: '800' },
  requestBtn: { borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  requestText: { fontSize: 15, fontWeight: '800' },
  incHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  trophyChip: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: space.sm },
  progressFill: { height: 8, borderRadius: 4 },
  incStatsRow: { flexDirection: 'row', marginTop: space.md, paddingTop: space.md, borderTopWidth: 1 },
  incStat: { flex: 1, gap: 2 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md, borderBottomWidth: 1,
  },
  lastRow: { borderBottomWidth: 0 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  retryBtn: { borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10, marginTop: space.md },
  retryText: { color: '#fff', fontWeight: '800' },
});

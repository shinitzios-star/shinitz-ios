// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Restaurant — Ad Campaigns (premium merchant redesign, pass 3).
// Data wiring untouched (adAPI summary/list/pause/resume/stop, filters,
// navigation to create/detail/wallet). New: gradient KPI hero (spend/orders/
// ROAS), themed mini-stat grid, campaign cards with a budget progress bar,
// haptics, dark mode. STATUS_META export kept — campaign-detail imports it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { adAPI } from '../../src/services/api';

const inr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (n: any) => `${Math.round(Number(n || 0) * 100)}%`;

// Kept as a static export — campaign-detail.tsx imports this shape.
export const STATUS_META: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: COLORS.success + '22', fg: COLORS.success, label: 'Active' },
  scheduled: { bg: COLORS.primary + '22', fg: COLORS.primary, label: 'Scheduled' },
  draft: { bg: COLORS.textMuted + '22', fg: COLORS.textSecondary, label: 'Draft' },
  paused: { bg: COLORS.warning + '22', fg: COLORS.warning, label: 'Paused' },
  completed: { bg: COLORS.textSecondary + '22', fg: COLORS.textSecondary, label: 'Completed' },
  stopped: { bg: COLORS.error + '22', fg: COLORS.error, label: 'Stopped' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'draft', label: 'Draft' },
  { key: 'completed', label: 'Completed' },
];

export default function CampaignsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [summary, setSummary] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [s2, l] = await Promise.all([adAPI.summary(), adAPI.list()]);
      setSummary(s2.data);
      setCampaigns(l.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const act = async (id: string, action: 'pause' | 'resume' | 'stop') => {
    Haptics.selectionAsync().catch(() => {});
    setBusy(id);
    try {
      if (action === 'pause') await adAPI.pause(id);
      else if (action === 'resume') await adAPI.resume(id);
      else await adAPI.stop(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not update the campaign.');
    } finally {
      setBusy(null);
    }
  };

  const confirmStop = (id: string) =>
    Alert.alert('Stop campaign?', 'This ends the campaign and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => act(id, 'stop') },
    ]);

  const Header = () => (
    <View style={s.header}>
      <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[typography.h3 as any, { color: colors.text }]}>Ad Campaigns</Text>
      <View style={s.headerActions}>
        <TouchableOpacity onPress={() => router.push('/(restaurant)/ad-wallet')}
          style={[s.walletBtn, { backgroundColor: colors.primary + '12' }]} hitSlop={6}>
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(restaurant)/campaign-create')}
          style={[s.newBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newText}>New</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Header />
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Header />
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.h3 as any, { color: colors.text }]}>Couldn't load campaigns</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => { setLoading(true); load(); }}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sm = summary || {};
  const shown = filter === 'all'
    ? campaigns
    : campaigns.filter((c) => (filter === 'completed'
        ? ['completed', 'stopped'].includes(c.status)
        : c.status === filter));

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Header />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* KPI hero — the three numbers that justify the ad spend */}
        <LinearGradient colors={gradients.hero as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.kpiHero, elevation(2)]}>
          <Kpi value={inr(sm.total_spend)} label="TOTAL SPEND" />
          <View style={s.kpiDivider} />
          <Kpi value={String(sm.total_orders || 0)} label="ORDERS FROM ADS" />
          <View style={s.kpiDivider} />
          <Kpi value={`${sm.roas || 0}x`} label="ROAS" gold />
        </LinearGradient>

        <View style={s.statsGrid}>
          <Mini colors={colors} icon="eye" tint="#3b82f6" value={String(sm.impressions || 0)} label="Impressions" />
          <Mini colors={colors} icon="finger-print" tint="#8b5cf6" value={String(sm.clicks || 0)} label="Clicks" />
          <Mini colors={colors} icon="trending-up" tint={colors.success} value={pct(sm.ctr)} label="CTR" />
          <Mini colors={colors} icon="cart" tint={colors.warning} value={pct(sm.conversion_rate)} label="Conversion" />
          <Mini colors={colors} icon="cash" tint="#D4AF37" value={inr(sm.revenue_generated)} label="Revenue" />
          <Mini colors={colors} icon="megaphone" tint={colors.primary} value={String((sm.counts || {}).active || 0)} label="Active" />
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipRow}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const n = f.key === 'all' ? campaigns.length : (sm.counts || {})[f.key];
            return (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
                style={[s.chip, {
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primary : colors.card,
                }]}>
                <Text style={[s.chipText, { color: on ? '#fff' : colors.textSecondary }]}>
                  {f.label}{n ? ` ${n}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Campaign list */}
        {shown.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.card }, elevation(1)]}>
            <View style={[s.emptyIcon, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="megaphone-outline" size={36} color={colors.primary} />
            </View>
            <Text style={[typography.h3 as any, { color: colors.text }]}>No campaigns yet</Text>
            <Text style={[typography.caption as any, { color: colors.textSecondary, textAlign: 'center' }]}>
              Run a promotion to boost orders & visibility.
            </Text>
            <TouchableOpacity style={[s.createBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(restaurant)/campaign-create')}>
              <Text style={s.createText}>Create Campaign</Text>
            </TouchableOpacity>
          </View>
        ) : (
          shown.map((c) => {
            const stt = STATUS_META[c.status] || STATUS_META.draft;
            const m = c.metrics || {};
            const budget = (c.budget || {}).amount || 0;
            const spendPct = budget > 0 ? Math.min(100, (Number(c.spend || 0) / budget) * 100) : 0;
            return (
              <TouchableOpacity key={c.id} activeOpacity={0.85}
                onPress={() => router.push(`/(restaurant)/campaign-detail?id=${c.id}`)}>
                <View style={[s.campCard, { backgroundColor: colors.card }, elevation(1)]}>
                  <View style={s.campTop}>
                    <Text style={[typography.bodyStrong as any, { color: colors.text, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                    <View style={[s.badge, { backgroundColor: stt.fg + '1c' }]}>
                      <Text style={[s.badgeText, { color: stt.fg }]}>{stt.label}</Text>
                    </View>
                  </View>
                  <Text style={[s.campObj, { color: colors.textSecondary }]}>
                    {String(c.objective || '').replace(/_/g, ' ')}
                  </Text>

                  {/* Budget progress */}
                  <View style={s.budgetRow}>
                    <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
                      {inr(c.spend)} <Text style={{ color: colors.textMuted }}>of {inr(budget)} budget</Text>
                    </Text>
                    <Text style={[s.budgetPct, { color: spendPct >= 90 ? colors.warning : colors.textMuted }]}>
                      {Math.round(spendPct)}%
                    </Text>
                  </View>
                  <View style={[s.progressTrack, { backgroundColor: colors.surfaceLight }]}>
                    <View style={[s.progressFill, {
                      width: `${spendPct}%`,
                      backgroundColor: spendPct >= 90 ? colors.warning : colors.primary,
                    }]} />
                  </View>

                  <View style={[s.campStats, { borderTopColor: colors.borderLight }]}>
                    <Stat colors={colors} label="Impressions" value={String(m.impressions || 0)} />
                    <Stat colors={colors} label="Clicks" value={String(m.clicks || 0)} />
                    <Stat colors={colors} label="Orders" value={String(m.orders || 0)} />
                  </View>

                  {/* Quick actions */}
                  <View style={s.actions}>
                    {c.status === 'active' && (
                      <Quick colors={colors} icon="pause" label="Pause" busy={busy === c.id} onPress={() => act(c.id, 'pause')} />
                    )}
                    {c.status === 'paused' && (
                      <Quick colors={colors} icon="play" label="Resume" busy={busy === c.id} onPress={() => act(c.id, 'resume')} />
                    )}
                    {c.status === 'draft' && (
                      <Quick colors={colors} icon="create-outline" label="Edit" onPress={() => router.push(`/(restaurant)/campaign-detail?id=${c.id}`)} />
                    )}
                    {!['completed', 'stopped'].includes(c.status) && (
                      <Quick colors={colors} icon="stop" label="Stop" danger onPress={() => confirmStop(c.id)} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const Kpi = ({ value, label, gold }: any) => (
  <View style={s.kpi}>
    <Text style={[s.kpiValue, gold && { color: '#efd27a' }]}>{value}</Text>
    <Text style={s.kpiLabel}>{label}</Text>
  </View>
);
const Mini = ({ colors, icon, tint, value, label }: any) => (
  <View style={[s.miniCard, { backgroundColor: colors.card }, elevation(1)]}>
    <View style={[s.miniIcon, { backgroundColor: tint + '14' }]}>
      <Ionicons name={icon} size={15} color={tint} />
    </View>
    <Text style={[s.miniValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    <Text style={[s.miniLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>
);
const Stat = ({ colors, label, value }: any) => (
  <View style={s.stat}>
    <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
    <Text style={[s.statLabel, { color: colors.textMuted }]}>{label}</Text>
  </View>
);
const Quick = ({ colors, icon, label, onPress, busy, danger }: any) => (
  <TouchableOpacity disabled={busy} onPress={onPress}
    style={[s.quick, { borderColor: danger ? colors.error + '55' : colors.border }]}>
    {busy ? <ActivityIndicator size="small" color={colors.primary} />
      : <Ionicons name={icon} size={15} color={danger ? colors.error : colors.primary} />}
    <Text style={[s.quickText, { color: danger ? colors.error : colors.primary }]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.sm, padding: space.lg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  walletBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  newText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  content: { padding: space.lg, paddingTop: space.sm },

  kpiHero: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.xl, paddingVertical: space.xl, paddingHorizontal: space.md,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiValue: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  kpiLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  kpiDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.15)' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  miniCard: { width: '31.4%', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.lg, gap: 2 },
  miniIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  miniValue: { fontSize: 14, fontWeight: '800' },
  miniLabel: { fontSize: 9.5, fontWeight: '600' },

  chipRow: { gap: space.sm, paddingVertical: space.lg, alignItems: 'center' },
  chip: { paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontWeight: '700' },

  campCard: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  campTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  campObj: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, marginBottom: 5 },
  budgetPct: { fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  campStats: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: space.md, paddingTop: space.md, borderTopWidth: 1,
  },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1 },
  quickText: { fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: space.xxxl, gap: space.sm, borderRadius: radius.lg },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  createBtn: { marginTop: space.sm, paddingHorizontal: 20, paddingVertical: 11, borderRadius: radius.pill },
  createText: { color: '#fff', fontWeight: '800' },
  retryBtn: { marginTop: space.sm, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill },
  retryText: { color: '#fff', fontWeight: '700' },
});

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { adAPI } from '../../src/services/api';
import { STATUS_META } from './campaigns';

const inr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (n: any) => `${Math.round(Number(n || 0) * 100)}%`;

export default function CampaignDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetAmt, setBudgetAmt] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setData((await adAPI.analytics(id)).data); }
    catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) Alert.alert(ok); load(); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Action failed.'); }
    finally { setBusy(false); }
  };

  const confirm = (title: string, msg: string, fn: () => void, destructive = false) =>
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: destructive ? 'destructive' : 'default', onPress: fn },
    ]);

  const addBudget = async () => {
    const amt = parseFloat(budgetAmt) || 0;
    if (amt <= 0) return;
    setBudgetOpen(false); setBudgetAmt('');
    await run(() => adAPI.addBudget(id!, amt), 'Budget added');
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const r = await adAPI.duplicate(id!);
      router.replace(`/(restaurant)/campaign-detail?id=${r.data.campaign.id}`);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Could not duplicate.'); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View></SafeAreaView>;
  }
  if (!data) {
    return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.center}><Text style={styles.muted}>Campaign not found</Text></View></SafeAreaView>;
  }

  const c = data.campaign || {};
  const st = STATUS_META[c.status] || STATUS_META.draft;
  const maxBar = Math.max(...(data.daily || []).map((d: any) => d.impressions), 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{c.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}>
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
          <Text style={styles.objText}>{String(c.objective || '').replace(/_/g, ' ')}</Text>
        </View>

        {/* Spend vs budget */}
        <Card style={styles.card}>
          <View style={styles.spendRow}>
            <Text style={styles.spendLabel}>Spend</Text>
            <Text style={styles.spendValue}>{inr(data.spend)} / {inr((c.budget || {}).amount)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (data.spend / Math.max((c.budget || {}).amount, 1)) * 100)}%` }]} />
          </View>
        </Card>

        {/* KPIs */}
        <View style={styles.grid}>
          <Kpi v={String(data.impressions)} l="Impressions" />
          <Kpi v={String(data.clicks)} l="Clicks" />
          <Kpi v={pct(data.ctr)} l="CTR" />
          <Kpi v={String(data.orders)} l="Orders" />
          <Kpi v={pct(data.conversion_rate)} l="Conversion" />
          <Kpi v={`${data.roas}x`} l="ROAS" />
          <Kpi v={inr(data.revenue)} l="Revenue" />
          <Kpi v={inr(data.spend)} l="Spent" />
        </View>

        {/* 7-day impressions chart */}
        <Card style={styles.card}>
          <Text style={styles.chartTitle}>Impressions · last 7 days</Text>
          <View style={styles.chart}>
            {(data.daily || []).map((d: any, i: number) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: Math.max(4, (d.impressions / maxBar) * 90), backgroundColor: d.impressions ? COLORS.primary : COLORS.borderLight }]} />
                <Text style={styles.barDay}>{d.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Management */}
        <Text style={styles.section}>MANAGE</Text>
        <View style={styles.actions}>
          {c.status === 'active' && <Act icon="pause" label="Pause" busy={busy} onPress={() => run(() => adAPI.pause(id!))} />}
          {c.status === 'paused' && <Act icon="play" label="Resume" busy={busy} onPress={() => run(() => adAPI.resume(id!))} />}
          {c.status === 'draft' && <Act icon="rocket" label="Launch" busy={busy} onPress={() => run(() => adAPI.submit(id!), 'Launched')} />}
          <Act icon="add-circle" label="Add Budget" onPress={() => setBudgetOpen(true)} />
          <Act icon="copy" label="Duplicate" busy={busy} onPress={duplicate} />
          {!['completed', 'stopped'].includes(c.status) && (
            <Act icon="stop-circle" label="Stop" danger onPress={() => confirm('Stop campaign?', 'This ends it permanently.', () => run(() => adAPI.stop(id!)), true)} />
          )}
        </View>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Add budget modal */}
      <Modal visible={budgetOpen} transparent animationType="fade" onRequestClose={() => setBudgetOpen(false)}>
        <View style={styles.modalBg}>
          <Card style={styles.modal}>
            <Text style={styles.modalTitle}>Add budget</Text>
            <TextInput value={budgetAmt} onChangeText={(v) => setBudgetAmt(v.replace(/[^\d]/g, ''))} keyboardType="number-pad"
              placeholder="₹ amount" placeholderTextColor={COLORS.textMuted} style={styles.modalInput} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => { setBudgetOpen(false); setBudgetAmt(''); }} style={[styles.modalBtn, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addBudget} style={[styles.modalBtn, styles.modalOk]}>
                <Text style={styles.modalOkText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const Kpi = ({ v, l }: any) => (
  <Card style={styles.kpi}><Text style={styles.kpiV}>{v}</Text><Text style={styles.kpiL}>{l}</Text></Card>
);
const Act = ({ icon, label, onPress, busy, danger }: any) => (
  <TouchableOpacity disabled={busy} onPress={onPress} style={[styles.act, danger && { borderColor: COLORS.error + '55' }]}>
    {busy ? <ActivityIndicator size="small" color={COLORS.primary} />
      : <Ionicons name={icon} size={20} color={danger ? COLORS.error : COLORS.primary} />}
    <Text style={[styles.actText, danger && { color: COLORS.error }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: COLORS.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  content: { padding: SPACING.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  objText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textTransform: 'capitalize' },
  card: { padding: SPACING.md, marginBottom: SPACING.sm },
  spendRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  spendLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '700' },
  spendValue: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text },
  track: { height: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  kpi: { width: '47.5%', paddingVertical: SPACING.sm, alignItems: 'flex-start', paddingHorizontal: SPACING.md },
  kpiV: { fontSize: FONTS.sizes.lg, fontWeight: '900', color: COLORS.text },
  kpiL: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  chartTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '55%', borderRadius: 4, minHeight: 4 },
  barDay: { fontSize: 9, color: COLORS.textMuted },
  section: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginTop: SPACING.md, marginBottom: SPACING.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  act: { width: '47.5%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  actText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.primary },
  modalBg: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: SPACING.lg },
  modal: { padding: SPACING.lg },
  modalTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  modalInput: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, fontSize: FONTS.sizes.md, color: COLORS.text },
  modalBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  modalBtn: { flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.md, alignItems: 'center' },
  modalCancel: { borderWidth: 1, borderColor: COLORS.border },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '700' },
  modalOk: { backgroundColor: COLORS.primary },
  modalOkText: { color: '#fff', fontWeight: '800' },
});

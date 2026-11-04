import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { adminAPI } from '../../src/services/api';

const RANGES = [{ label: '7D', value: 7 }, { label: '30D', value: 30 }, { label: '90D', value: 90 }];
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function AdminCommissionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [globalPct, setGlobalPct] = useState('');
  const [rests, setRests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [range, setRange] = useState(30);
  const [report, setReport] = useState<any>(null);

  const loadCfg = useCallback(() => {
    adminAPI.getCommission().then((r) => {
      setGlobalPct(String(r.data?.global_pct ?? ''));
      setRests(r.data?.restaurant_overrides || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const loadReport = useCallback((rg: number) => {
    adminAPI.commissionReport(rg).then((r) => setReport(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadCfg(); }, [loadCfg]);
  useEffect(() => { loadReport(range); }, [range, loadReport]);

  const saveGlobal = async () => {
    setSavingGlobal(true);
    try {
      await adminAPI.setCommission({ global_pct: Number(globalPct) || 0 });
      showToast({ type: 'success', message: 'Global commission saved' });
      loadReport(range);
    } catch { showToast({ type: 'error', message: 'Could not save' }); }
    finally { setSavingGlobal(false); }
  };

  const saveRest = async (rid: string, val: string) => {
    try {
      await adminAPI.setRestaurantCommission(rid, val === '' ? null : Number(val));
      showToast({ type: 'success', message: 'Saved' });
      loadReport(range);
    } catch { showToast({ type: 'error', message: 'Could not save' }); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Global */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Global commission</Text>
            <View style={styles.globalRow}>
              <TextInput
                style={styles.input} value={globalPct} onChangeText={(t) => setGlobalPct(t.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric" placeholder="15" placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.pct}>%</Text>
              <TouchableOpacity style={[styles.saveBtn, savingGlobal && { opacity: 0.6 }]} onPress={saveGlobal} disabled={savingGlobal}>
                {savingGlobal ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Applied to every restaurant without its own rate.</Text>
          </View>

          {/* Per-restaurant */}
          <Text style={styles.section}>PER-RESTAURANT OVERRIDES</Text>
          <View style={styles.card}>
            {rests.length === 0 && <Text style={styles.hint}>No restaurants yet.</Text>}
            {rests.map((r) => <RestRow key={r.id} styles={styles} colors={colors} r={r} globalPct={globalPct} onSave={saveRest} />)}
          </View>

          {/* Report */}
          <View style={styles.reportHead}>
            <Text style={styles.section}>COMMISSION EARNED</Text>
            <View style={styles.rangeRow}>
              {RANGES.map((rg) => (
                <TouchableOpacity key={rg.value} onPress={() => setRange(rg.value)}
                  style={[styles.rangeBtn, range === rg.value && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.rangeText, { color: range === rg.value ? '#fff' : colors.textSecondary }]}>{rg.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.totalsRow}>
            <View style={styles.totalCard}><Text style={styles.totalLabel}>Gross</Text><Text style={styles.totalValue}>{inr(report?.total_gross)}</Text></View>
            <View style={styles.totalCard}><Text style={styles.totalLabel}>Commission</Text><Text style={[styles.totalValue, { color: colors.primary }]}>{inr(report?.total_commission)}</Text></View>
          </View>
          <View style={styles.card}>
            {(report?.rows || []).length === 0 && <Text style={styles.hint}>No earnings in range.</Text>}
            {(report?.rows || []).map((row: any) => (
              <View key={row.id} style={styles.repRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.repName} numberOfLines={1}>{row.name}</Text>
                  <Text style={styles.repMeta}>{row.orders} orders · {row.rate}%</Text>
                </View>
                <Text style={[styles.repComm, { color: colors.primary }]}>{inr(row.commission)}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RestRow({ styles, colors, r, globalPct, onSave }: any) {
  const [val, setVal] = useState(r.commission_pct != null ? String(r.commission_pct) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await onSave(r.id, val); } finally { setSaving(false); } };
  return (
    <View style={styles.restRow}>
      <Text style={styles.restName} numberOfLines={1}>{r.name}</Text>
      <TextInput
        style={styles.restInput} value={val} onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ''))}
        keyboardType="numeric" placeholder={`${globalPct} (global)`} placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity style={styles.restSave} onPress={save} disabled={saving}>
        <Text style={[styles.saveText, { color: colors.primary }]}>{saving ? '…' : 'Save'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text, marginBottom: SPACING.sm },
  globalRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  input: { width: 90, backgroundColor: colors.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: FONTS.sizes.md },
  pct: { fontSize: FONTS.sizes.md, color: colors.textSecondary },
  saveBtn: { marginLeft: 'auto', backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  saveText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.sm },
  hint: { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: SPACING.sm },
  section: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  restName: { flex: 1, fontSize: FONTS.sizes.sm, color: colors.text },
  restInput: { width: 110, backgroundColor: colors.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 6, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: FONTS.sizes.sm },
  restSave: { paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  reportHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeRow: { flexDirection: 'row', gap: 6, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  rangeBtn: { paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rangeText: { fontSize: FONTS.sizes.xs, fontWeight: '800' },
  totalsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  totalCard: { flex: 1, backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border },
  totalLabel: { fontSize: FONTS.sizes.xs, color: colors.textSecondary },
  totalValue: { fontSize: FONTS.sizes.xl, fontWeight: '900', color: colors.text, marginTop: 2 },
  repRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  repName: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.text },
  repMeta: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  repComm: { fontSize: FONTS.sizes.md, fontWeight: '800' },
});

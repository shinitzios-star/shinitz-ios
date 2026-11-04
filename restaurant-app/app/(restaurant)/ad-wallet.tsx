import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { adWalletAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const inr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const PRESETS = [200, 500, 1000, 2000];

export default function AdWalletScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');

  const load = useCallback(async () => {
    try {
      const [w, t, i] = await Promise.all([adWalletAPI.get(), adWalletAPI.transactions(), adWalletAPI.invoices()]);
      setWallet(w.data); setTxns(t.data || []); setInvoices(i.data || []);
    } catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const topup = async (amount: number) => {
    if (busy) return;
    if (amount < (wallet?.min_topup || 100)) {
      Alert.alert('Amount too low', `Minimum top-up is ${inr(wallet?.min_topup || 100)}.`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await adWalletAPI.topupCreate(amount);
      const res: any = await RazorpayCheckout.open({
        key: data.razorpay_key_id,
        amount: data.amount,
        currency: data.currency,
        name: data.name || 'Shinitz Ads',
        description: data.description,
        order_id: data.razorpay_order_id,
        prefill: {
          name: data.prefill?.name || user?.restaurant_name || user?.name || '',
          contact: data.prefill?.contact || user?.phone || '',
        },
        theme: { color: COLORS.primary },
      });
      await adWalletAPI.topupVerify({
        razorpay_order_id: res.razorpay_order_id,
        razorpay_payment_id: res.razorpay_payment_id,
        razorpay_signature: res.razorpay_signature,
        invoice_id: data.invoice.id,
      });
      setCustom('');
      Alert.alert('Wallet topped up ✅', `${inr(amount)} added to your ad wallet.`);
      load();
    } catch (e: any) {
      if (e?.code === 0 || e?.code === 2 || /cancel/i.test(e?.description || '')) {
        // user dismissed checkout — no-op
      } else {
        Alert.alert('Payment failed', e?.description || e?.response?.data?.detail || 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    const ar = wallet?.autorecharge || { threshold: 100, amount: 500 };
    setWallet((w: any) => ({ ...w, autorecharge: { ...ar, enabled } }));
    try { await adWalletAPI.setAutorecharge({ enabled, threshold: ar.threshold, amount: ar.amount }); }
    catch { Alert.alert('Error', 'Could not update auto-recharge.'); load(); }
  };

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Ad Wallet</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return <SafeAreaView style={styles.container} edges={['top']}><Header /><View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View></SafeAreaView>;
  }

  const w = wallet || {};
  const ar = w.autorecharge || { enabled: false, threshold: 100, amount: 500 };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}>
        {/* Balance */}
        <Card style={styles.hero} variant="elevated">
          <Text style={styles.heroLabel}>Ad wallet balance</Text>
          <Text style={styles.heroValue}>{inr(w.balance)}</Text>
          <Text style={styles.heroSub}>Used to run your ad campaigns</Text>
        </Card>

        {/* Top up */}
        <Text style={styles.section}>ADD MONEY</Text>
        <View style={styles.presetRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity key={p} disabled={busy} onPress={() => topup(p)} style={styles.preset}>
              <Text style={styles.presetText}>{inr(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput value={custom} onChangeText={(v) => setCustom(v.replace(/[^\d]/g, ''))} keyboardType="number-pad"
            placeholder="Custom amount" placeholderTextColor={COLORS.textMuted} style={styles.input} />
          <TouchableOpacity disabled={busy || !custom} onPress={() => topup(parseInt(custom, 10) || 0)}
            style={[styles.addBtn, (busy || !custom) && { backgroundColor: COLORS.textMuted }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addText}>Add</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.gstNote}>+ {w.gst_rate || 18}% GST. A tax invoice is generated for every top-up.</Text>

        {/* Auto recharge */}
        <Text style={styles.section}>AUTO-RECHARGE</Text>
        <Card style={styles.card}>
          <View style={styles.arRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Auto top-up when low</Text>
              <Text style={styles.cardSub}>Recharge {inr(ar.amount)} when balance drops below {inr(ar.threshold)}</Text>
            </View>
            <Switch value={!!ar.enabled} onValueChange={toggleAuto}
              trackColor={{ false: COLORS.border, true: COLORS.success }} thumbColor="#fff" />
          </View>
        </Card>

        {/* Invoices */}
        <Text style={styles.section}>INVOICES</Text>
        {invoices.length === 0 ? (
          <Card style={styles.card}><Text style={styles.muted}>No invoices yet.</Text></Card>
        ) : (
          <Card style={styles.listCard}>
            {invoices.slice(0, 8).map((iv, i) => (
              <View key={iv.id || i} style={[styles.row, i === Math.min(invoices.length, 8) - 1 && styles.lastRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{iv.number}</Text>
                  <Text style={styles.rowSub}>{inr(iv.base_amount)} + {inr(iv.gst_amount)} GST · {fmt(iv.created_at)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (iv.status === 'paid' ? COLORS.success : iv.status === 'failed' ? COLORS.error : COLORS.warning) + '22' }]}>
                  <Text style={[styles.badgeText, { color: iv.status === 'paid' ? COLORS.success : iv.status === 'failed' ? COLORS.error : COLORS.warning }]}>
                    {iv.status === 'paid' ? 'Paid' : iv.status === 'failed' ? 'Failed' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Transactions */}
        <Text style={styles.section}>TRANSACTIONS</Text>
        {txns.length === 0 ? (
          <Card style={styles.card}><Text style={styles.muted}>No transactions yet.</Text></Card>
        ) : (
          <Card style={styles.listCard}>
            {txns.slice(0, 15).map((t, i) => {
              const credit = (t.amount || 0) >= 0;
              return (
                <View key={t.id || i} style={[styles.row, i === Math.min(txns.length, 15) - 1 && styles.lastRow]}>
                  <Ionicons name={credit ? 'arrow-down-circle' : 'arrow-up-circle'} size={22}
                    color={credit ? COLORS.success : COLORS.textSecondary} />
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.rowTitle}>{t.type === 'topup' ? 'Top-up' : 'Ad spend'}</Text>
                    <Text style={styles.rowSub}>{fmt(t.at)} · Bal {inr(t.balance_after)}</Text>
                  </View>
                  <Text style={[styles.amt, { color: credit ? COLORS.success : COLORS.text }]}>
                    {credit ? '+' : ''}{inr(t.amount)}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  content: { padding: SPACING.md, paddingTop: SPACING.sm },
  hero: { alignItems: 'center', paddingVertical: SPACING.lg, backgroundColor: COLORS.primary },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: FONTS.sizes.xs, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: FONTS.sizes.xxxl, fontWeight: '900', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: FONTS.sizes.sm, marginTop: 2 },
  section: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm, marginLeft: SPACING.xs },
  presetRow: { flexDirection: 'row', gap: SPACING.sm },
  preset: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '0c' },
  presetText: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.primary },
  customRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  input: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, fontSize: FONTS.sizes.md, color: COLORS.text },
  addBtn: { paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, justifyContent: 'center', ...SHADOWS.sm },
  addText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  gstNote: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.sm, marginLeft: SPACING.xs },
  card: { padding: SPACING.md },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  arRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  listCard: { padding: 0, paddingHorizontal: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  lastRow: { borderBottomWidth: 0 },
  rowTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text },
  rowSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  amt: { fontSize: FONTS.sizes.md, fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
});

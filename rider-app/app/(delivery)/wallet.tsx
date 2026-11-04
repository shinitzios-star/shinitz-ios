// SHINITZ Rider — Wallet. Restyled to the design system (gradient balance card);
// getWallet + balances (available/pending/withdrawn/lifetime) + transaction
// ledger with credit/debit colouring all preserved.
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { Card, SectionTitle } from '../../src/components/ui';
import { deliveryAPI } from '../../src/services/api';

const KIND_META: Record<string, { icon: any; label: string }> = {
  delivery_earning: { icon: 'bicycle', label: 'Delivery' },
  tip: { icon: 'happy', label: 'Tip' },
  incentive: { icon: 'rocket', label: 'Incentive' },
  bonus: { icon: 'gift', label: 'Bonus' },
  penalty: { icon: 'remove-circle', label: 'Penalty' },
  adjustment: { icon: 'create', label: 'Adjustment' },
  payout: { icon: 'cash', label: 'Payout' },
};

export default function WalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await deliveryAPI.getWallet(); setData(res.data); }
    catch { /* keep last */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const s = makeStyles(colors);

  if (loading) {
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  const txns = data?.transactions || [];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2 as any, { color: colors.text }]}>Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        {/* Balance card */}
        <LinearGradient colors={gradients.heroWarm as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.balanceCard}>
          <Text style={s.balanceLabel}>Available balance</Text>
          <Text style={s.balanceAmount}>₹{(data?.available ?? 0).toFixed(2)}</Text>
          <View style={s.balanceRow}>
            <Col label="Pending" value={data?.pending} />
            <Col label="Withdrawn" value={data?.withdrawn} />
            <Col label="Lifetime" value={data?.lifetime_earned} />
          </View>
        </LinearGradient>

        <View style={[s.note, { backgroundColor: colors.info + '12' }]}>
          <Ionicons name="information-circle" size={16} color={colors.info} />
          <Text style={[typography.caption as any, { color: colors.info, flex: 1 }]}>Payouts are processed by SHINITZ to your UPI / bank account.</Text>
        </View>

        <SectionTitle style={{ textAlign: 'left', marginTop: space.md }}>Transactions</SectionTitle>
        {txns.length === 0 ? (
          <View style={s.empty}><Ionicons name="receipt-outline" size={44} color={colors.textMuted} /><Text style={[typography.body as any, { color: colors.textMuted, marginTop: space.sm }]}>No transactions yet</Text></View>
        ) : (
          txns.map((t: any) => {
            const meta = KIND_META[t.kind] || { icon: 'ellipse', label: t.kind };
            const credit = t.amount >= 0;
            return (
              <Card key={t.id} padded={false} style={s.txnRow}>
                <View style={[s.txnIcon, { backgroundColor: (credit ? colors.success : colors.error) + '18' }]}>
                  <Ionicons name={meta.icon} size={18} color={credit ? colors.success : colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong as any, { color: colors.text }]}>{meta.label}</Text>
                  {t.note ? <Text style={[typography.caption as any, { color: colors.textSecondary }]} numberOfLines={1}>{t.note}</Text> : null}
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</Text>
                </View>
                <Text style={[typography.bodyStrong as any, { color: credit ? colors.success : colors.error }]}>
                  {credit ? '+' : '−'}₹{Math.abs(t.amount).toFixed(2)}
                </Text>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Col({ label, value }: { label: string; value?: number }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>₹{(value ?? 0).toFixed(2)}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  balanceCard: { borderRadius: radius.xl, padding: space.xl, marginBottom: space.md, ...elevation(2) },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  balanceAmount: { color: '#fff', fontSize: 38, fontWeight: '800', marginVertical: 4, letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)', paddingTop: space.md },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, padding: space.sm, marginBottom: space.md },
  empty: { alignItems: 'center', paddingVertical: space.xxxl },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, marginBottom: space.xs },
  txnIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
});

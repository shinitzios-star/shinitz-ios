import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await deliveryAPI.getWallet();
      setData(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;
  }

  const txns = data?.transactions || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceAmount}>₹{(data?.available ?? 0).toFixed(2)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceCol}>
              <Text style={styles.subVal}>₹{(data?.pending ?? 0).toFixed(2)}</Text>
              <Text style={styles.subLabel}>Pending</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.subVal}>₹{(data?.withdrawn ?? 0).toFixed(2)}</Text>
              <Text style={styles.subLabel}>Withdrawn</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.subVal}>₹{(data?.lifetime_earned ?? 0).toFixed(2)}</Text>
              <Text style={styles.subLabel}>Lifetime</Text>
            </View>
          </View>
        </View>

        <View style={styles.payoutNote}>
          <Ionicons name="information-circle" size={16} color={COLORS.info} />
          <Text style={styles.payoutNoteText}>Payouts are processed by Shinitz to your UPI / bank account.</Text>
        </View>

        <Text style={styles.sectionTitle}>Transactions</Text>
        {txns.length === 0 ? (
          <View style={styles.empty}><Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} /><Text style={styles.emptyText}>No transactions yet</Text></View>
        ) : (
          txns.map((t: any) => {
            const meta = KIND_META[t.kind] || { icon: 'ellipse', label: t.kind };
            const credit = t.amount >= 0;
            return (
              <View key={t.id} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: (credit ? COLORS.success : COLORS.error) + '18' }]}>
                  <Ionicons name={meta.icon} size={18} color={credit ? COLORS.success : COLORS.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnLabel}>{meta.label}</Text>
                  {t.note ? <Text style={styles.txnNote} numberOfLines={1}>{t.note}</Text> : null}
                  <Text style={styles.txnDate}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: credit ? COLORS.success : COLORS.error }]}>
                  {credit ? '+' : '−'}₹{Math.abs(t.amount).toFixed(2)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  balanceCard: { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  balanceLabel: { color: '#fff', opacity: 0.85, fontSize: FONTS.sizes.sm },
  balanceAmount: { color: '#fff', fontSize: 38, fontWeight: '800', marginVertical: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: SPACING.md },
  balanceCol: { alignItems: 'center', flex: 1 },
  subVal: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  subLabel: { color: '#fff', opacity: 0.8, fontSize: FONTS.sizes.xs, marginTop: 2 },
  payoutNote: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.info + '12', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.lg },
  payoutNoteText: { flex: 1, color: COLORS.info, fontSize: FONTS.sizes.xs },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyText: { color: COLORS.textMuted },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  txnIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  txnLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  txnNote: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  txnDate: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  txnAmount: { fontSize: FONTS.sizes.md, fontWeight: '800' },
});

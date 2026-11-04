// ─────────────────────────────────────────────────────────────────────────────
// Shinitz Wallet — the consumer's credit balance + full ledger. Credits come
// from cancellations (instant), referrals, promos and support goodwill; they
// apply at checkout via the cart's "Use wallet balance" toggle. The balance is
// always the server's aggregation over the append-only ledger.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { walletAPI } from '../../src/services/api';

const KIND_META: Record<string, { icon: any; label: string; color: string }> = {
  refund_credit: { icon: 'return-down-back', label: 'Refund credit', color: '#10b981' },
  spend_reversal: { icon: 'return-down-back', label: 'Credits returned', color: '#10b981' },
  referral_reward: { icon: 'gift', label: 'Referral reward', color: '#8b5cf6' },
  promo_credit: { icon: 'pricetag', label: 'Promo credit', color: '#f59e0b' },
  cashback: { icon: 'cash', label: 'Cashback', color: '#f59e0b' },
  spend: { icon: 'cart', label: 'Used on order', color: '#3b82f6' },
  admin_adjust: { icon: 'shield-checkmark', label: 'Support adjustment', color: '#06b6d4' },
};

export default function WalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const { data } = await walletAPI.get(p);
      setBalance(Number(data?.balance) || 0);
      setTxns((prev) => (append ? [...prev, ...(data?.transactions || [])] : data?.transactions || []));
      setHasMore(!!data?.has_more);
      setPage(p);
    } catch { /* pull-to-refresh recovers */ }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Shinitz Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Balance hero */}
      <View style={[s.hero, { backgroundColor: colors.primary }]}>
        <Text style={s.heroLabel}>AVAILABLE BALANCE</Text>
        <Text style={s.heroValue}>₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
        <Text style={s.heroHint}>Applies automatically at checkout when you enable it in the cart</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && !loadingMore) { setLoadingMore(true); load(page + 1, true); } }}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
          renderItem={({ item }) => {
            const meta = KIND_META[item.kind] || KIND_META.admin_adjust;
            const credit = Number(item.amount) > 0;
            return (
              <View style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.rowIcon, { backgroundColor: meta.color + '16' }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: colors.text }]}>{meta.label}</Text>
                  {item.note ? <Text style={[s.rowNote, { color: colors.textSecondary }]} numberOfLines={1}>{item.note}</Text> : null}
                  <Text style={[s.rowDate, { color: colors.textMuted }]}>
                    {item.created_at ? new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    {item.order_id ? ` · #${String(item.order_id).slice(0, 8).toUpperCase()}` : ''}
                  </Text>
                </View>
                <Text style={[s.rowAmount, { color: credit ? colors.success : colors.text }]}>
                  {credit ? '+' : ''}₹{Math.abs(Number(item.amount)).toFixed(2)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="wallet-outline" size={56} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, fontSize: FONTS.sizes.md, marginTop: SPACING.sm }}>
                No wallet activity yet
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: FONTS.sizes.sm, marginTop: 2, textAlign: 'center', paddingHorizontal: SPACING.xl }}>
                Refunds from cancelled orders land here instantly — no waiting for the bank
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  hero: {
    marginHorizontal: SPACING.md, borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  heroHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'center', marginTop: 6 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  rowNote: { fontSize: FONTS.sizes.sm, marginTop: 1 },
  rowDate: { fontSize: FONTS.sizes.xs, marginTop: 2 },
  rowAmount: { fontSize: FONTS.sizes.md, fontWeight: '800' },
});

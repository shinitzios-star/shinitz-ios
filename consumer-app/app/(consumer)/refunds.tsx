import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { refundAPI, RefundStatus } from '../../src/services/api';

export default function RefundsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await refundAPI.list();
      setRefunds(data.refunds || []);
    } catch {
      /* empty state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const statusColor = (s: RefundStatus): string => ({
    refunded: colors.success,
    rejected: colors.error,
    approved: colors.success,
    under_review: colors.warning,
    submitted: colors.info,
  } as Record<RefundStatus, string>)[s] || colors.info;

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{t('refund.myRefunds')}</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const c = statusColor(item.status);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: '/(consumer)/refund-detail', params: { refundId: item.id } })}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.orderNo, { color: colors.text }]}>#{item.order_short}</Text>
          <View style={[styles.badge, { backgroundColor: c + '18' }]}>
            <Text style={[styles.badgeText, { color: c }]}>{t(`refund.status.${item.status}`)}</Text>
          </View>
        </View>
        <Text style={[styles.reason, { color: colors.textSecondary }]} numberOfLines={1}>{item.reason_label}</Text>
        <View style={styles.cardBottom}>
          <Text style={[styles.amount, { color: colors.primary }]}>₹{Number(item.amount_requested).toFixed(2)}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {Header}
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {Header}
      <FlatList
        data={refunds}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={refunds.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="cash-outline" size={56} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('refund.noneTitle')}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('refund.noneText')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700' },
  list: { padding: SPACING.md, gap: SPACING.sm },
  emptyList: { flexGrow: 1 },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNo: { fontSize: FONTS.sizes.md, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  badgeText: { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  reason: { fontSize: FONTS.sizes.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  amount: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', marginTop: SPACING.sm },
  emptyText: { fontSize: FONTS.sizes.sm, textAlign: 'center' },
});

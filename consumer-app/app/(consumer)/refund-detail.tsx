import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { refundAPI } from '../../src/services/api';

// The canonical happy-path order. `rejected` replaces the tail when it happens.
const FLOW = ['submitted', 'under_review', 'approved', 'refunded'] as const;

export default function RefundDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { refundId } = useLocalSearchParams<{ refundId: string }>();

  const [refund, setRefund] = useState<any>(null);
  const [images, setImages] = useState<{ idx: number; data_uri: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await refundAPI.get(refundId);
      setRefund(data.refund);
      if (data.refund?.evidence_count > 0) {
        refundAPI.evidence(refundId).then((r) => setImages(r.data.images || [])).catch(() => {});
      }
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refundId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const statusMeta = (status: string): { color: string; icon: keyof typeof Ionicons.glyphMap; label: string } => {
    switch (status) {
      case 'refunded': return { color: colors.success, icon: 'checkmark-done', label: t('refund.status.refunded') };
      case 'rejected': return { color: colors.error, icon: 'close-circle', label: t('refund.status.rejected') };
      case 'approved': return { color: colors.success, icon: 'checkmark-circle', label: t('refund.status.approved') };
      case 'under_review': return { color: colors.warning, icon: 'time', label: t('refund.status.under_review') };
      default: return { color: colors.info, icon: 'paper-plane', label: t('refund.status.submitted') };
    }
  };

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{t('refund.detailTitle')}</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {Header}
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!refund) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={54} color={colors.textMuted} />
          <Text style={[styles.blockedText, { color: colors.textSecondary }]}>{t('refund.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rejected = refund.status === 'rejected';
  const currentRank = FLOW.indexOf(refund.status);
  // Build the visual steps. If rejected, show submitted/review then a rejected node.
  const steps = rejected
    ? [
        { key: 'submitted', label: t('refund.status.submitted'), done: true },
        { key: 'under_review', label: t('refund.status.under_review'), done: true },
        { key: 'rejected', label: t('refund.status.rejected'), done: true, isReject: true },
      ]
    : FLOW.map((s, i) => ({ key: s, label: t(`refund.status.${s}`), done: currentRank >= i, current: currentRank === i }));

  const meta = statusMeta(refund.status);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {Header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Status hero */}
        <View style={[styles.hero, { backgroundColor: meta.color + '14', borderColor: meta.color + '33' }]}>
          <Ionicons name={meta.icon} size={30} color={meta.color} />
          <Text style={[styles.heroStatus, { color: meta.color }]}>{meta.label}</Text>
          <Text style={[styles.heroAmount, { color: colors.text }]}>₹{Number(refund.amount_requested).toFixed(2)}</Text>
          <Text style={[styles.heroOrder, { color: colors.textSecondary }]}>
            {t('refund.forOrder')} #{refund.order_short}
          </Text>
        </View>

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('refund.progress')}</Text>
          {steps.map((s: any, idx: number) => {
            const dotColor = s.isReject ? colors.error : s.done ? colors.success : colors.border;
            return (
              <View key={s.key} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: dotColor }, s.current && { ...SHADOWS.sm }]}>
                    {s.isReject
                      ? <Ionicons name="close" size={12} color="#fff" />
                      : s.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  {idx < steps.length - 1 && <View style={[styles.line, { backgroundColor: s.done && !s.isReject ? colors.success : colors.border }]} />}
                </View>
                <Text style={[styles.stepLabel, { color: s.done ? colors.text : colors.textMuted }, s.current && { fontWeight: '700', color: colors.primary }]}>
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Detail rows */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row colors={colors} label={t('refund.reason')} value={refund.reason_label} />
          {!!refund.description && <Row colors={colors} label={t('refund.details')} value={refund.description} />}
          <Row colors={colors} label={t('refund.destination')}
               value={refund.refund_destination === 'source' ? t('refund.toSource') : t('refund.toWallet')} />
          {refund.status === 'refunded' && !!refund.refund_id && (
            <Row colors={colors} label={t('refund.reference')} value={String(refund.refund_id)} />
          )}
          {!!refund.admin_remarks && (
            <View style={[styles.remarks, { backgroundColor: (rejected ? colors.error : colors.info) + '12' }]}>
              <Text style={[styles.remarksLabel, { color: colors.textSecondary }]}>{t('refund.agentNote')}</Text>
              <Text style={[styles.remarksText, { color: colors.text }]}>{refund.admin_remarks}</Text>
            </View>
          )}
        </View>

        {/* Evidence */}
        {images.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('refund.yourPhotos')}</Text>
            <View style={styles.imagesRow}>
              {images.map((im) => (
                <Image key={im.idx} source={{ uri: im.data_uri }} style={styles.thumb} />
              ))}
            </View>
          </View>
        )}

        {refund.status === 'refunded' && (
          <Text style={[styles.footNote, { color: colors.textSecondary }]}>
            {refund.refund_destination === 'source' ? t('refund.sourceNote') : t('refund.walletNote')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ colors, label, value }: { colors: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700' },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.md },
  blockedText: { fontSize: FONTS.sizes.md, textAlign: 'center' },
  hero: { alignItems: 'center', gap: 4, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  heroStatus: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  heroAmount: { fontSize: FONTS.sizes.xxl, fontWeight: '800', marginTop: 2 },
  heroOrder: { fontSize: FONTS.sizes.sm },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', marginBottom: SPACING.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  line: { width: 2, height: 26, marginVertical: 2 },
  stepLabel: { fontSize: FONTS.sizes.md, paddingTop: 1, paddingBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6 },
  rowLabel: { fontSize: FONTS.sizes.sm },
  rowValue: { fontSize: FONTS.sizes.sm, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  remarks: { borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm },
  remarksLabel: { fontSize: FONTS.sizes.xs, marginBottom: 2 },
  remarksText: { fontSize: FONTS.sizes.sm, lineHeight: 19 },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  thumb: { width: 90, height: 90, borderRadius: RADIUS.md },
  footNote: { fontSize: FONTS.sizes.xs, lineHeight: 17, textAlign: 'center', paddingHorizontal: SPACING.md },
});

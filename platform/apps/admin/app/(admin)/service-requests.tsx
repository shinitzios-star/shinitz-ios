import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { adminAPI } from '../../src/services/api';

const fmt = (t?: string) => (t ? new Date(t).toLocaleString() : '—');

export default function AdminServiceRequestsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<any>({ data: [], areas: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'demand' | 'requests'>('demand');

  const load = useCallback(() => {
    adminAPI.serviceRequests()
      .then((r) => setData(r.data || { data: [], areas: [], total: 0 }))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    const rows = data.data || [];
    if (!rows.length) { showToast({ type: 'warning', message: 'Nothing to export' }); return; }
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Name,Phone,Address,Pincode,Latitude,Longitude,Date';
    const csv = [header, ...rows.map((r: any) =>
      [r.name, r.phone, r.address, r.pincode, r.lat, r.lng, fmt(r.created_at)].map(esc).join(','),
    )].join('\n');
    try {
      await Share.share({ message: csv, title: 'Shinitz waiting list (CSV)' });
    } catch {
      showToast({ type: 'error', message: 'Could not export' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Requests</Text>
        <TouchableOpacity onPress={exportCsv} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['demand', 'requests'] as const).map((k) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && { backgroundColor: colors.primary }]}>
            <Text style={[styles.tabText, { color: tab === k ? '#fff' : colors.textSecondary }]}>
              {k === 'demand' ? 'Demand by area' : `Requests (${data.total || 0})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        >
          {tab === 'demand' ? (
            (data.areas || []).length === 0 ? <Text style={styles.empty}>No requests yet.</Text> :
            (data.areas || []).map((d: any, i: number) => {
              const max = Math.max(1, ...(data.areas || []).map((x: any) => x.requests));
              return (
                <View key={i} style={styles.demandRow}>
                  <Text style={styles.demandArea} numberOfLines={1}>{d.area}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(6, (d.requests / max) * 100)}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={styles.demandCount}>{d.requests}</Text>
                </View>
              );
            })
          ) : (
            (data.data || []).length === 0 ? <Text style={styles.empty}>No requests yet.</Text> :
            (data.data || []).map((r: any) => (
              <View key={r.id} style={styles.reqCard}>
                <View style={styles.reqTop}>
                  <Text style={styles.reqName}>{r.name || 'Customer'}</Text>
                  <Text style={styles.reqDate}>{fmt(r.created_at)}</Text>
                </View>
                <Text style={styles.reqPhone}>{r.phone}</Text>
                {!!r.address && <Text style={styles.reqAddr} numberOfLines={2}>{r.address}</Text>}
                {!!r.pincode && <Text style={styles.reqPin}>PIN {r.pincode}</Text>}
              </View>
            ))
          )}
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabText: { fontSize: FONTS.sizes.sm, fontWeight: '800' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  empty: { fontSize: FONTS.sizes.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: SPACING.xl },
  demandRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  demandArea: { width: 90, fontSize: FONTS.sizes.sm, color: colors.text, fontWeight: '600' },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.surface, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6 },
  demandCount: { width: 36, textAlign: 'right', fontSize: FONTS.sizes.sm, fontWeight: '800', color: colors.text },
  reqCard: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.sm },
  reqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reqName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text },
  reqDate: { fontSize: FONTS.sizes.xs, color: colors.textSecondary },
  reqPhone: { fontSize: FONTS.sizes.sm, color: colors.primary, fontWeight: '600', marginTop: 2 },
  reqAddr: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
  reqPin: { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: 2 },
});

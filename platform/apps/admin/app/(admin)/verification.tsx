import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { verificationAPI } from '../../src/services/api';

const DOC_LABELS: Record<string, string> = {
  fssai_license: 'FSSAI License', gst_certificate: 'GST Certificate', pan_card: 'PAN Card',
  bank_account: 'Bank Account', cancelled_cheque: 'Cancelled Cheque',
  upi_details: 'UPI Details', owner_identity: 'Owner Identity Proof',
};
const CHECK_LABELS: Record<string, string> = {
  business_exists: 'Business physically exists', address_valid: 'Address is valid',
  kitchen_operational: 'Kitchen is operational', category_matches: 'Category matches',
  hygiene_ok: 'Hygiene standards', packaging_ok: 'Packaging standards',
  phone_verified: 'Phone verified', hours_verified: 'Business hours verified',
};
const STATUS_COLOR: Record<string, string> = {
  approved: COLORS.success, registered: COLORS.warning, documents_submitted: COLORS.info,
  documents_verified: COLORS.info, business_verified: COLORS.info,
  rejected: COLORS.error, suspended: COLORS.error, reverification_required: COLORS.warning,
};

export default function AdminVerificationScreen() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const res = await verificationAPI.adminQueue();
      setQueue(res.data.data || []);
    } catch (e) {
      if (__DEV__) console.warn('queue load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadQueue(); }, [loadQueue]));

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({ id });
    try {
      const res = await verificationAPI.adminDetail(id);
      setDetail(res.data);
      setChecks(res.data.business_checks || {});
    } catch {
      Alert.alert('Error', 'Could not load partner details');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (detail?.id) {
      const res = await verificationAPI.adminDetail(detail.id);
      setDetail(res.data);
      setChecks(res.data.business_checks || {});
    }
    loadQueue();
  };

  const reviewDocs = async (approved: boolean) => {
    let reason = '';
    if (!approved) {
      const r = await prompt('Rejection reason');
      if (r === null) return;
      reason = r;
    }
    setBusy(true);
    try { await verificationAPI.adminDocumentsReview(detail.id, approved, reason); await refreshDetail(); }
    finally { setBusy(false); }
  };

  const saveBusiness = async () => {
    setBusy(true);
    try { await verificationAPI.adminBusinessReview(detail.id, checks); await refreshDetail(); }
    finally { setBusy(false); }
  };

  const decide = async (decision: string) => {
    let reason = '';
    if (decision !== 'approved') {
      const r = await prompt(`Reason for ${decision}`);
      if (r === null) return;
      reason = r;
    }
    setBusy(true);
    try {
      await verificationAPI.adminDecision(detail.id, decision, reason);
      await refreshDetail();
      Alert.alert('Done', `Partner ${decision}`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Decision failed');
    } finally { setBusy(false); }
  };

  // Simple promise-based prompt via Alert (returns null on cancel)
  const prompt = (title: string): Promise<string | null> =>
    new Promise((resolve) => {
      Alert.prompt
        ? Alert.prompt(title, undefined, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            { text: 'OK', onPress: (t?: string) => resolve(t || 'Reviewed by admin') },
          ])
        : resolve('Reviewed by admin'); // Android: Alert.prompt unavailable → default note (backend requires a non-empty reason)
    });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Verification</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{queue.length}</Text></View>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadQueue(); }} tintColor={COLORS.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openDetail(item.id)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.business_name || item.name}</Text>
              <Text style={styles.rowSub}>+{item.phone} · {item.role}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[item.verification_status] || COLORS.textMuted) + '22' }]}>
              <Text style={[styles.statusPillText, { color: STATUS_COLOR[item.verification_status] || COLORS.textMuted }]}>
                {item.verification_status.replace(/_/g, ' ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>No partners to review</Text></View>}
      />

      {/* Full-detail review modal */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setDetail(null)} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Review</Text>
            <View style={{ width: 44 }} />
          </View>

          {detailLoading || !detail?.documents ? (
            <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}>
              {/* Business info */}
              <View style={styles.card}>
                <Text style={styles.bizName}>{detail.business_name || detail.name}</Text>
                <View style={[styles.statusPill, { alignSelf: 'flex-start', marginTop: 4, backgroundColor: (STATUS_COLOR[detail.verification_status] || COLORS.textMuted) + '22' }]}>
                  <Text style={[styles.statusPillText, { color: STATUS_COLOR[detail.verification_status] || COLORS.textMuted }]}>
                    {detail.verification_status.replace(/_/g, ' ')}
                  </Text>
                </View>
                <InfoRow label="Owner" value={detail.name} />
                <InfoRow label="Phone" value={`+${detail.phone}`} />
                <InfoRow label="Type" value={detail.role} />
                <InfoRow label="FSSAI #" value={detail.fssai_number || '—'} />
                <InfoRow label="GST #" value={detail.gst_number || '—'} />
                <InfoRow label="Address" value={detail.address || '—'} />
              </View>

              {/* Documents */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Documents</Text>
                {Object.entries(DOC_LABELS).map(([k, label]) => {
                  const val = detail.documents?.[k];
                  return (
                    <View key={k} style={styles.docRow}>
                      <Text style={styles.docLabel}>{label}</Text>
                      {val ? (
                        <TouchableOpacity onPress={() => Linking.openURL(String(val)).catch(() => {})}>
                          <Text style={styles.docView}>View ›</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.docMissing}>Missing</Text>
                      )}
                    </View>
                  );
                })}
                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.smBtn, styles.btnGreen]} disabled={busy} onPress={() => reviewDocs(true)}>
                    <Text style={styles.smBtnText}>Docs Verified</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smBtn, styles.btnRed]} disabled={busy} onPress={() => reviewDocs(false)}>
                    <Text style={styles.smBtnText}>Reject Docs</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Business checks */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Business Verification</Text>
                {Object.entries(CHECK_LABELS).map(([k, label]) => (
                  <TouchableOpacity key={k} style={styles.checkRow} onPress={() => setChecks({ ...checks, [k]: !checks[k] })}>
                    <Ionicons name={checks[k] ? 'checkbox' : 'square-outline'} size={22} color={checks[k] ? COLORS.success : COLORS.textMuted} />
                    <Text style={styles.checkLabel}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.smBtn, styles.btnPrimary, { marginTop: SPACING.sm }]} disabled={busy} onPress={saveBusiness}>
                  <Text style={styles.smBtnText}>Save Business Review</Text>
                </TouchableOpacity>
              </View>

              {/* History */}
              {detail.history?.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>History</Text>
                  {detail.history.slice().reverse().map((h: any, i: number) => (
                    <View key={i} style={styles.histRow}>
                      <Text style={styles.histAction}>{h.stage} · {h.action}</Text>
                      {h.reason ? <Text style={styles.histReason}>{h.reason}</Text> : null}
                      <Text style={styles.histTime}>{h.at ? new Date(h.at).toLocaleString() : ''}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Final decision */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Final Decision</Text>
                {detail.rejection_reason ? <Text style={styles.rejReason}>Last reason: {detail.rejection_reason}</Text> : null}
                <View style={styles.decisionGrid}>
                  <TouchableOpacity style={[styles.decBtn, styles.btnGreen]} disabled={busy} onPress={() => decide('approved')}>
                    <Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.smBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.decBtn, styles.btnRed]} disabled={busy} onPress={() => decide('rejected')}>
                    <Ionicons name="close" size={16} color="#fff" /><Text style={styles.smBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.decBtn, styles.btnRed]} disabled={busy} onPress={() => decide('suspended')}>
                    <Ionicons name="ban" size={16} color="#fff" /><Text style={styles.smBtnText}>Suspend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.decBtn, styles.btnWarn]} disabled={busy} onPress={() => decide('reverification_required')}>
                    <Ionicons name="refresh" size={16} color="#fff" /><Text style={styles.smBtnText}>Re-verify</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.note}>Approval is blocked until business verification is complete.</Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  countBadge: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 10 },
  countText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.sm },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm },
  rowTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  empty: { color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  bizName: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: SPACING.md },
  infoLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  infoValue: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  docLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text },
  docView: { fontSize: FONTS.sizes.sm, color: COLORS.success, fontWeight: '700' },
  docMissing: { fontSize: FONTS.sizes.sm, color: COLORS.error, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 7 },
  checkLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, flex: 1 },
  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  smBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  smBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.sm },
  btnGreen: { backgroundColor: COLORS.success },
  btnRed: { backgroundColor: COLORS.error },
  btnWarn: { backgroundColor: COLORS.warning },
  btnPrimary: { backgroundColor: COLORS.primary },
  histRow: { borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: SPACING.sm, paddingVertical: 4, marginBottom: 4 },
  histAction: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize' },
  histReason: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  histTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  rejReason: { fontSize: FONTS.sizes.sm, color: COLORS.error, marginBottom: SPACING.sm },
  decisionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  decBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: '47.5%', paddingVertical: 12, borderRadius: RADIUS.md },
  note: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.sm },
});

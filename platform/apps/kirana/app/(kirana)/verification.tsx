import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { verificationAPI } from '../../src/services/api';

const DOC_LABELS: Record<string, string> = {
  fssai_license: 'FSSAI License',
  gst_certificate: 'GST Certificate',
  pan_card: 'PAN Card',
  bank_account: 'Bank Account Details',
  cancelled_cheque: 'Cancelled Cheque',
  upi_details: 'UPI Details',
  owner_identity: 'Owner Identity Proof',
};

const DOC_PLACEHOLDERS: Record<string, string> = {
  fssai_license: 'FSSAI license number or doc URL',
  gst_certificate: 'GST number or certificate URL',
  pan_card: 'PAN number or doc URL',
  bank_account: 'Account number & IFSC',
  cancelled_cheque: 'Cheque image URL or reference',
  upi_details: 'UPI ID or VPA',
  owner_identity: 'Aadhaar / Passport URL',
};

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  registered:               { color: COLORS.textMuted,   icon: 'time-outline',            label: 'Not started' },
  documents_submitted:      { color: '#f59e0b',           icon: 'document-text-outline',   label: 'Documents submitted — awaiting review' },
  documents_verified:       { color: '#3b82f6',           icon: 'checkmark-circle-outline',label: 'Documents verified — business check pending' },
  business_verified:        { color: '#8b5cf6',           icon: 'business-outline',        label: 'Business verified — awaiting final approval' },
  approved:                 { color: COLORS.success,      icon: 'shield-checkmark',        label: 'Approved — you can receive orders!' },
  rejected:                 { color: COLORS.error,        icon: 'close-circle',            label: 'Rejected' },
  suspended:                { color: COLORS.error,        icon: 'ban',                     label: 'Suspended' },
  reverification_required:  { color: '#f59e0b',           icon: 'refresh-circle-outline',  label: 'Re-verification required' },
};

export default function KiranaVerificationScreen() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await verificationAPI.status();
      const data = res.data;
      setStatus(data);
      const submitted: Record<string, string> = {};
      for (const key of Object.keys(DOC_LABELS)) {
        if (data.documents_submitted?.[key]) submitted[key] = '✓ Already submitted';
      }
      setDocs(submitted);
    } catch {
      Alert.alert('Error', 'Could not load verification status');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSubmit = async () => {
    const toSubmit: Record<string, string> = {};
    for (const key of Object.keys(DOC_LABELS)) {
      const val = docs[key]?.trim();
      if (val && !val.startsWith('✓')) toSubmit[key] = val;
    }
    if (Object.keys(toSubmit).length === 0) {
      Alert.alert('No changes', 'Enter at least one new document to submit.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await verificationAPI.submitDocuments(toSubmit);
      setStatus(res.data);
      Alert.alert('Submitted', 'Documents submitted successfully. Admin will review shortly.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Verification</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const vs = status?.verification_status || 'registered';
  const cfg = STATUS_CONFIG[vs] || STATUS_CONFIG.registered;
  const canSubmit = ['registered', 'reverification_required'].includes(vs) ||
    (vs === 'documents_submitted' && status?.missing_documents?.length > 0);
  const allDone = vs === 'approved';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Verification</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Status card */}
        <View style={[styles.statusCard, { borderColor: cfg.color + '55' }]}>
          <Ionicons name={cfg.icon as any} size={36} color={cfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            {status?.rejection_reason ? (
              <Text style={styles.rejReason}>Reason: {status.rejection_reason}</Text>
            ) : null}
          </View>
        </View>

        {/* Steps progress */}
        <View style={styles.stepsCard}>
          {[
            { key: 'documents_submitted', label: 'Submit Documents' },
            { key: 'documents_verified',  label: 'Documents Reviewed' },
            { key: 'business_verified',   label: 'Store Verified' },
            { key: 'approved',            label: 'Approved' },
          ].map((step, i) => {
            const stages = ['registered','documents_submitted','documents_verified','business_verified','approved'];
            const currentIdx = stages.indexOf(vs);
            const stepIdx = stages.indexOf(step.key);
            const done = currentIdx >= stepIdx && currentIdx !== -1 && !['rejected','suspended'].includes(vs);
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={[styles.stepDot, done && styles.stepDotDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : (
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Document submission form */}
        {!allDone && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Required Documents</Text>
            <Text style={styles.cardSub}>
              {canSubmit
                ? 'Fill in details or paste document URLs for each required document.'
                : 'Your documents are under review by the admin.'}
            </Text>
            {Object.entries(DOC_LABELS).map(([key, label]) => {
              const submitted = status?.documents_submitted?.[key];
              return (
                <View key={key} style={styles.docBlock}>
                  <View style={styles.docHeader}>
                    <Text style={styles.docLabel}>{label}</Text>
                    {submitted ? (
                      <View style={styles.badge}>
                        <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
                        <Text style={styles.badgeText}>Submitted</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgeMissing]}>
                        <Text style={[styles.badgeText, { color: COLORS.error }]}>Missing</Text>
                      </View>
                    )}
                  </View>
                  {canSubmit && !submitted && (
                    <TextInput
                      style={styles.input}
                      value={docs[key] || ''}
                      onChangeText={(v) => setDocs({ ...docs, [key]: v })}
                      placeholder={DOC_PLACEHOLDERS[key]}
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="none"
                    />
                  )}
                </View>
              );
            })}
            {canSubmit && (
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Documents</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Approved banner */}
        {allDone && (
          <View style={styles.approvedBanner}>
            <Ionicons name="shield-checkmark" size={48} color={COLORS.success} />
            <Text style={styles.approvedTitle}>You're Shinitz Verified!</Text>
            <Text style={styles.approvedSub}>Your store is live and can receive orders.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.card, borderWidth: 1.5, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  statusLabel: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  rejReason: { fontSize: FONTS.sizes.sm, color: COLORS.error, marginTop: 2 },

  stepsCard: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepNum: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  stepLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  stepLabelDone: { color: COLORS.text, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md,
  },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  cardSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },

  docBlock: { marginBottom: SPACING.md },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  docLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text, flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: COLORS.success + '22' },
  badgeMissing: { backgroundColor: COLORS.error + '22' },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.success },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 10,
    color: COLORS.text, fontSize: FONTS.sizes.sm,
  },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.md },

  approvedBanner: {
    alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm,
    backgroundColor: COLORS.success + '11', borderWidth: 1, borderColor: COLORS.success + '44',
    borderRadius: RADIUS.xl,
  },
  approvedTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.success },
  approvedSub: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, textAlign: 'center' },
});

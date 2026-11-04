import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { verificationAPI } from '../services/api';

interface VerificationState {
  verification_status: string;
  selling_enabled: boolean;
  missing_documents: string[];
}

// Visual config per status
const CONFIG: Record<string, { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  approved:                { label: 'Shinitz Verified',        sub: 'Eligible to receive orders',        icon: 'shield-checkmark', color: COLORS.success },
  registered:              { label: 'Verification Pending',    sub: 'Submit your documents to begin',     icon: 'document-text-outline', color: COLORS.warning },
  documents_submitted:     { label: 'Documents Under Review',  sub: 'Admin is reviewing your documents',  icon: 'hourglass-outline', color: COLORS.info },
  documents_verified:      { label: 'Documents Verified',      sub: 'Business verification next',         icon: 'checkmark-circle-outline', color: COLORS.info },
  business_verified:       { label: 'Business Verified',       sub: 'Awaiting final approval',            icon: 'storefront-outline', color: COLORS.info },
  rejected:                { label: 'Verification Rejected',   sub: 'See reason & re-submit',             icon: 'close-circle', color: COLORS.error },
  suspended:               { label: 'Account Suspended',       sub: 'Contact support',                    icon: 'ban', color: COLORS.error },
  reverification_required: { label: 'Re-verification Needed',  sub: 'Please update your details',         icon: 'refresh-circle', color: COLORS.warning },
};

export function VerificationBadge() {
  const [state, setState] = useState<VerificationState | null>(null);

  const load = async () => {
    try {
      const res = await verificationAPI.status();
      setState(res.data);
    } catch {
      // partner has no verification (shouldn't happen) — render nothing
    }
  };

  useEffect(() => { load(); }, []);

  if (!state) return null;

  const cfg = CONFIG[state.verification_status] || CONFIG.registered;
  const approved = state.selling_enabled;

  return (
    <View style={[styles.card, { borderColor: cfg.color + '55', backgroundColor: cfg.color + '12' }]}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + '22' }]}>
        <Ionicons name={cfg.icon} size={24} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: cfg.color }]}>{cfg.label}</Text>
          {approved && <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />}
        </View>
        <Text style={styles.sub}>{cfg.sub}</Text>

        {/* Approved checklist (the spec's dashboard badges) */}
        {approved && (
          <View style={styles.checklist}>
            {['Verification Completed', 'Selling Permission Granted', 'Eligible To Receive Orders'].map((t) => (
              <View key={t} style={styles.checkRow}>
                <Ionicons name="checkmark" size={13} color={COLORS.success} />
                <Text style={styles.checkText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Missing docs hint */}
        {!approved && state.missing_documents?.length > 0 && (
          <Text style={styles.missing}>
            Missing: {state.missing_documents.map(d => d.replace(/_/g, ' ')).join(', ')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  iconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: FONTS.sizes.md, fontWeight: '800' },
  sub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 1 },
  checklist: { marginTop: SPACING.sm, gap: 3 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: '500' },
  missing: { fontSize: FONTS.sizes.xs, color: COLORS.error, marginTop: SPACING.xs, lineHeight: 16 },
});

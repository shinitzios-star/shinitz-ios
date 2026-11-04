import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';

/**
 * Payment Methods screen.
 *
 * Razorpay handles the whole tokenisation flow at checkout — we don't store
 * card details on our server, so there's nothing for the user to manage here.
 * Instead we show the supported methods and the trust badges that quick-
 * commerce apps surface to reassure users.
 */

interface MethodDef {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  color: string;
}

const METHODS: MethodDef[] = [
  { icon: 'phone-portrait',  label: 'UPI',         detail: 'GPay, PhonePe, Paytm, BHIM',     color: '#10b981' },
  { icon: 'card',            label: 'Credit Cards', detail: 'Visa, Mastercard, RuPay, Amex',  color: '#3b82f6' },
  { icon: 'wallet',          label: 'Debit Cards',  detail: 'All Indian banks accepted',      color: '#8b5cf6' },
  { icon: 'business',        label: 'Net Banking',  detail: '50+ banks supported',            color: '#f59e0b' },
  { icon: 'gift',            label: 'Wallets',      detail: 'Paytm, Mobikwik, Freecharge',    color: '#ec4899' },
  { icon: 'cash',            label: 'Cash on Delivery', detail: 'Pay when your order arrives', color: '#10b981' }, // semantic green (theme-independent)
];

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const TrustRow = ({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) => (
    <View style={styles.trustRow}>
      <View style={styles.trustIcon}>
        <Ionicons name={icon} size={18} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.trustTitle}>{title}</Text>
        <Text style={styles.trustSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={styles.hero}>
          <View style={styles.heroIconBg}>
            <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Secure Payments</Text>
          <Text style={styles.heroSubtitle}>
            All payments are processed securely by Razorpay.
            We never store your card details.
          </Text>
        </View>

        {/* Supported methods */}
        <Text style={styles.sectionLabel}>SUPPORTED METHODS</Text>
        <View style={styles.methodGrid}>
          {METHODS.map((m) => (
            <View key={m.label} style={styles.methodCard}>
              <View style={[styles.methodIcon, { backgroundColor: m.color + '18' }]}>
                <Ionicons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={styles.methodLabel}>{m.label}</Text>
              <Text style={styles.methodDetail} numberOfLines={2}>{m.detail}</Text>
            </View>
          ))}
        </View>

        {/* Trust badges */}
        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.trustCard}>
          <TrustRow
            icon="lock-closed"
            title="256-bit SSL Encryption"
            subtitle="Bank-grade encryption on every transaction"
          />
          <View style={styles.divider} />
          <TrustRow
            icon="ribbon"
            title="PCI-DSS Compliant"
            subtitle="Razorpay is PCI-DSS Level 1 certified"
          />
          <View style={styles.divider} />
          <TrustRow
            icon="card"
            title="No Card Storage"
            subtitle="Card details never touch our servers"
          />
          <View style={styles.divider} />
          <TrustRow
            icon="finger-print"
            title="OTP / 3D-Secure"
            subtitle="Every card payment is verified"
          />
        </View>

        {/* Payment history shortcut */}
        <TouchableOpacity
          style={styles.historyCard}
          onPress={() => router.push('/(consumer)/orders')}
          activeOpacity={0.85}
        >
          <View style={styles.historyLeft}>
            <View style={styles.historyIcon}>
              <Ionicons name="receipt" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.historyTitle}>Payment History</Text>
              <Text style={styles.historySubtitle}>View all past orders & receipts</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Razorpay badge */}
        <View style={styles.poweredBy}>
          <Text style={styles.poweredByLabel}>Powered by</Text>
          <Text style={styles.poweredByBrand}>Razorpay</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },

  content: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  heroIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },

  // Sections
  sectionLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.1,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },

  // Method grid
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  methodCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 110,
    ...SHADOWS.sm,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  methodLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  methodDetail: {
    fontSize: FONTS.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  // Trust card
  trustCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.sm,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: { fontSize: FONTS.sizes.md, fontWeight: '600', color: colors.text },
  trustSubtitle: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 2 },

  // History card
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.sm,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: { fontSize: FONTS.sizes.md, fontWeight: '600', color: colors.text },
  historySubtitle: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },

  // Powered by
  poweredBy: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  poweredByLabel: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  poweredByBrand: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
});

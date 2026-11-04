import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { contentAPI, referralAPI } from '../../src/services/api';

// Mirrors backend routes/content.py CONTENT_KEYS. Placeholder = the app default
// used when the field is left blank.
const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'home_tagline', label: 'Home tagline', placeholder: 'LOWEST PRICE GUARANTEED' },
  { key: 'rail_recommended', label: 'Section: Recommended', placeholder: 'Recommended For You' },
  { key: 'rail_offers', label: 'Section: Offers', placeholder: 'Personalized Offers' },
  { key: 'rail_cheap', label: 'Section: Cheap meals', placeholder: 'Meals under ₹99' },
  { key: 'rail_brands', label: 'Section: Brands', placeholder: 'Popular Brands' },
  { key: 'refer_badge_title', label: 'Refer badge title', placeholder: 'REFER & EARN' },
  { key: 'refer_badge_subtitle', label: 'Refer badge subtitle', placeholder: 'EARN ₹50' },
];

export default function AdminContentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [vals, setVals] = useState<Record<string, string> | null>(null);
  const [savingContent, setSavingContent] = useState(false);

  const [referral, setReferral] = useState<any>(null);
  const [savingReferral, setSavingReferral] = useState(false);

  useEffect(() => {
    contentAPI.adminGet()
      .then((r) => setVals(Object.fromEntries(FIELDS.map((f) => [f.key, r.data?.[f.key] || '']))))
      .catch(() => setVals(Object.fromEntries(FIELDS.map((f) => [f.key, '']))));
    referralAPI.getConfig()
      .then((r) => setReferral(r.data))
      .catch(() => setReferral(null));
  }, []);

  const saveContent = async () => {
    if (!vals) return;
    setSavingContent(true);
    try {
      await contentAPI.adminSet(vals);
      showToast({ type: 'success', message: 'Home content saved — live on next app refresh' });
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.detail || 'Could not save' });
    } finally {
      setSavingContent(false);
    }
  };

  const saveReferral = async () => {
    if (!referral) return;
    setSavingReferral(true);
    try {
      const r = await referralAPI.setConfig({
        enabled: !!referral.enabled,
        reward_amount: Number(referral.reward_amount) || 0,
        min_order_amount: Number(referral.min_order_amount) || 0,
      });
      setReferral((prev: any) => ({ ...prev, ...r.data }));
      showToast({ type: 'success', message: 'Referral settings saved' });
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.detail || 'Could not save' });
    } finally {
      setSavingReferral(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Content</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Home content */}
          <Text style={styles.sectionLabel}>HOME SCREEN TEXT</Text>
          <Text style={styles.sectionHint}>
            Change the consumer home wording without an app update. Leave a field blank to use the
            built-in default. Changes apply when the customer reopens the app.
          </Text>

          {!vals ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.xl }} />
          ) : (
            <View style={styles.card}>
              {FIELDS.map((f, i) => (
                <View key={f.key} style={[styles.field, i === FIELDS.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={vals[f.key]}
                    onChangeText={(t) => setVals((v) => ({ ...(v || {}), [f.key]: t }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, savingContent && { opacity: 0.6 }]}
                onPress={saveContent}
                disabled={savingContent}
                activeOpacity={0.85}
              >
                {savingContent
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveText}>Save home content</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Referral reward */}
          <Text style={styles.sectionLabel}>REFERRAL REWARD</Text>
          <Text style={styles.sectionHint}>
            Credited to the referrer when their invited friend completes their first order.
          </Text>

          {!referral ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.xl }} />
          ) : (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.fieldLabel}>Programme enabled</Text>
                <Switch
                  value={!!referral.enabled}
                  onValueChange={(v) => setReferral((p: any) => ({ ...p, enabled: v }))}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Reward amount (₹, below {referral.cap ?? 100})</Text>
                <TextInput
                  style={styles.input}
                  value={String(referral.reward_amount ?? '')}
                  onChangeText={(t) => setReferral((p: any) => ({ ...p, reward_amount: t.replace(/[^0-9.]/g, '') }))}
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={[styles.field, { borderBottomWidth: 0 }]}>
                <Text style={styles.fieldLabel}>Min order to qualify (₹, 0 = any)</Text>
                <TextInput
                  style={styles.input}
                  value={String(referral.min_order_amount ?? '')}
                  onChangeText={(t) => setReferral((p: any) => ({ ...p, min_order_amount: t.replace(/[^0-9.]/g, '') }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {referral.stats && (
                <Text style={styles.stats}>
                  {referral.stats.total_referrals} referrals · {referral.stats.rewarded} rewarded · ₹{referral.stats.total_paid} paid
                </Text>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, savingReferral && { opacity: 0.6 }]}
                onPress={saveReferral}
                disabled={savingReferral}
                activeOpacity={0.85}
              >
                {savingReferral
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveText}>Save referral settings</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Pointer to offers manager */}
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(admin)/offers' as any)} activeOpacity={0.7}>
            <Ionicons name="megaphone-outline" size={20} color={colors.primary} />
            <Text style={styles.linkText}>Manage offers & banners</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  sectionLabel: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.xs,
  },
  sectionHint: { fontSize: FONTS.sizes.sm, color: colors.textMuted, marginBottom: SPACING.sm, lineHeight: 19 },
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: colors.border,
  },
  field: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  fieldLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, fontSize: FONTS.sizes.md, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  rowBetween: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  stats: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: SPACING.sm },
  saveBtn: {
    marginTop: SPACING.md, backgroundColor: colors.primary, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg,
    backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: colors.border,
  },
  linkText: { flex: 1, fontSize: FONTS.sizes.md, fontWeight: '600', color: colors.text },
});

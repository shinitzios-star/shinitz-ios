import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { adAPI } from '../../src/services/api';

const OBJECTIVES = [
  { key: 'more_orders', label: 'More Orders', icon: 'cart' },
  { key: 'more_visibility', label: 'More Visibility', icon: 'eye' },
  { key: 'new_customer_reach', label: 'New Customers', icon: 'people' },
  { key: 'promote_offers', label: 'Promote Offers', icon: 'pricetag' },
];
const SEGMENTS = [
  { key: 'new_users', label: 'New users' },
  { key: 'returning_users', label: 'Returning users' },
  { key: 'high_order_customers', label: 'High-order customers' },
];
const PLACEMENTS = [
  { key: 'homepage_banner', label: 'Homepage Banner', icon: 'image' },
  { key: 'top_featured', label: 'Top Featured', icon: 'star' },
  { key: 'search_promotion', label: 'Search Promotion', icon: 'search' },
  { key: 'category_promotion', label: 'Category Promotion', icon: 'grid' },
  { key: 'recommendation_feed', label: 'Recommendation Feed', icon: 'sparkles' },
];
const RADII = [1, 3, 5, 10, 15, 20];
const STEPS = ['Details', 'Audience', 'Placement', 'Budget', 'Duration'];

export default function CampaignCreateScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name: '', objective: 'more_orders',
    radius_km: 5, segments: [] as string[],
    placements: ['top_featured'] as string[],
    budget_type: 'total', amount: '', daily_amount: '',
    start_date: '', end_date: '', schedule_time: '',
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggle = (k: string, v: string) =>
    setForm((f: any) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v] }));

  // Live estimate on the budget step.
  useEffect(() => {
    if (step !== 3) return;
    const amt = parseFloat(form.amount) || 0;
    adAPI.estimate(form.radius_km, amt).then((r) => setEstimate(r.data)).catch(() => setEstimate(null));
  }, [step, form.amount, form.radius_km]);

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 2) return form.placements.length > 0;
    if (step === 3) return (parseFloat(form.amount) || 0) >= 100;
    return true;
  };

  const launch = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        objective: form.objective,
        audience: { radius_km: form.radius_km, segments: form.segments },
        placements: form.placements,
        budget: { type: form.budget_type, amount: parseFloat(form.amount) || 0,
                  daily_amount: parseFloat(form.daily_amount) || 0 },
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        schedule_time: form.schedule_time || null,
      };
      const res = await adAPI.create(body);
      await adAPI.submit(res.data.campaign.id);
      Alert.alert('Campaign launched 🚀', 'Your promotion is live (or scheduled).');
      router.replace('/(restaurant)/campaigns');
    } catch (e: any) {
      Alert.alert('Could not launch', e?.response?.data?.detail || 'Please check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step === 0 ? router.back() : setStep(step - 1))} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Campaign</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step progress */}
      <View style={styles.steps}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotOn]}>
              {i < step ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[styles.stepNum, i === step && { color: '#fff' }]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, i === step && { color: COLORS.primary, fontWeight: '800' }]}>{label}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <Label text="Campaign name" />
              <TextInput value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Weekend Biryani Boost"
                placeholderTextColor={COLORS.textMuted} style={styles.input} />
              <Label text="Objective" />
              {OBJECTIVES.map((o) => (
                <Selectable key={o.key} icon={o.icon} label={o.label} on={form.objective === o.key}
                  onPress={() => set('objective', o.key)} />
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <Label text="Target radius" />
              <View style={styles.wrap}>
                {RADII.map((r) => (
                  <Chip key={r} label={`${r} km`} on={form.radius_km === r} onPress={() => set('radius_km', r)} />
                ))}
              </View>
              <Label text="Audience segments (optional)" />
              {SEGMENTS.map((s) => (
                <Selectable key={s.key} label={s.label} on={form.segments.includes(s.key)}
                  onPress={() => toggle('segments', s.key)} check />
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <Label text="Where should the ad appear?" />
              {PLACEMENTS.map((p) => (
                <Selectable key={p.key} icon={p.icon} label={p.label} on={form.placements.includes(p.key)}
                  onPress={() => toggle('placements', p.key)} check />
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <Label text="Budget type" />
              <View style={styles.wrap}>
                <Chip label="Total budget" on={form.budget_type === 'total'} onPress={() => set('budget_type', 'total')} />
                <Chip label="Daily budget" on={form.budget_type === 'daily'} onPress={() => set('budget_type', 'daily')} />
              </View>
              <Label text="Total budget (₹, min 100)" />
              <TextInput value={form.amount} onChangeText={(v) => set('amount', v.replace(/[^\d]/g, ''))}
                keyboardType="number-pad" placeholder="500" placeholderTextColor={COLORS.textMuted} style={styles.input} />
              {form.budget_type === 'daily' && (
                <>
                  <Label text="Daily cap (₹)" />
                  <TextInput value={form.daily_amount} onChangeText={(v) => set('daily_amount', v.replace(/[^\d]/g, ''))}
                    keyboardType="number-pad" placeholder="100" placeholderTextColor={COLORS.textMuted} style={styles.input} />
                </>
              )}
              {estimate && (
                <Card style={styles.estCard}>
                  <Text style={styles.estTitle}>Estimated performance</Text>
                  <View style={styles.estRow}>
                    <Est value={estimate.reach} label="Reach" />
                    <Est value={estimate.expected_orders} label="Est. orders" />
                    <Est value={`${estimate.visibility_score}%`} label="Visibility" />
                  </View>
                </Card>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <Label text="Start date (optional — blank = start now)" />
              <TextInput value={form.start_date} onChangeText={(v) => set('start_date', v)} placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted} style={styles.input} autoCapitalize="none" />
              <Label text="End date (optional)" />
              <TextInput value={form.end_date} onChangeText={(v) => set('end_date', v)} placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted} style={styles.input} autoCapitalize="none" />
              <Label text="Schedule time (optional)" />
              <TextInput value={form.schedule_time} onChangeText={(v) => set('schedule_time', v)} placeholder="e.g. 18:00"
                placeholderTextColor={COLORS.textMuted} style={styles.input} autoCapitalize="none" />
              <Card style={styles.review}>
                <Text style={styles.estTitle}>Review</Text>
                <ReviewRow k="Name" v={form.name} />
                <ReviewRow k="Objective" v={form.objective.replace(/_/g, ' ')} />
                <ReviewRow k="Radius" v={`${form.radius_km} km`} />
                <ReviewRow k="Placements" v={`${form.placements.length} selected`} />
                <ReviewRow k="Budget" v={`₹${form.amount || 0} (${form.budget_type})`} />
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity disabled={!canNext()} onPress={() => setStep(step + 1)}
            style={[styles.nextBtn, !canNext() && styles.nextBtnOff]}>
            <Text style={styles.nextText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity disabled={saving} onPress={launch} style={styles.nextBtn}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextText}>Launch Campaign 🚀</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const Label = ({ text }: any) => <Text style={styles.label}>{text}</Text>;
const Chip = ({ label, on, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
  </TouchableOpacity>
);
const Selectable = ({ icon, label, on, onPress, check }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.sel, on && styles.selOn]}>
    {icon ? <Ionicons name={icon} size={18} color={on ? COLORS.primary : COLORS.textSecondary} /> : null}
    <Text style={[styles.selText, on && { color: COLORS.primary, fontWeight: '800' }]}>{label}</Text>
    <View style={{ flex: 1 }} />
    <Ionicons name={check ? (on ? 'checkbox' : 'square-outline') : (on ? 'radio-button-on' : 'radio-button-off')}
      size={20} color={on ? COLORS.primary : COLORS.textMuted} />
  </TouchableOpacity>
);
const Est = ({ value, label }: any) => (
  <View style={styles.est}><Text style={styles.estValue}>{value}</Text><Text style={styles.estLabel}>{label}</Text></View>
);
const ReviewRow = ({ k, v }: any) => (
  <View style={styles.reviewRow}><Text style={styles.reviewK}>{k}</Text><Text style={styles.reviewV} numberOfLines={1}>{v}</Text></View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  steps: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepDotOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary },
  stepLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
  content: { padding: SPACING.md },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, fontSize: FONTS.sizes.md, color: COLORS.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  chipText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.primary },
  sel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: SPACING.sm },
  selOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0c' },
  selText: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text },
  estCard: { padding: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.primary + '0c' },
  estTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  estRow: { flexDirection: 'row', justifyContent: 'space-between' },
  est: { alignItems: 'center', flex: 1 },
  estValue: { fontSize: FONTS.sizes.lg, fontWeight: '900', color: COLORS.primary },
  estLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  review: { padding: SPACING.md, marginTop: SPACING.md },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reviewK: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  reviewV: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, textTransform: 'capitalize', maxWidth: '60%' },
  footer: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md, ...SHADOWS.sm },
  nextBtnOff: { backgroundColor: COLORS.textMuted },
  nextText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
});

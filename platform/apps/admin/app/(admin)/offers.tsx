import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Switch, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { offersAPI } from '../../src/services/api';

interface Offer {
  id: string;
  title: string;
  subtitle?: string;
  code?: string;
  image?: string;
  active: boolean;
  priority: number;
}

const EMPTY = { title: '', subtitle: '', code: '', image: '', priority: 0, active: true };

export default function AdminOffersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = useCallback(async () => {
    try {
      const r = await offersAPI.adminList();
      setOffers(r.data || []);
    } catch {
      // leave list as-is
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reset = () => { setForm(EMPTY); setEditId(null); };

  const edit = (o: Offer) => {
    setEditId(o.id);
    setForm({
      title: o.title, subtitle: o.subtitle || '', code: o.code || '',
      image: o.image || '', priority: o.priority || 0, active: o.active,
    });
  };

  const save = async () => {
    if (!form.title.trim()) { showToast({ type: 'error', message: 'Title is required' }); return; }
    setSaving(true);
    try {
      const payload = { ...form, priority: Number(form.priority) || 0 };
      if (editId) await offersAPI.update(editId, payload);
      else await offersAPI.create(payload);
      showToast({ type: 'success', message: editId ? 'Offer updated' : 'Offer created' });
      reset();
      await load();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.detail || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (o: Offer) => {
    try { await offersAPI.update(o.id, { ...o, active: !o.active }); await load(); }
    catch (e: any) { showToast({ type: 'error', message: 'Could not update' }); }
  };

  const remove = (o: Offer) => {
    Alert.alert('Delete offer', `Delete "${o.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await offersAPI.remove(o.id); await load(); }
          catch { showToast({ type: 'error', message: 'Could not delete' }); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offers & Banners</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Create / edit */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{editId ? 'Edit offer' : 'New offer'}</Text>
              {editId && (
                <TouchableOpacity onPress={reset}><Text style={styles.cancelEdit}>Cancel</Text></TouchableOpacity>
              )}
            </View>

            <Field label="Title *" value={form.title} onChange={(v: string) => setForm((f: any) => ({ ...f, title: v }))} placeholder="50% OFF first order" styles={styles} colors={colors} />
            <Field label="Subtitle" value={form.subtitle} onChange={(v: string) => setForm((f: any) => ({ ...f, subtitle: v }))} placeholder="On orders above ₹199" styles={styles} colors={colors} />
            <Field label="Promo code" value={form.code} onChange={(v: string) => setForm((f: any) => ({ ...f, code: v.toUpperCase() }))} placeholder="WELCOME50" styles={styles} colors={colors} />
            <Field label="Image URL (optional)" value={form.image} onChange={(v: string) => setForm((f: any) => ({ ...f, image: v }))} placeholder="https://…" styles={styles} colors={colors} />
            <Field label="Priority" value={String(form.priority)} onChange={(v: string) => setForm((f: any) => ({ ...f, priority: v.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType="numeric" styles={styles} colors={colors} />

            <View style={styles.rowBetween}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch
                value={!!form.active}
                onValueChange={(v) => setForm((f: any) => ({ ...f, active: v }))}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.saveText}>{editId ? 'Save changes' : 'Create offer'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* List */}
          <Text style={styles.sectionLabel}>ALL OFFERS</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.lg }} />
          ) : offers.length === 0 ? (
            <Text style={styles.empty}>No offers yet</Text>
          ) : (
            offers.map((o) => (
              <View key={o.id} style={styles.offerRow}>
                {o.image
                  ? <Image source={{ uri: o.image }} style={styles.offerImg} />
                  : <View style={[styles.offerImg, styles.offerImgEmpty]}><Ionicons name="megaphone" size={20} color={colors.primary} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerTitle} numberOfLines={1}>{o.title}</Text>
                  {!!o.subtitle && <Text style={styles.offerSub} numberOfLines={1}>{o.subtitle}</Text>}
                  <View style={styles.offerMeta}>
                    {!!o.code && <Text style={styles.offerCode}>{o.code}</Text>}
                    <View style={[styles.statusPill, { backgroundColor: (o.active ? colors.success : colors.textMuted) + '22' }]}>
                      <Text style={[styles.statusText, { color: o.active ? colors.success : colors.textMuted }]}>
                        {o.active ? 'Active' : 'Off'}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => toggle(o)} style={styles.iconBtn}>
                  <Ionicons name={o.active ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => edit(o)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(o)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, styles, colors }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
      />
    </View>
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
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: colors.border, marginTop: SPACING.sm,
  },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text },
  cancelEdit: { fontSize: FONTS.sizes.sm, color: colors.textMuted, fontWeight: '600' },
  field: { paddingVertical: SPACING.xs },
  fieldLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, fontSize: FONTS.sizes.md, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  saveBtn: { marginTop: SPACING.md, backgroundColor: colors.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  sectionLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  empty: { fontSize: FONTS.sizes.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: SPACING.lg },
  offerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.card,
    borderRadius: RADIUS.lg, padding: SPACING.sm, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.sm,
  },
  offerImg: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: colors.surface },
  offerImgEmpty: { justifyContent: 'center', alignItems: 'center' },
  offerTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text },
  offerSub: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  offerMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  offerCode: { fontSize: 11, fontWeight: '700', color: colors.text, backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
});

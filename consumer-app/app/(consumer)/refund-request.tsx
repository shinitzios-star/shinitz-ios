import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { refundAPI, RefundReason } from '../../src/services/api';

const MAX_IMAGES = 3;

export default function RefundRequestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [windowDays, setWindowDays] = useState(7);
  const [reasons, setReasons] = useState<RefundReason[]>([]);
  const [reasonCode, setReasonCode] = useState<string>('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await refundAPI.eligibility(orderId);
      setAmount(data.amount ?? 0);
      setWindowDays(data.window_days ?? 7);
      setReasons(data.reasons ?? []);
      if (data.eligible) {
        setEligible(true);
      } else if (data.reason === 'already_requested' && data.existing_refund_id) {
        // Duplicate protection: jump straight to the existing request.
        router.replace({ pathname: '/(consumer)/refund-detail', params: { refundId: data.existing_refund_id } });
        return;
      } else {
        setEligible(false);
        setBlockedMsg(data.message || t('refund.notEligible'));
      }
    } catch (e: any) {
      setBlockedMsg(e?.response?.data?.detail || t('refund.loadError'));
    } finally {
      setLoading(false);
    }
  }, [orderId, router, t]);

  useEffect(() => { load(); }, [load]);

  const addImage = async (fromCamera: boolean) => {
    if (images.length >= MAX_IMAGES) return;
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast({ type: 'warning', message: t('refund.permissionDenied') });
        return;
      }
      const opts = { quality: 0.5, base64: true } as const;
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) { showToast({ type: 'error', message: t('refund.imageReadError') }); return; }
      if (asset.base64.length > 2_800_000) {
        showToast({ type: 'warning', message: t('refund.imageTooLarge') });
        return;
      }
      setImages((prev) => [...prev, `data:image/jpeg;base64,${asset.base64}`]);
    } catch {
      showToast({ type: 'error', message: t('refund.imagePickError') });
    }
  };

  const pickImage = () => {
    Alert.alert(t('refund.addPhoto'), undefined, [
      { text: t('refund.camera'), onPress: () => addImage(true) },
      { text: t('refund.gallery'), onPress: () => addImage(false) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!reasonCode) { showToast({ type: 'warning', message: t('refund.pickReason') }); return; }
    if (reasonCode === 'other' && !description.trim()) {
      showToast({ type: 'warning', message: t('refund.describeOther') });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await refundAPI.create(orderId, {
        reason_code: reasonCode,
        description: description.trim() || undefined,
        evidence: images.length ? images : undefined,
      });
      showToast({ type: 'success', message: t('refund.submitted') });
      const rid = data?.refund?.id;
      if (rid) {
        router.replace({ pathname: '/(consumer)/refund-detail', params: { refundId: rid } });
      } else {
        router.back();
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 409) {
        // Already requested in a race — go find it.
        showToast({ type: 'info', message: detail || t('refund.alreadyRequested') });
        router.replace('/(consumer)/refunds');
      } else {
        showToast({ type: 'error', message: detail || t('refund.submitError') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{t('refund.requestTitle')}</Text>
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

  if (!eligible) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <Ionicons name="information-circle-outline" size={54} color={colors.textMuted} />
          <Text style={[styles.blockedText, { color: colors.textSecondary }]}>{blockedMsg}</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {Header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Amount banner */}
        <View style={[styles.amountCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          <Ionicons name="cash-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>{t('refund.refundableAmount')}</Text>
            <Text style={[styles.amountValue, { color: colors.primary }]}>₹{amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Reasons */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('refund.whyRefund')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {reasons.map((r, i) => {
            const selected = reasonCode === r.code;
            return (
              <TouchableOpacity
                key={r.code}
                style={[styles.reasonRow, i < reasons.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={() => setReasonCode(r.code)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22} color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.reasonText, { color: colors.text }]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('refund.details')} <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
            {reasonCode === 'other' ? t('refund.required') : t('refund.optional')}
          </Text>
        </Text>
        <TextInput
          style={[styles.descInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={t('refund.detailsPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
        />

        {/* Evidence */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('refund.photos')} <Text style={{ color: colors.textMuted, fontWeight: '400' }}>{t('refund.optional')}</Text>
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('refund.photosHint')}</Text>
        <View style={styles.imagesRow}>
          {images.map((uri, idx) => (
            <View key={idx} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(idx)}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <TouchableOpacity style={[styles.addPhoto, { borderColor: colors.border }]} onPress={pickImage}>
              <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
              <Text style={[styles.addPhotoText, { color: colors.textMuted }]}>{t('refund.add')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('refund.disclaimer', { days: windowDays })}
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }, (submitting || !reasonCode) && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting || !reasonCode}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.primaryBtnText}>{t('refund.submitRequest')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700' },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  blockedText: { fontSize: FONTS.sizes.md, textAlign: 'center', lineHeight: 22 },
  amountCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md },
  amountLabel: { fontSize: FONTS.sizes.xs },
  amountValue: { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', marginTop: SPACING.sm },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 14, paddingHorizontal: SPACING.md },
  reasonText: { flex: 1, fontSize: FONTS.sizes.md },
  descInput: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 90, textAlignVertical: 'top', fontSize: FONTS.sizes.md },
  hint: { fontSize: FONTS.sizes.xs, marginTop: -2 },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  thumbWrap: { position: 'relative' },
  thumb: { width: 78, height: 78, borderRadius: RADIUS.md },
  thumbRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  addPhoto: { width: 78, height: 78, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 2 },
  addPhotoText: { fontSize: FONTS.sizes.xs },
  disclaimer: { fontSize: FONTS.sizes.xs, lineHeight: 17, marginTop: SPACING.sm },
  primaryBtn: { borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  primaryBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },
});

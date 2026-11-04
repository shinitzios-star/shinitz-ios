// ─────────────────────────────────────────────────────────────────────────────
// Delete Account — Google Play–compliant, OTP-confirmed, irreversible.
// Flow: consequences → send OTP to the signed-in phone → confirm OTP →
// server soft-deletes + purges PII → local logout + storage wipe.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { useAuthStore } from '../../src/store/authStore';
import { useCartStore } from '../../src/store/cartStore';
import { authAPI } from '../../src/services/api';

type Step = 'review' | 'otp' | 'done';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useAuthStore();
  const { clearCart } = useCartStore();

  const [step, setStep] = useState<Step>('review');
  const [otp, setOtp] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const doneAnim = useRef(new Animated.Value(0)).current;

  const maskedPhone = user?.phone ? `••••••${String(user.phone).slice(-4)}` : '';

  const startResendTimer = () => {
    setResendIn(30);
    const id = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!user?.phone || busy) return;
    setBusy(true);
    setError(null);
    try {
      await authAPI.sendOTP(user.phone);
      setStep('otp');
      startResendTimer();
    } catch (e: any) {
      setError(e?.response?.data?.detail || t('deleteOtpSendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    // Final gate — a second explicit confirmation before the irreversible call.
    Alert.alert(t('deleteFinalTitle'), t('deleteFinalMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('deleteFinalConfirm'), style: 'destructive', onPress: doDelete },
    ]);
  };

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await authAPI.deleteAccount(otp.trim(), reason.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('done');
      Animated.spring(doneAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }).start();
      // Local cleanup after a beat so the success state is visible, then out.
      setTimeout(async () => {
        clearCart();
        await logout();
        router.replace('/');
      }, 2200);
    } catch (e: any) {
      setError(e?.response?.data?.detail || t('deleteFailed'));
      setBusy(false);
    }
  };

  const CONSEQUENCES: { icon: any; text: string }[] = [
    { icon: 'location-outline', text: t('deleteLoseAddresses') },
    { icon: 'heart-outline', text: t('deleteLoseFavorites') },
    { icon: 'gift-outline', text: t('deleteLoseReferrals') },
    { icon: 'receipt-outline', text: t('deleteOrdersRetained') },
    { icon: 'refresh-circle-outline', text: t('deleteNoRecovery') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('deleteAccount')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {step === 'done' ? (
        <Animated.View style={[styles.doneWrap, {
          opacity: doneAnim,
          transform: [{ scale: doneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }]}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={styles.doneTitle}>{t('deleteDoneTitle')}</Text>
          <Text style={styles.doneSub}>{t('deleteDoneMsg')}</Text>
        </Animated.View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}>
          {/* Warning hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="warning" size={30} color={colors.error} />
            </View>
            <Text style={styles.heroTitle}>{t('deleteHeroTitle')}</Text>
            <Text style={styles.heroSub}>{t('deleteHeroMsg')}</Text>
          </View>

          {/* Consequences */}
          <Card style={{ marginTop: SPACING.md }}>
            <Text style={styles.listTitle}>{t('deleteWhatHappens')}</Text>
            {CONSEQUENCES.map((c, i) => (
              <View key={i} style={[styles.conseqRow, i === CONSEQUENCES.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons name={c.icon} size={19} color={colors.textSecondary} />
                <Text style={styles.conseqText}>{c.text}</Text>
              </View>
            ))}
          </Card>

          {step === 'review' && (
            <Card style={{ marginTop: SPACING.md }}>
              <Text style={styles.listTitle}>{t('deleteReasonLabel')}</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder={t('deleteReasonPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={500}
              />
            </Card>
          )}

          {step === 'otp' && (
            <Card style={{ marginTop: SPACING.md }}>
              <Text style={styles.listTitle}>{t('deleteOtpTitle', { phone: maskedPhone })}</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="• • • • • •"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(v) => { setOtp(v.replace(/\D/g, '')); setError(null); }}
                autoFocus
              />
              <TouchableOpacity disabled={resendIn > 0 || busy} onPress={sendOtp}>
                <Text style={[styles.resend, resendIn > 0 && { color: colors.textMuted }]}>
                  {resendIn > 0 ? t('resendOtpIn', { seconds: resendIn }) : t('resendOtp')}
                </Text>
              </TouchableOpacity>
            </Card>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Actions */}
          {step === 'review' ? (
            <TouchableOpacity style={[styles.dangerBtn, busy && styles.disabled]} disabled={busy} onPress={sendOtp}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.dangerText}>{t('deleteContinue')}</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.dangerBtn, (otp.length < 4 || busy) && styles.disabled]}
              disabled={otp.length < 4 || busy}
              onPress={confirmDelete}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="trash" size={18} color="#fff" />
                  <Text style={styles.dangerText}>{t('deleteConfirmBtn')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.keepBtn} onPress={() => router.back()}>
            <Text style={styles.keepText}>{t('deleteKeepAccount')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.text },
  hero: { alignItems: 'center', paddingTop: SPACING.lg },
  heroIcon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.error + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: colors.text },
  heroSub: {
    fontSize: FONTS.sizes.md, color: colors.textSecondary, textAlign: 'center',
    marginTop: SPACING.xs, lineHeight: 21, paddingHorizontal: SPACING.md,
  },
  listTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text, marginBottom: SPACING.sm },
  conseqRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  conseqText: { flex: 1, fontSize: FONTS.sizes.sm, color: colors.textSecondary, lineHeight: 19 },
  reasonInput: {
    backgroundColor: colors.surfaceLight, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: colors.border,
    fontSize: FONTS.sizes.sm, color: colors.text, minHeight: 72,
    textAlignVertical: 'top', padding: SPACING.sm, marginTop: SPACING.xs,
  },
  otpInput: {
    backgroundColor: colors.surfaceLight, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: colors.border,
    fontSize: 24, fontWeight: '800', letterSpacing: 10, color: colors.text,
    textAlign: 'center', paddingVertical: 12, marginTop: SPACING.xs,
  },
  resend: { color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: SPACING.md, fontSize: FONTS.sizes.sm },
  error: { color: colors.error, textAlign: 'center', marginTop: SPACING.md, fontSize: FONTS.sizes.sm },
  dangerBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.error,
    borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  dangerText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  disabled: { opacity: 0.5 },
  keepBtn: { alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.xs },
  keepText: { color: colors.primary, fontWeight: '700', fontSize: FONTS.sizes.md },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  doneIcon: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  doneTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: colors.text },
  doneSub: { fontSize: FONTS.sizes.md, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.xs },
});

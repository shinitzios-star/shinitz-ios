import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuthStore } from '../../src/store/authStore';
import { processOnlinePayment } from '../../src/services/payment';
import type { PaymentResult } from '../../src/types/payment';

export default function PaymentFailedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    orderId: string;
    amount: string;
    errorMessage?: string;
    errorCode?: string;
  }>();
  const { user } = useAuthStore();

  const {
    orderId = '',
    amount = '0',
    errorMessage = 'Your payment could not be processed.',
    errorCode,
  } = params;

  const displayAmount = parseFloat(amount).toFixed(0);
  const isCancelled = errorCode === '0';

  const [retrying, setRetrying] = useState(false);

  // ── Shake animation ────────────────────────────────────────────────────────
  const shakeX = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // Icon appears with spring
    Animated.spring(iconScale, {
      toValue: 1,
      tension: 60,
      friction: 6,
      useNativeDriver: true,
    }).start(() => {
      // Then shake to indicate error
      if (!isCancelled) {
        Animated.sequence([
          Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }
    });

    // Content slides up
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350,
        delay: 350,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlide, {
        toValue: 0,
        duration: 350,
        delay: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRetry = async () => {
    if (!user || retrying) return;
    setRetrying(true);

    const result: PaymentResult = await processOnlinePayment({
      orderId,
      amount: parseFloat(amount),
      userName: user.name,
      userPhone: user.phone,
    });

    setRetrying(false);

    if (result.success) {
      router.replace({
        pathname: '/(consumer)/payment-success',
        params: {
          orderId,
          paymentId: result.paymentId ?? '',
          amount,
          method: 'online',
        },
      });
    } else if (!result.cancelled) {
      // Update error message in params by re-navigating
      router.replace({
        pathname: '/(consumer)/payment-failed',
        params: {
          orderId,
          amount,
          errorMessage: result.errorMessage ?? 'Payment failed',
          errorCode: String(result.errorCode ?? -1),
        },
      });
    }
    // If cancelled, stay on this screen
  };

  const InfoRow = ({ label, value, error }: { label: string; value: string; error?: boolean }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, error && { color: colors.error }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.iconCircle,
              {
                transform: [{ scale: iconScale }, { translateX: shakeX }],
                backgroundColor: isCancelled ? colors.warning + '15' : colors.error + '12',
              },
            ]}
          >
            <Ionicons
              name={isCancelled ? 'close-circle' : 'alert-circle'}
              size={64}
              color={isCancelled ? colors.warning : colors.error}
            />
          </Animated.View>

          <Text style={styles.headline}>
            {isCancelled ? 'Payment Cancelled' : 'Payment Failed'}
          </Text>
          <Text style={styles.subheadline}>
            {isCancelled
              ? 'You cancelled the payment. Your order has not been charged.'
              : 'Something went wrong. No amount has been deducted.'}
          </Text>
        </View>

        {/* ── Error card ── */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentSlide }],
            },
          ]}
        >
          {!isCancelled && (
            <View style={styles.errorBanner}>
              <Ionicons name="information-circle" size={18} color={colors.error} />
              <Text style={styles.errorBannerText} numberOfLines={3}>
                {errorMessage}
              </Text>
            </View>
          )}

          <InfoRow label="Order ID" value={`#${orderId.slice(-8).toUpperCase()}`} />
          <InfoRow label="Amount" value={`₹${displayAmount}`} />
          <InfoRow label="Status" value={isCancelled ? 'Cancelled' : 'Failed'} error={!isCancelled} />

          <View style={styles.safeNote}>
            <Ionicons name="shield-checkmark" size={15} color={colors.success} />
            <Text style={styles.safeNoteText}>
              No money has been deducted from your account.
            </Text>
          </View>
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
          }}
        >
          {/* Retry button */}
          <TouchableOpacity
            style={[styles.retryBtn, retrying && styles.btnDisabled]}
            onPress={handleRetry}
            disabled={retrying}
            activeOpacity={0.85}
          >
            {retrying ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.retryBtnText}>Retry Payment</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Back to cart */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(consumer)/cart')}
            activeOpacity={0.7}
            disabled={retrying}
          >
            <Ionicons name="cart-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryBtnText}>Back to Cart</Text>
          </TouchableOpacity>

          {/* Go home */}
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => router.replace('/(consumer)/home')}
            disabled={retrying}
          >
            <Text style={styles.ghostBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  headline: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: colors.error + '10',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: colors.error,
    fontWeight: '500',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FONTS.sizes.md,
    color: colors.text,
    fontWeight: '700',
  },
  safeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  safeNoteText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: colors.success,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.lg,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: SPACING.sm,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  ghostBtnText: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

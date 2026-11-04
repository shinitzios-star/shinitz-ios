import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useCartStore } from '../../src/store/cartStore';

// ─── Particle ─────────────────────────────────────────────────────────────────

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
}

const PARTICLE_COLORS = ['#D4AF37', '#10b981', '#0F3D2E', '#f59e0b', '#3b82f6'];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  }));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    orderId: string;
    paymentId?: string;
    amount: string;
    method?: string;
  }>();
  const { clearCart } = useCartStore();

  const { orderId = '', paymentId = '', amount = '0', method = 'online' } = params;
  const isCOD = method === 'cod';
  const displayAmount = parseFloat(amount).toFixed(0);

  // ── Animations ────────────────────────────────────────────────────────────
  const circleScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const particles = useRef(makeParticles(12)).current;

  useEffect(() => {
    clearCart();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 1. Circle pops in
    Animated.spring(circleScale, {
      toValue: 1,
      tension: 60,
      friction: 6,
      useNativeDriver: true,
    }).start();

    // 2. Checkmark fades in
    Animated.timing(checkOpacity, {
      toValue: 1,
      duration: 300,
      delay: 250,
      useNativeDriver: true,
    }).start();

    // 3. Content slides up
    Animated.parallel([
      Animated.timing(contentSlide, {
        toValue: 0,
        duration: 400,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 4. Confetti burst
    particles.forEach((p, i) => {
      const angle = (i / particles.length) * 2 * Math.PI;
      const radius = 80 + Math.random() * 60;
      Animated.sequence([
        Animated.delay(300 + i * 40),
        Animated.parallel([
          Animated.spring(p.x, {
            toValue: Math.cos(angle) * radius,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(p.y, {
            toValue: Math.sin(angle) * radius - 20,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(p.scale, {
            toValue: 0.8 + Math.random() * 0.4,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.delay(600),
            Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, []);

  const DetailRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <View style={styles.heroSection}>

          {/* Confetti particles */}
          <View style={styles.particleContainer} pointerEvents="none">
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    backgroundColor: p.color,
                    borderRadius: i % 3 === 0 ? 4 : 2,
                    width: i % 2 === 0 ? 10 : 7,
                    height: i % 2 === 0 ? 10 : 7,
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { scale: p.scale },
                    ],
                    opacity: p.opacity,
                  },
                ]}
              />
            ))}
          </View>

          {/* Success circle */}
          <Animated.View
            style={[styles.successCircle, { transform: [{ scale: circleScale }] }]}
          >
            <Animated.View style={{ opacity: checkOpacity }}>
              <Ionicons name="checkmark" size={56} color="#ffffff" />
            </Animated.View>
          </Animated.View>

          <Text style={styles.headline}>
            {isCOD ? 'Order Placed!' : 'Payment Successful!'}
          </Text>
          <Text style={styles.subheadline}>
            {isCOD
              ? 'Your order is confirmed and being processed'
              : 'Your payment was processed securely'}
          </Text>
        </View>

        {/* ── Details card ── */}
        <Animated.View
          style={[
            styles.detailsCard,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentSlide }],
            },
          ]}
        >
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount Paid</Text>
            <Text style={styles.amountValue}>₹{displayAmount}</Text>
          </View>

          <View style={styles.divider} />

          <DetailRow
            icon="receipt-outline"
            label="Order ID"
            value={`#${orderId.slice(-8).toUpperCase()}`}
          />

          {!isCOD && paymentId ? (
            <DetailRow
              icon="card-outline"
              label="Payment ID"
              value={paymentId.slice(-12).toUpperCase()}
            />
          ) : null}

          <DetailRow
            icon="cash-outline"
            label="Payment Method"
            value={isCOD ? 'Cash on Delivery' : 'Razorpay (Online)'}
          />

          <DetailRow
            icon="time-outline"
            label="Estimated Delivery"
            value="20 – 35 minutes"
          />

          {/* Razorpay badge (online only) */}
          {!isCOD && (
            <View style={styles.rzpBadge}>
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Text style={styles.rzpBadgeText}>Secured by Razorpay</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View
          style={{ opacity: contentOpacity, transform: [{ translateY: contentSlide }] }}
        >
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              router.push({
                pathname: '/(consumer)/order-detail',
                params: { orderId },
              })
            }
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Track My Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(consumer)/home')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
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
  particleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.lg,
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
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.md,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  amountLabel: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '800',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: FONTS.sizes.md,
    color: colors.text,
    fontWeight: '600',
  },
  rzpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rzpBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: colors.success,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.lg,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: RADIUS.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});

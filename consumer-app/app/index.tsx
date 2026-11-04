import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../src/store/authStore';
import { useConsentStore } from '../src/store/consentStore';
import { Button } from '../src/components/Button';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
// import { seedData } from '../src/services/api'; // disabled - causes backend crash

const { width, height } = Dimensions.get('window');

const ShinitzLogo = require('../assets/images/shinitz-logo.jpeg');

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  // The consent screen is an overlay above the navigator (see ConsentGate), so
  // this screen is mounted underneath it. Don't take a signed-in user into the
  // app — where Home asks for location — until they have accepted the terms.
  const consentAccepted = useConsentStore((s) => s.status === 'accepted');

  useEffect(() => {
    if (!isAuthenticated || !user || !consentAccepted) return;
    // Retry until this screen unmounts. router.replace() SILENTLY NO-OPS (not
    // throws) while the nav tree is still mounting in expo-router v6, so we must
    // never mark ourselves "done" on a call that may not have navigated — just
    // keep calling (idempotent); a successful navigation unmounts us and the
    // cleanup stops the interval. This screen has its own Welcome content, so
    // an unauthenticated user simply stays here.
    let cancelled = false;
    const tick = () => { if (!cancelled) redirectToRoleScreen(user.role); };
    tick();
    const id = setInterval(tick, 300);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAuthenticated, user, consentAccepted]);

  const redirectToRoleScreen = (role: string) => {
    switch (role) {
      case 'consumer': router.replace('/(consumer)/home'); break;
      // Admins browse as consumers here — administration moved to the web panel.
      case 'admin': router.replace('/(consumer)/home'); break;
      default: router.replace('/(auth)/login');   // partners use their own apps
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0F3D2E', '#1a6b4a', '#0F3D2E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Top decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoCard}>
            <Image source={ShinitzLogo} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.taglineContainer}>
            <View style={styles.goldLine} />
            <Text style={styles.tagline}>Taste of Freshness & Tradition</Text>
            <View style={styles.goldLine} />
          </View>
          <Text style={styles.subtitle}>Hyperlocal Quick Commerce</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="time-outline" size={22} color="#D4AF37" />
              </View>
              <Text style={styles.featureText}>In minutes</Text>
              <Text style={styles.featureLabel}>Delivery</Text>
            </View>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#D4AF37" />
              </View>
              <Text style={styles.featureText}>Fresh</Text>
              <Text style={styles.featureLabel}>& Hygienic</Text>
            </View>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="pricetag-outline" size={22} color="#D4AF37" />
              </View>
              <Text style={styles.featureText}>Best</Text>
              <Text style={styles.featureLabel}>Prices</Text>
            </View>
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottom}>
          <Text style={styles.description}>
            Order groceries & food from your favorite local stores. Delivered fresh to your doorstep!
          </Text>

          <Button
            title="Get Started"
            onPress={() => router.push('/(auth)/login')}
            size="lg"
            style={styles.getStartedBtn}
            textStyle={styles.getStartedText}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, paddingHorizontal: SPACING.lg },
  decorCircle1: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  decorCircle2: {
    position: 'absolute', bottom: 100, left: -80,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  logoSection: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: SPACING.xl,
  },
  logoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: SPACING.xl + 8,
    paddingVertical: SPACING.lg,
    ...SHADOWS.lg,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  logo: { width: 280, height: 140 },
  taglineContainer: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.lg, gap: SPACING.sm,
  },
  goldLine: { width: 28, height: 2, backgroundColor: '#D4AF37', borderRadius: 1 },
  tagline: { fontSize: FONTS.sizes.md, color: '#D4AF37', fontWeight: '700', fontStyle: 'italic' },
  subtitle: {
    fontSize: FONTS.sizes.md, color: 'rgba(255,255,255,0.85)', marginTop: SPACING.sm, letterSpacing: 1.5, fontWeight: '400',
  },
  features: { paddingVertical: SPACING.lg },
  featureRow: { flexDirection: 'row', justifyContent: 'space-around' },
  feature: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.md, borderRadius: RADIUS.lg, minWidth: 95,
    borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  featureIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs,
  },
  featureText: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: '#ffffff', marginTop: SPACING.xs },
  featureLabel: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.6)' },
  bottom: { paddingBottom: SPACING.xxl + 16 },
  description: {
    fontSize: FONTS.sizes.md, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg,
  },
  getStartedBtn: {
    width: '100%', backgroundColor: '#D4AF37', borderRadius: RADIUS.xl,
  },
  getStartedText: { color: '#0F3D2E', fontWeight: '800', fontSize: FONTS.sizes.xl },
  partnerText: {
    fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: SPACING.lg,
  },
  partnerLinks: {
    flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.sm, gap: SPACING.sm,
  },
  link: { fontSize: FONTS.sizes.md, color: '#D4AF37', fontWeight: '600' },
  dot: { color: 'rgba(255,255,255,0.3)' },
});
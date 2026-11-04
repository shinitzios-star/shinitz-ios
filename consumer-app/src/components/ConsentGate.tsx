import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, StatusBar, Platform, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsentStore } from '../store/consentStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LegalDoc, LegalSection } from './LegalDoc';
import { SECTIONS as TERMS_SECTIONS } from '../../app/(consumer)/terms';
import { SECTIONS as PRIVACY_SECTIONS } from '../../app/(consumer)/privacy';
import { SPACING, FONTS, RADIUS } from '../constants/theme';

/**
 * First-launch legal consent.
 *
 * Paints an opaque, full-screen overlay OVER the navigator until consent is
 * recorded. The navigator itself is mounted from the first frame and never
 * unmounted by consent (see the render below for why that matters). The gate
 * still can't be navigated around: the redirect into the app and the signed-in
 * route group both wait for consent, so a deep link can't reach anything
 * behind it. The documents open in a modal rather than by navigating, and render
 * the exact same content the in-app Terms/Privacy screens use (imported, not
 * duplicated).
 *
 * Consent is stored under a VERSIONED key: bumping CONSENT_VERSION re-prompts
 * everyone, which is what you want when the documents materially change.
 * It is deliberately NOT cleared on logout — consent is to the documents, not
 * to a session, and re-asking the same person on every logout is noise.
 */

// Consent status lives in a shared store; re-exported for existing importers.
export { CONSENT_VERSION, CONSENT_KEY, hasAcceptedLegal } from '../store/consentStore';

const BRAND_GREEN = '#0F3D2E';
const BRAND_GOLD = '#D4AF37';

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const status = useConsentStore((s) => s.status);
  const loadConsent = useConsentStore((s) => s.load);
  const acceptConsent = useConsentStore((s) => s.accept);
  const checked = status !== 'unknown';                 // storage read finished
  const accepted = status === 'accepted';
  const [agree, setAgree] = useState(false);            // the checkbox
  const [doc, setDoc] = useState<null | 'terms' | 'privacy'>(null);
  // A React Native Modal is its own native window, outside the SafeAreaProvider
  // tree, so a SafeAreaView rendered INSIDE it measures zero insets — which is
  // why the legal document ran under the status bar clock and battery icons.
  // Read the insets out here, where the provider is available, and apply them
  // to the modal's own content.
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConsent(); }, [loadConsent]);

  // Android hardware back must not dismiss the gate (only the doc modal).
  useEffect(() => {
    if (accepted || !checked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (doc) { setDoc(null); return true; }
      return true;   // swallow — there is nowhere to go back to
    });
    return () => sub.remove();
  }, [accepted, checked, doc]);

  const accept = useCallback(async () => {
    if (!agree || saving) return;
    setSaving(true);
    // On failure the store stays 'required', so the gate stays up.
    const ok = await acceptConsent();
    if (!ok) setSaving(false);
  }, [agree, saving, acceptConsent]);

  // The navigator (children) is ALWAYS rendered, from the very first frame, and
  // is never unmounted by consent. The gate is painted OVER it instead.
  //
  // It used to be rendered INSTEAD of children, so the root layout had no
  // navigator on its first render. expo-router requires one there; when the
  // Stack mounted late after consent and the first navigation fired, expo-router
  // tore down and rebuilt the whole root layout — measured on every first
  // launch (RootLayout UNMOUNT -> MOUNT). A rebuilt navigator resets the tabs to
  // Home, which is how a first tap could be undone.
  //
  // The overlay is opaque and full-screen, so nothing underneath can be touched,
  // and nothing that collects data runs underneath before consent: the redirect
  // into the app (app/index.tsx) and the signed-in area ((consumer)/_layout.tsx)
  // both wait for consent to be 'accepted'.
  //
  // ONE return shape for every state, so React always finds the navigator at the
  // same position and never remounts it as the overlay comes and goes. The
  // wrapper only hides the covered navigator from screen readers (TalkBack would
  // otherwise reach the Welcome buttons beneath the gate); toggling that prop
  // does not remount anything.
  let overlay: React.ReactNode = null;
  if (!accepted) {
    overlay = !checked
      // Still reading storage → keep the native splash feel, no flash of the gate.
      ? (
        <View style={[StyleSheet.absoluteFill, styles.boot, { backgroundColor: BRAND_GREEN }]}>
          <ActivityIndicator color={BRAND_GOLD} />
        </View>
      )
      : renderGate();
  }
  return (
    <>
      <View
        style={styles.app}
        importantForAccessibility={accepted ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!accepted}
      >
        {children}
      </View>
      {overlay}
    </>
  );

  function renderGate() {

  const docProps = doc === 'terms'
    ? {
        title: 'Terms & Conditions', updated: '20 June 2026',
        intro: 'Please read these Terms carefully. They set out the rules for using Shinitz and the responsibilities of customers, stores and delivery partners.',
        sections: TERMS_SECTIONS as LegalSection[],
      }
    : {
        title: 'Privacy Policy', updated: '20 June 2026',
        intro: 'Your privacy matters to us. This Policy describes what data Shinitz collects, why, how we protect it, and the choices and rights you have.',
        sections: PRIVACY_SECTIONS as LegalSection[],
      };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[BRAND_GREEN, '#1a6b4a', BRAND_GREEN]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={30} color={BRAND_GOLD} />
          </View>

          <Text style={styles.title}>Welcome to Shinitz</Text>
          <Text style={styles.sub}>
            Before you start ordering, please review and accept our legal terms.
          </Text>

          <View style={styles.card}>
            {[
              { icon: 'document-text-outline', label: 'Terms & Conditions', key: 'terms' as const,
                desc: 'How Shinitz works and your responsibilities' },
              { icon: 'lock-closed-outline', label: 'Privacy Policy', key: 'privacy' as const,
                desc: 'What data we collect and how we protect it' },
            ].map((row) => (
              <TouchableOpacity
                key={row.key}
                style={styles.docRow}
                onPress={() => setDoc(row.key)}
                accessibilityRole="button"
                accessibilityLabel={`Read ${row.label}`}
                hitSlop={6}
              >
                <Ionicons name={row.icon as any} size={20} color={BRAND_GOLD} />
                <View style={styles.docText}>
                  <Text style={styles.docLabel}>{row.label}</Text>
                  <Text style={styles.docDesc}>{row.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAgree((a) => !a)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agree }}
            accessibilityLabel="I agree to the Terms and Conditions and Privacy Policy"
            hitSlop={8}
          >
            <View style={[styles.checkbox, agree && styles.checkboxOn]}>
              {agree && <Ionicons name="checkmark" size={16} color={BRAND_GREEN} />}
            </View>
            <Text style={styles.checkText}>
              I agree to the{' '}
              <Text style={styles.link} onPress={() => setDoc('terms')}>Terms &amp; Conditions</Text>
              {' '}and{' '}
              <Text style={styles.link} onPress={() => setDoc('privacy')}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cta, !agree && styles.ctaDisabled]}
            onPress={accept}
            disabled={!agree || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !agree || saving }}
            accessibilityLabel="Agree and continue"
          >
            {saving
              ? <ActivityIndicator color={BRAND_GREEN} />
              : <Text style={styles.ctaText}>Agree &amp; Continue</Text>}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            You can read these documents any time from Profile → Legal.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={!!doc}
        animationType="slide"
        onRequestClose={() => setDoc(null)}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        // Explicit so the geometry is deterministic rather than depending on the
        // platform default (which differs once edge-to-edge is on): the modal
        // always covers the status bar, and the padding above always clears it.
        statusBarTranslucent
      >
        {/* LegalDoc renders its own header with a back control that calls
            router.back(); inside a modal we provide an explicit close instead. */}
        {/* Only Android needs the top inset: on iOS this is a pageSheet, which
            already starts below the status bar, so padding it would just leave
            a gap. */}
        <View style={[styles.modalRoot, {
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingBottom: insets.bottom,
        }]}>
          <TouchableOpacity
            style={[styles.modalClose, {
              top: (Platform.OS === 'android' ? insets.top + 12 : 14),
            }]}
            onPress={() => setDoc(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color="#111" />
          </TouchableOpacity>
          <LegalDoc {...docProps} />
        </View>
      </Modal>
    </View>
  );
  }
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: BRAND_GREEN },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl,
  },
  badge: {
    width: 62, height: 62, borderRadius: 31, alignSelf: 'center',
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xxl, fontWeight: '800', color: '#fff', textAlign: 'center',
  },
  sub: {
    fontSize: FONTS.sizes.md, color: 'rgba(255,255,255,0.7)', textAlign: 'center',
    marginTop: SPACING.xs, marginBottom: SPACING.lg, lineHeight: 21,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.lg,
  },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  docText: { flex: 1, minWidth: 0 },
  docLabel: { fontSize: FONTS.sizes.md, fontWeight: '700', color: '#fff' },
  docDesc: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    marginBottom: SPACING.lg, paddingRight: SPACING.xs,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  checkText: {
    flex: 1, fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 20,
  },
  link: { color: BRAND_GOLD, fontWeight: '700', textDecorationLine: 'underline' },
  cta: {
    backgroundColor: BRAND_GOLD, borderRadius: RADIUS.xl,
    paddingVertical: 16, alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: 'rgba(212,175,55,0.35)' },
  ctaText: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: BRAND_GREEN },
  footnote: {
    fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', marginTop: SPACING.md,
  },
  modalRoot: { flex: 1, backgroundColor: '#fff' },
  modalClose: {
    // `top` is set inline from the safe-area inset; this is the fallback.
    position: 'absolute', top: Platform.OS === 'ios' ? 14 : 12, right: 14, zIndex: 10,
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
});

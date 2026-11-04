import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  setLocationConsentPresenter, type ConsentPrompt, type PromptAnswer,
} from './locationConsent';

const LOGO = require('../../assets/images/rider-logo.png');
const PRIVACY_URL = 'https://www.shinitz.com/privacy-policy';

// Matches the logo artwork and the splash, so the screen reads as Shinitz.
const INK = '#0C0C0C';
const GOLD = COLORS.accent;

/**
 * The prominent disclosure, and the explanations shown when a permission is
 * refused. Mounted once at the root so it can appear in front of any screen —
 * including registration, before the rider has signed in.
 *
 * Google Play's requirements, and where each is met:
 *   • inside the app, not only in the privacy policy      → this screen
 *   • says WHAT is collected                               → "your location"
 *   • says it is collected in the BACKGROUND               → bold sentence
 *   • says WHY, specifically                               → the three uses
 *   • precedes the system dialog and needs a user action   → locationConsent.ts
 *   • a real choice, nothing pre-selected                  → Not Now never prompts
 *
 * Every statement describes what the app and backend actually do — see the
 * comments beside each one. Change the wording only alongside the behaviour.
 */
export default function LocationConsentHost() {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState<ConsentPrompt | null>(null);
  const resolver = useRef<((a: PromptAnswer) => void) | null>(null);

  useEffect(() => {
    setLocationConsentPresenter((p) => new Promise<PromptAnswer>((resolve) => {
      resolver.current = resolve;
      setPrompt(p);
    }));
    return () => setLocationConsentPresenter(null);
  }, []);

  const answer = useCallback((a: PromptAnswer) => {
    setPrompt(null);
    resolver.current?.(a);
    resolver.current = null;
  }, []);

  if (!prompt) return null;

  if (prompt !== 'disclosure') {
    const copy = DENIED_COPY[prompt];
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent
             onRequestClose={() => answer('dismiss')}>
        <View style={s.dimmer}>
          <View style={s.card}>
            <View style={s.cardIcon}>
              <Ionicons name={copy.icon} size={28} color={GOLD} />
            </View>
            <Text style={s.cardTitle}>{copy.title}</Text>
            {copy.body.map((p) => <Text key={p} style={s.cardBody}>{p}</Text>)}
            <TouchableOpacity style={s.primary} activeOpacity={0.85}
                              onPress={() => answer('settings')} accessibilityRole="button">
              <Text style={s.primaryText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} activeOpacity={0.7}
                              onPress={() => answer('dismiss')} accessibilityRole="button">
              <Text style={s.secondaryText}>{copy.dismiss}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent
           onRequestClose={() => answer('dismiss')}>
      <View style={[s.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={s.scroll} persistentScrollbar>
          <Image source={LOGO} style={s.logo} resizeMode="contain" accessibilityLabel="Shinitz" />

          <Text style={s.title} accessibilityRole="header">Why Shinitz needs your location</Text>

          <View style={s.badge}>
            <Ionicons name="location" size={16} color={INK} />
            <Text style={s.badgeText}>Live delivery tracking</Text>
          </View>

          <Text style={s.body}>
            Shinitz uses your location to provide live delivery tracking and keep your delivery
            status accurate.
          </Text>

          {/* The background collection — ACTIVE_DELIVERY_TASK in activeDeliveryMode.ts,
              running in a location foreground service only while an order is assigned
              to the rider. */}
          <Text style={s.body}>
            During an active delivery, Shinitz collects your location
            <Text style={s.strong}> even when the app is closed or not in use</Text>
            {' '}— including when it is minimized or your screen is locked.
          </Text>

          <View style={s.points}>
            {/* Readers of the live position: tracking.py /watch admits the order's
                customer, the order's store and admins — nobody else. */}
            <Point text="Customers can follow their order on a live map" />
            <Point text="The restaurant sees when you will arrive" />
            <Point text="Support can find a delivery that goes wrong" />
            {/* OrderAlertCenter refreshes the position while online and the app is
                open; the offer engine matches riders within a few km of the store. */}
            <Point text="While you are online and the app is open, it is used to offer you nearby orders" />
          </View>

          {/* Offline: OrderAlertCenter returns before pushLocation(), and the Available
              tab's watcher only runs while online. The one exception is SOS, which
              the rider sends deliberately. */}
          <View style={s.limits}>
            <Text style={s.limitsText}>
              Used only for delivery services. Not tracked while you are offline (unless you send an
              SOS). Background collection stops when the delivery ends, and a notification shows while
              it is on.
            </Text>
          </View>
        </ScrollView>

        <TouchableOpacity style={s.primary} activeOpacity={0.85}
                          onPress={() => answer('agree')} accessibilityRole="button">
          <Text style={s.primaryText}>Agree & Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} activeOpacity={0.7}
                          onPress={() => answer('dismiss')} accessibilityRole="button">
          <Text style={s.secondaryTextLight}>Not Now</Text>
        </TouchableOpacity>
        {Platform.OS === 'android' && (
          <Text style={s.footnote}>
            Next, Android will ask. Choose "Allow all the time" for live tracking in the background.
          </Text>
        )}
        {/* Pinned with the buttons, so it is visible without scrolling on any phone. */}
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                          accessibilityRole="link" style={s.privacy}>
          <Text style={s.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function Point({ text }: { text: string }) {
  return (
    <View style={s.pointRow}>
      <Ionicons name="checkmark-circle" size={18} color={GOLD} style={{ marginTop: 1 }} />
      <Text style={s.pointText}>{text}</Text>
    </View>
  );
}

const DENIED_COPY: Record<Exclude<ConsentPrompt, 'disclosure'>, {
  icon: keyof typeof Ionicons.glyphMap; title: string; body: string[]; dismiss: string;
}> = {
  background_denied: {
    icon: 'navigate-circle-outline',
    title: 'Background location is off',
    body: [
      'Background location is required for live delivery tracking while the Rider App is running in the background.',
      'Without this permission, customers may not receive accurate live delivery updates during an active delivery.',
      'You can enable it from Settings.',
    ],
    dismiss: 'Not Now',
  },
  foreground_denied: {
    icon: 'location-outline',
    title: 'Location is turned off',
    body: [
      'Location is required to work as a Shinitz delivery partner. It is used to offer you nearby orders and to guide you to the restaurant and the customer.',
      'You can enable it from Settings.',
    ],
    dismiss: 'Not Now',
  },
  approximate: {
    icon: 'locate-outline',
    title: 'Precise location is off',
    body: [
      'You allowed approximate location only. Live delivery tracking needs your precise location to show the customer where you are and to guide you to their door.',
      'Turn on "Use precise location" in Settings.',
    ],
    dismiss: 'Continue',
  },
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK, paddingHorizontal: 22 },
  scroll: { alignItems: 'center', paddingBottom: 12 },
  logo: { width: 80, height: 78, marginTop: 0, marginBottom: 8 },
  title: {
    color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '800',
    textAlign: 'center', marginBottom: 10,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GOLD,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 12,
  },
  badgeText: { color: INK, fontSize: 13, fontWeight: '800' },
  body: {
    color: '#D7D7D7', fontSize: 15, lineHeight: 22, textAlign: 'center',
    marginBottom: 8, alignSelf: 'stretch',
  },
  strong: { color: '#FFFFFF', fontWeight: '800' },
  points: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointText: { flexShrink: 1, color: '#E8E8E8', fontSize: 14, lineHeight: 20 },
  limits: {
    alignSelf: 'stretch', marginTop: 12, padding: 12, borderRadius: 14,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
  },
  limitsText: { color: '#BDBDBD', fontSize: 13, lineHeight: 19 },
  privacy: { alignSelf: 'center', paddingVertical: 6 },
  privacyText: { color: GOLD, fontSize: 13.5, fontWeight: '700', textDecorationLine: 'underline' },
  primary: {
    backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', alignSelf: 'stretch', marginTop: 10,
  },
  primaryText: { color: INK, fontSize: 16, fontWeight: '800' },
  secondary: { paddingVertical: 11, alignItems: 'center', alignSelf: 'stretch' },
  secondaryText: { color: '#6B7280', fontSize: 15, fontWeight: '700' },
  secondaryTextLight: { color: '#BDBDBD', fontSize: 15, fontWeight: '700' },
  footnote: { color: '#8A8A8A', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  dimmer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, alignItems: 'center' },
  cardIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: INK,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  cardBody: { fontSize: 14.5, lineHeight: 21, color: '#4B5563', textAlign: 'center', marginBottom: 6 },
});

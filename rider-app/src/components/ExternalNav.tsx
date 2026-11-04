// ─────────────────────────────────────────────────────────────────────────────
// ExternalNav — open a destination in Google Maps / Waze / Mappls / HERE WeGo
// (or the OS chooser) from the rider app, without ever pausing Shinitz tracking.
//
// Live tracking is unaffected by design: GPS streaming runs inside Active
// Delivery Mode's Android foreground service (see activeDeliveryMode.ts), which
// keeps posting the rider's location to the backend while any other app is in
// the foreground. Returning to Shinitz re-syncs via the nav screen's AppState
// handler. Opening an external map is a pure Linking.openURL — it touches none
// of that.
//
// Detection: Android 11+ hides other packages unless declared in the manifest
// <queries> (added there for waze/mappls/here schemes). Google Maps is treated
// as always-available (Play-Services baseline) with a browser/web-maps fallback
// if the deep link is somehow rejected. "More apps…" always fires a generic
// geo: implicit intent so the OS chooser covers anything we didn't list.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';

const PREF_KEY = 'preferred_nav_app';

type NavApp = {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  // A cheap scheme used only to detect installation (Android package visibility).
  probe: string;
  // The URL that actually starts turn-by-turn navigation to (lat,lng).
  url: (lat: number, lng: number, label: string) => string;
};

// Ordered by rider familiarity in India.
const APPS: NavApp[] = [
  {
    key: 'google', name: 'Google Maps', icon: 'navigate', color: '#4285F4',
    probe: Platform.OS === 'ios' ? 'comgooglemaps://' : 'google.navigation:q=0,0',
    url: (lat, lng) => Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
      : `google.navigation:q=${lat},${lng}&mode=d`,
  },
  {
    key: 'waze', name: 'Waze', icon: 'car-sport', color: '#33CCFF',
    probe: 'waze://',
    url: (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  },
  {
    key: 'mappls', name: 'Mappls', icon: 'map', color: '#E4002B',
    probe: 'mapmyindia://',
    url: (lat, lng) => `https://www.mappls.com/direction?places=${lat},${lng}`,
  },
  {
    key: 'here', name: 'HERE WeGo', icon: 'compass', color: '#48DAD0',
    probe: 'here-location://',
    url: (lat, lng) => `https://share.here.com/r/${lat},${lng}?m=w`,
  },
];

// Google Maps universal fallback (web / maps app via https).
const googleWeb = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
// Generic geo: intent → Android's own app chooser (needs no package visibility).
const geoIntent = (lat: number, lng: number, label: string) =>
  `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;

async function launch(app: NavApp, lat: number, lng: number, label: string) {
  try {
    await Linking.openURL(app.url(lat, lng, label));
  } catch {
    // Google Maps deep link rejected → web maps. Others → OS geo chooser.
    try {
      await Linking.openURL(app.key === 'google' ? googleWeb(lat, lng) : geoIntent(lat, lng, label));
    } catch {
      Alert.alert('Could not open navigation', 'No compatible map app was found on your phone.');
    }
  }
}

function validCoord(lat?: number | null, lng?: number | null): lat is number {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

/**
 * Prominent "Navigate" button + branded app-picker sheet. Drop it anywhere a
 * destination is known. `variant="outline"` for secondary placement.
 */
export function NavigateButton({
  lat, lng, label = 'Destination', title = 'Navigate', variant = 'solid',
}: {
  lat?: number | null; lng?: number | null; label?: string;
  title?: string; variant?: 'solid' | 'outline';
}) {
  const [sheet, setSheet] = useState(false);
  const [installed, setInstalled] = useState<NavApp[]>([]);
  const [remember, setRemember] = useState(false);

  const openWith = useCallback(async (app: NavApp) => {
    if (!validCoord(lat, lng)) return;
    Haptics.selectionAsync().catch(() => {});
    if (remember) await AsyncStorage.setItem(PREF_KEY, app.key).catch(() => {});
    setSheet(false);
    launch(app, lat as number, lng as number, label);
  }, [lat, lng, label, remember]);

  const onPress = useCallback(async () => {
    if (!validCoord(lat, lng)) {
      Alert.alert('Location not ready', 'We don\'t have the destination coordinates yet — try again in a moment.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Detect installed apps. Google Maps is always offered (with fallback).
    const found: NavApp[] = [];
    for (const a of APPS) {
      if (a.key === 'google') { found.push(a); continue; }
      try { if (await Linking.canOpenURL(a.probe)) found.push(a); } catch { /* not visible */ }
    }

    // Honour a remembered choice → open directly, no sheet.
    const pref = await AsyncStorage.getItem(PREF_KEY).catch(() => null);
    const remembered = pref && found.find((a) => a.key === pref);
    if (remembered) { launch(remembered, lat as number, lng as number, label); return; }

    // Exactly one nav app → open it directly (no picker).
    if (found.length === 1) { openWith(found[0]); return; }

    setInstalled(found);
    setRemember(false);
    setSheet(true);
  }, [lat, lng, label, openWith]);

  const solid = variant === 'solid';
  return (
    <>
      <TouchableOpacity
        style={[styles.btn, solid ? styles.btnSolid : styles.btnOutline]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate" size={18} color={solid ? '#fff' : COLORS.primary} />
        <Text style={[styles.btnText, !solid && { color: COLORS.primary }]}>{title}</Text>
      </TouchableOpacity>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Navigate using</Text>

            {installed.map((a) => (
              <TouchableOpacity key={a.key} style={styles.appRow} onPress={() => openWith(a)} activeOpacity={0.7}>
                <View style={[styles.appIcon, { backgroundColor: a.color + '18' }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={styles.appName}>{a.name}</Text>
                <Ionicons name="open-outline" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}

            {/* Always available: hand off to the OS chooser for anything else. */}
            <TouchableOpacity
              style={styles.appRow}
              activeOpacity={0.7}
              onPress={() => {
                setSheet(false);
                Linking.openURL(geoIntent(lat as number, lng as number, label)).catch(() =>
                  Alert.alert('No map app', 'Install a navigation app to use this.'));
              }}
            >
              <View style={[styles.appIcon, { backgroundColor: COLORS.textMuted + '18' }]}>
                <Ionicons name="apps" size={22} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.appName}>More navigation apps…</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember((v) => !v)} activeOpacity={0.7}>
              <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
              <Text style={styles.rememberText}>Always use the selected app</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSheet(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/** Clear the remembered app (e.g. a Settings action). */
export async function clearPreferredNavApp() {
  await AsyncStorage.removeItem(PREF_KEY).catch(() => {});
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: RADIUS.lg, paddingVertical: 13,
  },
  btnSolid: { backgroundColor: COLORS.primary },
  btnOutline: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  appIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  appName: { flex: 1, fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  rememberText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  cancelBtn: {
    marginTop: SPACING.xs, borderRadius: RADIUS.lg, paddingVertical: 13,
    alignItems: 'center', backgroundColor: COLORS.surfaceLight,
  },
  cancelText: { color: COLORS.text, fontWeight: '800', fontSize: FONTS.sizes.md },
});

export default NavigateButton;

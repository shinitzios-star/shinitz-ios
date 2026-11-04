import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator, ScrollView, Dimensions, Modal, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, FONTS, RADIUS } from '../constants/theme';

// Fixed premium dark + gold palette (matches the provided Coming-Soon / Not-Available
// poster designs). Intentionally theme-independent — these are branded splashes.
const GOLD = '#FFC107';
const GOLD_SOFT = '#FFD75E';
const INK = 'rgba(255,255,255,0.92)';
const MUTED = 'rgba(255,255,255,0.62)';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,193,7,0.28)';

export type SplashChip = { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string };
export type SplashFloater = { icon: keyof typeof Ionicons.glyphMap; left: number; top: number; size: number; delay: number };

interface Props {
  badge: string;            // "COMING SOON" / "SORRY!"
  title: string;            // "Kirana Coming Soon" / "Not Available"
  area: string;             // "To Your Area"
  message: string;
  heroIcon: keyof typeof Ionicons.glyphMap;
  floaters: SplashFloater[];
  chips: SplashChip[];
  notified?: boolean;
  refreshing?: boolean;
  onNotify: () => void;
  onRefresh: () => void;
  primary?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
  secondary?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
  onChangeAddress?: () => void;
  areaName?: string;
}

export function PremiumSplash(p: Props) {
  const styles = useMemo(() => createStyles(), []);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const float = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const floaterAnims = useRef(p.floaters.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();

    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
      ...floaterAnims.map((v, i) => Animated.loop(Animated.sequence([
        Animated.delay(p.floaters[i].delay),
        Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]))),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#241b06', '#0b0b0b', '#000000']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
          {/* Hero */}
          <View style={styles.scene}>
            {p.floaters.map((f, i) => (
              <Animated.View key={i} style={[styles.floater, {
                left: f.left, top: f.top,
                opacity: floaterAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.95] }),
                transform: [{ translateY: floaterAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
              }]}>
                <Ionicons name={f.icon} size={f.size} color={GOLD_SOFT} />
              </Animated.View>
            ))}
            <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
            <Animated.View style={{ transform: [{ translateY }] }}>
              <View style={styles.heroCircle}>
                <Ionicons name={p.heroIcon} size={76} color="#1a1a1a" />
              </View>
            </Animated.View>
          </View>

          {/* Title block */}
          <View style={styles.badge}><Text style={styles.badgeText}>{p.badge}</Text></View>
          <Text style={styles.title}>{p.title}</Text>
          <View style={styles.areaTag}><Text style={styles.areaText}>• {p.area} •</Text></View>

          <View style={styles.messageBox}>
            <Text style={styles.message}>{p.message}</Text>
          </View>

          {/* Feature chips */}
          <View style={styles.chips}>
            {p.chips.map((c, i) => (
              <View key={i} style={styles.chip}>
                <View style={styles.chipIcon}><Ionicons name={c.icon} size={22} color={GOLD} /></View>
                <Text style={styles.chipTitle}>{c.title}</Text>
                <Text style={styles.chipSub}>{c.sub}</Text>
              </View>
            ))}
          </View>

          {p.areaName ? (
            <View style={styles.locRow}>
              <Ionicons name="location" size={14} color={GOLD} />
              <Text style={styles.locText} numberOfLines={1}>{p.areaName}</Text>
            </View>
          ) : null}

          {/* Browse Menu (restaurant) */}
          {p.primary && (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={p.primary.onPress}>
              <Ionicons name={p.primary.icon} size={18} color="#1a1a1a" />
              <Text style={styles.primaryText}>{p.primary.label}</Text>
            </TouchableOpacity>
          )}

          {/* Notify Me — pulsing */}
          <Animated.View style={{ transform: [{ scale: p.notified ? 1 : pulse }] }}>
            <TouchableOpacity
              style={[styles.notifyBtn, p.notified && styles.notifyDone]}
              activeOpacity={0.9}
              onPress={p.onNotify}
              disabled={p.notified}
            >
              <Ionicons name={p.notified ? 'checkmark-circle' : 'notifications'} size={20} color={p.notified ? '#1a1a1a' : GOLD} />
              <View>
                <Text style={[styles.notifyText, p.notified && { color: '#1a1a1a' }]}>
                  {p.notified ? "You're on the list" : 'NOTIFY ME'}
                </Text>
                {!p.notified && <Text style={styles.notifySub}>Be the first to know when we launch!</Text>}
              </View>
              {!p.notified && <Ionicons name="chevron-forward" size={20} color={GOLD} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
          </Animated.View>

          {/* Secondary + refresh */}
          <View style={styles.footRow}>
            {p.secondary && (
              <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={p.secondary.onPress}>
                <Ionicons name={p.secondary.icon} size={16} color={MUTED} />
                <Text style={styles.ghostText}>{p.secondary.label}</Text>
              </TouchableOpacity>
            )}
            {p.onChangeAddress && (
              <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={p.onChangeAddress}>
                <Ionicons name="location-outline" size={16} color={MUTED} />
                <Text style={styles.ghostText}>Change Address</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={p.onRefresh} disabled={p.refreshing}>
              {p.refreshing ? <ActivityIndicator size="small" color={MUTED} /> : <Ionicons name="refresh" size={16} color={MUTED} />}
              <Text style={styles.ghostText}>{p.refreshing ? 'Checking…' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const chipW = (Math.min(width, 520) - SPACING.lg * 2 - SPACING.sm * 3) / 4;

const createStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 54) + SPACING.md,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
    minHeight: '100%',
    justifyContent: 'center',
  },
  scene: { height: 200, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  floater: { position: 'absolute' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: GOLD },
  heroCircle: { width: 132, height: 132, borderRadius: 66, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center',
    shadowColor: GOLD, shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 16 },
  badge: { alignSelf: 'center', backgroundColor: GOLD, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: SPACING.md },
  badgeText: { color: '#1a1a1a', fontWeight: '900', fontSize: FONTS.sizes.sm, letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 40, fontWeight: '900', textAlign: 'center', marginTop: SPACING.sm, letterSpacing: -1, lineHeight: 44 },
  areaTag: { alignSelf: 'center', borderWidth: 1.5, borderColor: GOLD, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, marginTop: SPACING.sm },
  areaText: { color: GOLD, fontWeight: '800', fontSize: FONTS.sizes.sm, letterSpacing: 1 },
  messageBox: { borderWidth: 1, borderColor: BORDER, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.lg, backgroundColor: 'rgba(255,193,7,0.04)' },
  message: { color: INK, fontSize: FONTS.sizes.md, textAlign: 'center', lineHeight: 22 },
  chips: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, gap: SPACING.sm },
  chip: { width: chipW, backgroundColor: CARD, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: SPACING.md, paddingHorizontal: 4, alignItems: 'center' },
  chipIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: BORDER, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  chipTitle: { color: '#fff', fontSize: 9.5, fontWeight: '900', textAlign: 'center', letterSpacing: 0.3 },
  chipSub: { color: MUTED, fontSize: 8.5, textAlign: 'center', marginTop: 2, lineHeight: 11 },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: SPACING.lg },
  locText: { color: MUTED, fontSize: FONTS.sizes.xs, fontWeight: '600', maxWidth: '80%' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: GOLD, borderRadius: RADIUS.full, paddingVertical: 15, marginTop: SPACING.lg },
  primaryText: { color: '#1a1a1a', fontWeight: '900', fontSize: FONTS.sizes.md, letterSpacing: 0.5 },
  notifyBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 2, borderColor: GOLD, borderRadius: RADIUS.full, paddingVertical: 13, paddingHorizontal: SPACING.lg, marginTop: SPACING.md, backgroundColor: 'rgba(255,193,7,0.06)' },
  notifyDone: { backgroundColor: GOLD, borderColor: GOLD },
  notifyText: { color: GOLD, fontWeight: '900', fontSize: FONTS.sizes.md, letterSpacing: 1 },
  notifySub: { color: MUTED, fontSize: FONTS.sizes.xs, marginTop: 1 },
  footRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg, marginTop: SPACING.lg },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  ghostText: { color: MUTED, fontSize: FONTS.sizes.sm, fontWeight: '600' },
});

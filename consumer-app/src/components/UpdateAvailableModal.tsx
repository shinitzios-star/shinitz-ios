import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, Image, ScrollView, useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';
import { APP_KEY } from '../constants/appUpdate';

// The Shinitz S-road mark, cut from the official logo with its background keyed
// out, so it sits directly on the green hero (assets/images/update-brand-mark.png).
const BRAND_ICON = require('../../assets/images/update-brand-mark.png');

// Two floating tiles per app, so the illustration speaks to who is using it.
const TILE_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  consumer: ['restaurant', 'location'],
  rider: ['bicycle', 'location'],
  restaurant: ['storefront', 'receipt'],
  kirana: ['basket', 'location'],
};

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.sin);

export interface UpdateAvailableModalProps {
  visible: boolean;
  mandatory: boolean;
  /** Version name to announce; null when the release only has a build number. */
  version: string | null;
  title: string;
  notes: string[];
  mandatoryMessage: string;
  onUpdate: () => void;
  /** Optional updates only. */
  onLater?: () => void;
}

/**
 * "New Update Available" — the full-screen, animated update prompt.
 *
 * Mandatory updates show no close button and no "Maybe Later", and the Android
 * back button does nothing: the only way out is Update Now.
 */
export default function UpdateAvailableModal(props: UpdateAvailableModalProps) {
  const { visible, mandatory, version, title, notes, mandatoryMessage, onUpdate, onLater } = props;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const compact = height < 700;

  const heroHeight = Math.round(Math.min(Math.max(height * (compact ? 0.27 : 0.33), 200), 320));
  const art = Math.round(Math.min(heroHeight * 0.66, width * 0.56));

  // ── entrance / exit ─────────────────────────────────────────────────────────
  const backdrop = useSharedValue(0);
  const card = useSharedValue(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setClosing(false);
    backdrop.value = withTiming(1, { duration: 220, easing: EASE_OUT });
    card.value = reduceMotion
      ? withTiming(1, { duration: 160 })
      : withSpring(1, { damping: 18, stiffness: 190, mass: 0.9 });
  }, [visible]);

  const leave = (then?: () => void) => {
    if (closing) return;
    setClosing(true);
    backdrop.value = withTiming(0, { duration: 200, easing: EASE_OUT });
    card.value = withTiming(0, { duration: 180, easing: EASE_OUT });
    setTimeout(() => then?.(), 200);
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ scale: 0.92 + 0.08 * card.value }],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      // Back button: dismisses an optional update; does nothing for a mandatory one.
      onRequestClose={() => { if (!mandatory && onLater) leave(onLater); }}
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View
          accessibilityViewIsModal
          style={[s.card, cardStyle, {
            marginTop: insets.top + (compact ? 8 : 14),
            marginBottom: insets.bottom + (compact ? 8 : 14),
          }]}
        >
          {/* ── hero ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={[s.hero, { height: heroHeight }]}
          >
            <View style={s.brandRow}>
              <Image source={BRAND_ICON} style={s.brandIcon} accessibilityIgnoresInvertColors />
              <Text style={s.brandText}>shinitz</Text>
              {!mandatory && onLater && (
                <Pressable
                  onPress={() => leave(onLater)}
                  hitSlop={12}
                  style={s.close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
            <Illustration size={art} animate={!reduceMotion && !closing} />
            <Clouds width={width} />
          </LinearGradient>

          {/* ── content ──────────────────────────────────────────────── */}
          <ScrollView
            style={s.body}
            contentContainerStyle={[s.bodyContent, compact && { paddingTop: 2 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Rise index={0} reduce={reduceMotion}>
              <Text style={[s.title, compact && { fontSize: 23, lineHeight: 29 }]} accessibilityRole="header">
                {mandatory ? 'Update Required' : 'New Update Available'} 🚀
              </Text>
            </Rise>
            <Rise index={1} reduce={reduceMotion}>
              <Text style={s.subtitle}>
                {mandatory ? 'A new version of Shinitz is needed to continue.' : 'A better Shinitz experience is ready for you.'}
              </Text>
            </Rise>
            <Rise index={2} reduce={reduceMotion}>
              <VersionPill version={version} mandatory={mandatory} animate={!reduceMotion} />
            </Rise>
            {mandatory && (
              <Rise index={3} reduce={reduceMotion}>
                <View style={s.required} accessibilityRole="alert">
                  <Ionicons name="lock-closed" size={18} color={COLORS.accentDark} style={{ marginTop: 1 }} />
                  <Text style={s.requiredText}>{mandatoryMessage}</Text>
                </View>
              </Rise>
            )}
            {notes.length > 0 && (
              <Rise index={4} reduce={reduceMotion}>
                <View style={s.notes}>
                  <Text style={s.notesTitle}>{title}</Text>
                  {notes.map((n, i) => (
                    <View key={`${i}-${n}`} style={s.noteRow}>
                      <View style={s.tick}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                      <Text style={s.noteText}>{n}</Text>
                    </View>
                  ))}
                </View>
              </Rise>
            )}
          </ScrollView>

          {/* ── actions ──────────────────────────────────────────────── */}
          <View style={s.footer}>
            <UpdateButton onPress={onUpdate} animate={!reduceMotion} />
            {!mandatory && onLater && (
              <Pressable
                onPress={() => leave(onLater)}
                style={({ pressed }) => [s.later, pressed && { opacity: 0.55 }]}
                accessibilityRole="button"
              >
                <Text style={s.laterText}>Maybe Later</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Slide-up + fade, staggered by position. */
function Rise({ index, reduce, children }: { index: number; reduce: boolean; children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(reduce ? 0 : 120 + index * 70, withTiming(1, { duration: reduce ? 150 : 420, easing: EASE_OUT }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 18 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * A value that drifts between 0 and 1 — the "floating" motion — for a few
 * cycles, then settles at rest.
 *
 * Deliberately NOT forever: an endlessly animating screen never goes idle, so
 * TalkBack and UI-automation tools (Play's pre-launch crawler among them) can
 * never settle on it — measured: `uiautomator` reports "could not get idle
 * state" — and it keeps the GPU busy for as long as the prompt sits open.
 * The motion plays while the screen is being read, then the screen rests.
 */
const AMBIENT_MS = 7000;
function useDrift(animate: boolean, duration: number, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!animate) { v.value = withTiming(0, { duration: 200 }); return; }
    const cycles = Math.max(1, Math.round(AMBIENT_MS / (duration * 2)));
    v.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration, easing: EASE_IN_OUT }),
        withTiming(0, { duration, easing: EASE_IN_OUT }),
      ), cycles, false,
    ));
  }, [animate]);
  return v;
}

function Illustration({ size, animate }: { size: number; animate: boolean }) {
  const [leftIcon, rightIcon] = TILE_ICONS[APP_KEY] || TILE_ICONS.consumer;
  const rocket = useDrift(animate, 1700);
  const tileA = useDrift(animate, 2100, 300);
  const tileB = useDrift(animate, 1900, 700);
  const flame = useDrift(animate, 220);
  const twinkle = useDrift(animate, 1100);

  const rocketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * rocket.value }, { rotate: `${-2 + 4 * rocket.value}deg` }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + 0.25 * flame.value,
    transform: [{ translateY: -10 * rocket.value }, { scale: 0.88 + 0.16 * flame.value }, { rotate: '-135deg' }],
  }));
  const tileAStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 8 * tileA.value }, { rotate: `${-12 + 3 * tileA.value}deg` }],
  }));
  const tileBStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * tileB.value }, { rotate: `${10 - 3 * tileB.value}deg` }],
  }));
  const sparkA = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * twinkle.value, transform: [{ scale: 0.7 + 0.4 * twinkle.value }] }));
  const sparkB = useAnimatedStyle(() => ({ opacity: 1 - 0.65 * twinkle.value, transform: [{ scale: 1.1 - 0.4 * twinkle.value }] }));

  const tile = Math.round(size * 0.27);
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginTop: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.glow, { width: size, height: size, borderRadius: size / 2 }]} />
      <View style={[s.glow, { width: size * 0.66, height: size * 0.66, borderRadius: size, top: size * 0.17, left: size * 0.17 }]} />

      <Animated.View style={[{ position: 'absolute', left: size * 0.22, top: size * 0.52 }, flameStyle]}>
        <Ionicons name="flame" size={size * 0.24} color={COLORS.accent} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: size * 0.24, top: size * 0.2 }, rocketStyle]}>
        <Ionicons name="rocket" size={size * 0.56} color="#FFFFFF" />
      </Animated.View>

      <Animated.View style={[s.tile, { width: tile, height: tile, left: -tile * 0.18, top: size * 0.26, backgroundColor: '#7BC96F' }, tileAStyle]}>
        <Ionicons name={leftIcon} size={tile * 0.55} color={COLORS.primaryDark} />
      </Animated.View>
      <Animated.View style={[s.tile, { width: tile, height: tile, right: -tile * 0.22, top: size * 0.44, backgroundColor: COLORS.accentLight }, tileBStyle]}>
        <Ionicons name={rightIcon} size={tile * 0.55} color={COLORS.accentDark} />
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', right: size * 0.1, top: size * 0.06 }, sparkA]}>
        <Ionicons name="sparkles" size={size * 0.12} color={COLORS.accent} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: size * 0.04, top: size * 0.62 }, sparkB]}>
        <Ionicons name="star" size={size * 0.075} color={COLORS.accentLight} />
      </Animated.View>
      <View style={{ position: 'absolute', right: size * 0.02, bottom: size * 0.02 }}>
        <Ionicons name="trending-up" size={size * 0.2} color={COLORS.accent} />
      </View>
    </View>
  );
}

/** The soft white edge where the green hero meets the content. */
function Clouds({ width }: { width: number }) {
  const puffs = [
    { x: -0.06, r: 0.16 }, { x: 0.1, r: 0.12 }, { x: 0.24, r: 0.15 }, { x: 0.42, r: 0.11 },
    { x: 0.56, r: 0.16 }, { x: 0.74, r: 0.12 }, { x: 0.88, r: 0.17 },
  ];
  return (
    <View style={s.clouds} pointerEvents="none">
      {puffs.map((p, i) => {
        const d = width * p.r;
        return (
          <View key={i} style={{
            position: 'absolute', left: width * p.x, bottom: -d * 0.5,
            width: d, height: d, borderRadius: d / 2,
            backgroundColor: i % 2 ? '#F7FAF6' : '#FFFFFF',
          }} />
        );
      })}
    </View>
  );
}

function VersionPill({ version, mandatory, animate }: { version: string | null; mandatory: boolean; animate: boolean }) {
  const pulse = useDrift(animate, 900);
  const dot = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * pulse.value, transform: [{ scale: 0.85 + 0.3 * pulse.value }] }));
  const tint = mandatory ? COLORS.accentDark : COLORS.primary;
  return (
    <View style={[s.pill, mandatory && { backgroundColor: '#FBF4DF' }]}>
      <Animated.View style={[s.pillDot, { backgroundColor: mandatory ? COLORS.accent : COLORS.success }, dot]} />
      {version ? (
        <Text style={s.pillText}>
          <Text style={[s.pillVersion, { color: tint }]}>Version {version}</Text>
          {'  '}is now available
        </Text>
      ) : (
        <Text style={[s.pillVersion, { color: tint }]}>A new version is now available</Text>
      )}
    </View>
  );
}

/** The primary action: springs in after the content, presses down, and catches the light. */
function UpdateButton({ onPress, animate }: { onPress: () => void; animate: boolean }) {
  const enter = useSharedValue(0);
  const press = useSharedValue(1);
  const shine = useSharedValue(0);
  const [w, setW] = useState(0);

  useEffect(() => {
    enter.value = withDelay(animate ? 380 : 0, withSpring(1, { damping: 14, stiffness: 160 }));
    if (animate) {
      shine.value = withDelay(1100, withRepeat(
        withSequence(withTiming(1, { duration: 900, easing: EASE_IN_OUT }), withDelay(1800, withTiming(0, { duration: 0 }))),
        3, false,                              // three passes, then rest (see useDrift)
      ));
    }
  }, [animate]);

  const wrap = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }, { scale: press.value * (0.94 + 0.06 * enter.value) }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + (w + 240) * shine.value }, { skewX: '-18deg' }],
  }));

  return (
    <Animated.View style={wrap}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { press.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }}
        onPressOut={() => { press.value = withSpring(1, { damping: 16, stiffness: 300 }); }}
        accessibilityRole="button"
        accessibilityLabel="Update now"
        accessibilityHint="Opens Shinitz in the Play Store"
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      >
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.cta}
        >
          <Animated.View pointerEvents="none" style={[s.shine, shineStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Text style={s.ctaText}>Update Now</Text>
          <Ionicons name="arrow-forward" size={22} color={COLORS.accentLight} style={s.ctaArrow} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 20, 14, 0.72)' },
  card: {
    flex: 1, marginHorizontal: 12, borderRadius: 30, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  hero: { width: '100%', overflow: 'hidden' },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
  },
  brandIcon: { width: 44, height: 44 },
  brandText: {
    color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginLeft: 6, flex: 1,
  },
  close: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  glow: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.06)' },
  tile: {
    position: 'absolute', borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  clouds: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  title: {
    fontSize: 26, lineHeight: 32, fontWeight: '800', color: COLORS.primaryDark,
    textAlign: 'center', letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: FONTS.sizes.md, lineHeight: 22, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: 6,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: SPACING.md,
    backgroundColor: '#EAF4EC', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9,
  },
  pillDot: { width: 9, height: 9, borderRadius: 5, marginRight: 9 },
  pillText: { fontSize: 13.5, color: COLORS.textSecondary },
  pillVersion: { fontSize: 17, fontWeight: '800' },
  required: {
    flexDirection: 'row', gap: 10, marginTop: SPACING.md, padding: 14, borderRadius: RADIUS.lg,
    backgroundColor: '#FBF4DF', borderWidth: 1, borderColor: '#EFDDA6',
  },
  requiredText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#6B5413', fontWeight: '600' },
  notes: {
    marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl,
    backgroundColor: '#F3F8F3', borderWidth: 1, borderColor: '#E3EFE4',
  },
  notesTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primaryDark, marginBottom: 10 },
  noteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  tick: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.success, marginRight: 11,
  },
  noteText: { flexShrink: 1, fontSize: 14.5, lineHeight: 20, color: COLORS.text },
  footer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  cta: {
    height: 58, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  shine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 90 },
  ctaText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  ctaArrow: { position: 'absolute', right: 22 },
  later: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, marginTop: 2 },
  laterText: { fontSize: 15.5, fontWeight: '700', color: COLORS.textSecondary },
});

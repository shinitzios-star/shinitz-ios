import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { offersAPI } from '../services/api';

const DISMISS_KEY = 'dismissed_offers_v1';

interface Offer {
  id: string;
  title: string;
  subtitle?: string;
  code?: string;
  image?: string;
}

/**
 * Animated in-app promotional alert.
 *
 * Self-contained: it fetches the active offers, shows the top one the user
 * hasn't dismissed yet (dismissals persisted in AsyncStorage so it never nags),
 * and springs in over a dimmed backdrop. Renders nothing if there's no offer —
 * so it's safe to mount unconditionally on Home.
 */
export function OfferAlert() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await offersAPI.active();
        const offers: Offer[] = res.data || [];
        if (!offers.length) return;
        const raw = await AsyncStorage.getItem(DISMISS_KEY);
        const dismissed: string[] = raw ? JSON.parse(raw) : [];
        const next = offers.find((o) => !dismissed.includes(o.id));
        if (mounted && next) setOffer(next);
      } catch {
        // Offers are non-critical — never surface an error here.
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!offer) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 65, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [offer]);

  const dismiss = async () => {
    if (offer) {
      try {
        const raw = await AsyncStorage.getItem(DISMISS_KEY);
        const dismissed: string[] = raw ? JSON.parse(raw) : [];
        if (!dismissed.includes(offer.id)) {
          dismissed.push(offer.id);
          await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed.slice(-100)));
        }
      } catch {
        // ignore — worst case the alert shows again next launch
      }
    }
    setOffer(null);
  };

  if (!offer) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <TouchableOpacity style={styles.close} onPress={dismiss} hitSlop={10}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          {offer.image ? (
            <Image source={offer.image} style={styles.image} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.imageFallback}>
              <Ionicons name="pricetags" size={56} color="#fff" />
            </LinearGradient>
          )}

          <View style={styles.body}>
            <Text style={styles.title}>{offer.title}</Text>
            {!!offer.subtitle && <Text style={styles.subtitle}>{offer.subtitle}</Text>}

            {!!offer.code && (
              <View style={styles.codeRow}>
                <Text style={styles.codeLabel}>USE CODE</Text>
                <View style={styles.codePill}><Text style={styles.codeText}>{offer.code}</Text></View>
              </View>
            )}

            <TouchableOpacity style={styles.cta} onPress={dismiss} activeOpacity={0.85}>
              <Text style={styles.ctaText}>{offer.code ? 'Got it' : 'Order now'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: 170 },
  imageFallback: { width: '100%', height: 170, justifyContent: 'center', alignItems: 'center' },
  body: { padding: SPACING.lg, alignItems: 'center' },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: colors.text, textAlign: 'center' },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 22,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
  codeLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  codePill: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: colors.primary + '12',
  },
  codeText: { fontSize: FONTS.sizes.lg, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
  cta: {
    marginTop: SPACING.lg,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },
});

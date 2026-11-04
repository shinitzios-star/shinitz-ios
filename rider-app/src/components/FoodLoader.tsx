import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { FONTS, SPACING } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const FOODS = ['🍔', '🍕', '🍜', '🍗', '🥘', '🍱', '🍩', '🥗'];

/**
 * Playful food loader — a bouncing dish that cycles through items, used instead
 * of the default refresh/loading spinner. Pure Animated (no extra deps).
 */
export function FoodLoader({ size = 44, label }: { size?: number; label?: string }) {
  const { colors } = useTheme();
  const bounce = useRef(new Animated.Value(0)).current;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    // Swap the dish at the bottom of each bounce for a clean transition.
    const swap = setInterval(() => setIdx((i) => (i + 1) % FOODS.length), 760);
    return () => { loop.stop(); clearInterval(swap); };
  }, [bounce]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.45] });
  const scale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const shadow = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Animated.Text style={[{ fontSize: size }, { transform: [{ translateY }, { scale }] }]}>
          {FOODS[idx]}
        </Animated.Text>
        {/* Bouncing shadow for a bit of life */}
        <Animated.View style={[styles.shadow, { width: size * 0.6, transform: [{ scaleX: shadow }] }]} />
      </View>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  stage: { alignItems: 'center', justifyContent: 'flex-end', height: 64 },
  shadow: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)', marginTop: 4 },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600' },
});

// Small shared UI primitives built on the design system + theme colours.
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { space, radius, typography, elevation } from '../constants/designSystem';

/** Rounded, elevated surface card that adapts to light/dark. */
export function Card({
  children, style, padded = true, level = 1,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  level?: 1 | 2 | 3;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: padded ? space.lg : 0,
        },
        elevation(level),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Uppercase muted section label — e.g. "TODAY'S PROGRESS", "SHORTCUTS". */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        typography.label as TextStyle,
        { color: colors.textMuted, textTransform: 'uppercase', textAlign: 'center', marginBottom: space.md },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A pill badge (e.g. NEW / amount chips). */
export function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

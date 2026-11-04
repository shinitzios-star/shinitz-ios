import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  const { colors } = useTheme();

  // Colors come from the live theme so cards switch with light/dark automatically.
  // SPACING / RADIUS / SHADOWS stay static — they're not theme-dependent.
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        variant === 'elevated' && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  elevated: {
    ...SHADOWS.md,
    borderWidth: 0,
  },
});

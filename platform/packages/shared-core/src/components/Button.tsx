import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const { colors } = useTheme();

  // Background color comes from the live theme so primary stays brand-green
  // in light mode and brand-green-bright in dark mode.
  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'secondary': return colors.success;
      case 'outline':
      case 'ghost':    return 'transparent';
      default:         return colors.primary;
    }
  };

  const getBorderColor = (): string => (variant === 'outline' ? colors.primary : 'transparent');
  const getTextColor = (): string =>
    (variant === 'outline' || variant === 'ghost') ? colors.primary : '#ffffff';

  const sizeStyle =
    size === 'sm' ? styles.sizeSm :
    size === 'lg' ? styles.sizeLg :
    styles.sizeMd;

  const textSizeStyle =
    size === 'sm' ? styles.textSm :
    size === 'lg' ? styles.textLg :
    styles.textMd;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        sizeStyle,
        {
          backgroundColor: getBackgroundColor(),
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: getBorderColor(),
        },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#ffffff'} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, textSizeStyle, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  sizeSm: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  sizeMd: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  sizeLg: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  textSm: { fontSize: FONTS.sizes.sm },
  textMd: { fontSize: FONTS.sizes.lg },
  textLg: { fontSize: FONTS.sizes.xl },
});

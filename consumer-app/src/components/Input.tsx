import React, { useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, StyleProp, TextStyle } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  style,
  ...props
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Build the input style array. Pass styles as a typed array of TextStyle entries
  // so TS doesn't widen short-circuit values (`false`, `""`, `0`) into the union.
  const inputStyle: StyleProp<TextStyle> = [
    styles.input,
    leftIcon ? styles.inputWithLeftIcon : null,
    rightIcon ? styles.inputWithRightIcon : null,
    style,
  ];

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          style={inputStyle}
          placeholderTextColor={colors.textMuted}
          {...props}
        />
        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONTS.sizes.md,
    color: colors.text,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONTS.sizes.lg,
    color: colors.text,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  icon: {
    paddingLeft: SPACING.md,
  },
  iconRight: {
    paddingRight: SPACING.md,
  },
  error: {
    fontSize: FONTS.sizes.sm,
    color: colors.error,
    marginTop: SPACING.xs,
  },
});

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Lightweight global toast (no third-party deps).
 *
 *   const { showToast } = useToast();
 *   showToast({ type: 'success', message: 'Order placed!' });
 *
 * Wrap your app once at root: <ToastProvider>...</ToastProvider>
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastInput {
  message: string;
  type?: ToastType;
  duration?: number;  // ms — default 2500
}

interface ToastContextValue {
  showToast: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICON: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  info: 'information-circle',
  warning: 'warning',
};

const COLOR: Record<ToastType, string> = {
  success: COLORS.success,
  error: COLORS.error,
  info: COLORS.info,
  warning: COLORS.warning,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');

  const translateY = useRef(new Animated.Value(-80)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateIn = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 70,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const animateOut = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [translateY]);

  const showToast = useCallback((t: ToastInput) => {
    setMessage(t.message);
    setType(t.type ?? 'info');
    setVisible(true);

    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(animateOut, t.duration ?? 2500);
  }, [animateOut]);

  useEffect(() => {
    if (visible) animateIn();
  }, [visible, animateIn]);

  // Clear timer on unmount to prevent leaks
  useEffect(() => () => { if (hideTimeout.current) clearTimeout(hideTimeout.current); }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <SafeAreaView style={styles.safe} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: colors.surface, borderLeftColor: COLOR[type], transform: [{ translateY }] },
            ]}
          >
            <Ionicons name={ICON[type]} size={22} color={COLOR[type]} />
            <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>{message}</Text>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.md,
    borderLeftWidth: 4,
    gap: SPACING.sm,
    minWidth: '70%',
    maxWidth: '92%',
    ...SHADOWS.md,
  },
  text: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
});

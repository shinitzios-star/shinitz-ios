import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

/**
 * Top-level error boundary + crash telemetry.
 *
 * Catches any uncaught render error in the React tree so a single bad screen
 * doesn't crash the whole app, shows the ACTUAL error message (a screenshot of
 * this screen is diagnosable), and reports the stack to POST /client-errors so
 * a device crash leaves a trace in the DB. A global handler also reports fatal
 * non-render JS errors (which unmount the root and used to leave nothing but a
 * frozen brand-green window — the "green screen" incidents).
 */

const APP_NAME = 'kirana';

function report(error: any, componentStack?: string, fatal = true) {
  try {
    api.post('/client-errors', {
      app: APP_NAME,
      message: String(error?.message || error || 'unknown'),
      stack: String(error?.stack || ''),
      component_stack: String(componentStack || ''),
      fatal,
    }).catch(() => {});
  } catch {}
}

// Global fatal-JS-error reporter — module scope so it registers exactly once,
// as early as this file is first imported. Chains to the previous handler so
// RN's own crash behavior is unchanged; we just get the stack first.
try {
  const g: any = global as any;
  if (g?.ErrorUtils && !g.__shinitzCrashHook) {
    g.__shinitzCrashHook = true;
    const prev = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((e: any, isFatal?: boolean) => {
      report(e, undefined, !!isFatal);
      prev?.(e, isFatal);
    });
  }
} catch {}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface Props {
  children: React.ReactNode;
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="warning" size={48} color={colors.error} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app ran into an unexpected error. Tap below to try again.
        </Text>
        {/* Always visible (not just dev): a user screenshot of this screen is a
            complete bug report. The stack has already been sent to the server. */}
        <View style={styles.devBox}>
          <Text style={styles.devTitle}>Error details</Text>
          <Text style={styles.devText}>{error.message}</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={onReset}>
          <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    report(error, errorInfo?.componentStack || '', true);
    if (__DEV__) {
      console.error('Unhandled UI error:', error, errorInfo);
    }
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
  }
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  devBox: {
    width: '100%',
    backgroundColor: colors.surfaceLight || colors.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  devTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: colors.error,
    marginBottom: SPACING.xs,
  },
  devText: {
    fontSize: FONTS.sizes.sm,
    color: colors.text,
    fontFamily: 'monospace',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
});

/**
 * BackgroundAlertSetup — one-time prompt that makes sure riders & store partners
 * actually RECEIVE new-order alerts when the app is closed.
 *
 * Requests notification permission (with a clear reason) and, on Android, nudges
 * the user to exclude the app from battery optimization so the loud buzzer fires
 * even when the app is killed/dozing. Only shows while something needs fixing.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { notificationService } from '../services/notifications';

export function BackgroundAlertSetup() {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [needsBattery, setNeedsBattery] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    const status = await notificationService.getPermissionStatus();
    setNeedsPermission(status !== 'granted');
    if (Platform.OS === 'android') {
      const asked = await notificationService.hasAskedBatteryOpt();
      setNeedsBattery(!asked);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  if (dismissed || (!needsPermission && !needsBattery)) return null;

  const enableNotifications = async () => {
    await notificationService.requestPermission();
    await check();
  };
  const fixBattery = async () => {
    await notificationService.requestBatteryOptimizationExemption();
    setNeedsBattery(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="notifications" size={18} color={COLORS.warning} />
        <Text style={styles.title}>Don&apos;t miss new orders</Text>
        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={8}>
          <Ionicons name="close" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.body}>
        Allow alerts so you get a loud notification the moment an order arrives — even when the app is closed.
      </Text>
      <View style={styles.actions}>
        {needsPermission && (
          <TouchableOpacity style={styles.btn} onPress={enableNotifications}>
            <Text style={styles.btnText}>Enable alerts</Text>
          </TouchableOpacity>
        )}
        {!needsPermission && needsBattery && Platform.OS === 'android' && (
          <TouchableOpacity style={styles.btn} onPress={fixBattery}>
            <Text style={styles.btnText}>Allow background alerts</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    backgroundColor: COLORS.warning + '12', borderWidth: 1, borderColor: COLORS.warning + '40',
    borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 6 },
  title: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text },
  body: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SPACING.sm },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  btn: { backgroundColor: COLORS.warning, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: SPACING.lg },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.sm },
});

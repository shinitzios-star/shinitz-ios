import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { VerificationBadge } from '../../src/components/VerificationBadge';
import { BusinessHours } from '../../src/components/BusinessHours';
import { BackgroundAlertSetup } from '../../src/components/BackgroundAlertSetup';
import { useAuthStore } from '../../src/store/authStore';
import { useExitOnBack } from '../../src/hooks/useExitOnBack';
import { storeAPI, authAPI } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RestaurantDashboard() {
  useExitOnBack();
  const { user, login } = useAuthStore();
  const [isOnline, setIsOnline] = useState(true);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    storeAPI.getOnline()
      .then((r) => { if (active) { setIsOnline(r.data?.is_online !== false); setStatusLoaded(true); } })
      .catch(() => { if (active) setStatusLoaded(true); });

    // Refresh the user from the server so verification/approval status is LIVE
    // (admin may have approved after login — header badge would otherwise be stale).
    (async () => {
      try {
        const res = await authAPI.getMe();
        const token = await AsyncStorage.getItem('auth_token');
        if (active && res.data && token) await login(res.data, token);
      } catch {}
    })();

    return () => { active = false; };
  }, []));

  const toggleOnline = async (next: boolean) => {
    setToggling(true);
    setIsOnline(next); // optimistic
    try {
      await storeAPI.setOnline(next);
    } catch (e: any) {
      setIsOnline(!next); // revert
      Alert.alert('Error', e.response?.data?.detail || 'Could not update status');
    } finally { setToggling(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome,</Text>
            <Text style={styles.restaurantName}>{user?.restaurant_name || user?.name}</Text>
          </View>
          <View style={[styles.statusBadge, !user?.verified && styles.pendingBadge]}>
            <Ionicons
              name={user?.verified ? 'checkmark-circle' : 'time'}
              size={16}
              color={user?.verified ? COLORS.success : COLORS.warning}
            />
            <Text style={[styles.statusText, { color: user?.verified ? COLORS.success : COLORS.warning }]}>
              {user?.verified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* ── Online / Offline toggle ─────────────────────────────────────── */}
        <Card style={StyleSheet.flatten([styles.onlineCard, { borderColor: (isOnline ? COLORS.success : COLORS.error) + '55' }])}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? COLORS.success : COLORS.error }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineTitle}>{isOnline ? "You're Online" : "You're Offline"}</Text>
            <Text style={styles.onlineSub}>
              {isOnline ? 'Accepting orders · visible to customers' : 'Hidden from customers · no new orders'}
            </Text>
          </View>
          {toggling || !statusLoaded
            ? <ActivityIndicator color={COLORS.primary} />
            : <Switch value={isOnline} onValueChange={toggleOnline}
                trackColor={{ false: COLORS.border, true: COLORS.success }} thumbColor="#fff" />}
        </Card>

        {/* Make sure background order alerts actually reach the restaurant */}
        <BackgroundAlertSetup />

        {/* Operating hours — auto open/closed for customers */}
        <BusinessHours />

        {/* Live multi-stage verification status (Shinitz Verified badge when approved) */}
        <VerificationBadge />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="receipt" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="cash" size={28} color={COLORS.success} />
            <Text style={styles.statValue}>₹0</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="restaurant" size={28} color={COLORS.info} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Menu Items</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="star" size={28} color={COLORS.warning} />
            <Text style={styles.statValue}>0.0</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </Card>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  restaurantName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + '20',
  },
  onlineCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1.5, marginBottom: SPACING.lg,
  },
  onlineDot: { width: 12, height: 12, borderRadius: 6 },
  onlineTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  onlineSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '10',
    borderColor: COLORS.warning + '30',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.warning,
  },
  verificationText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  statValue: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoCard: {},
  infoTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  checklistText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
});

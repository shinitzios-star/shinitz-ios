import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { VerificationBadge } from '../../src/components/VerificationBadge';
import { useAuthStore } from '../../src/store/authStore';
import { kiranaAPI } from '../../src/services/api';
import { useExitOnBack } from '../../src/hooks/useExitOnBack';

export default function KiranaDashboard() {
  useExitOnBack();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await kiranaAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.storeName}>{user?.store_name || user?.name}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        {/* Live multi-stage verification status */}
        <VerificationBadge />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="receipt" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats?.total_orders || 0}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="time" size={28} color={COLORS.warning} />
            <Text style={styles.statValue}>{stats?.pending_orders || 0}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
            <Text style={styles.statValue}>{stats?.completed_orders || 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Ionicons name="cash" size={28} color={COLORS.success} />
            <Text style={styles.statValue}>₹{stats?.total_earnings || 0}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Card style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.actionText}>Add Product</Text>
          </Card>
          
          <Card style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="receipt" size={24} color={COLORS.success} />
            </View>
            <Text style={styles.actionText}>View Orders</Text>
          </Card>
          
          <Card style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.info + '20' }]}>
              <Ionicons name="bar-chart" size={24} color={COLORS.info} />
            </View>
            <Text style={styles.actionText}>Analytics</Text>
          </Card>
          
          <Card style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning + '20' }]}>
              <Ionicons name="settings" size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.actionText}>Settings</Text>
          </Card>
        </View>

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={COLORS.info} />
            <Text style={styles.infoTitle}>2km Radius Coverage</Text>
          </View>
          <Text style={styles.infoText}>
            You will receive orders from customers within 2km of your store location. Make sure your location is accurate for better order visibility.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  storeName: {
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: COLORS.info + '10',
    borderColor: COLORS.info + '30',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.info,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

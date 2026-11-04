import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { adminAPI } from '../../src/services/api';

const TABS = [
  { id: 'kirana', label: 'Kirana', icon: 'storefront' },
  { id: 'delivery', label: 'Delivery', icon: 'bicycle' },
  { id: 'restaurant', label: 'Restaurant', icon: 'restaurant' },
];

export default function PartnersScreen() {
  const [activeTab, setActiveTab] = useState('kirana');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await adminAPI.getUsers(activeTab);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Read-only status only. Direct one-tap verification was removed — admins must
  // approve/reject partners through the Verification Review tab after reviewing
  // their documents, bank details and profile.
  const statusInfo = (item: any) => {
    const vs = item.verification_status;
    if (vs === 'approved' || item.verified) return { label: 'Verified', color: COLORS.success, icon: 'checkmark-circle' as const };
    if (vs === 'rejected') return { label: 'Rejected', color: COLORS.error, icon: 'close-circle' as const };
    if (vs === 'reverification_required') return { label: 'Re-review', color: COLORS.warning, icon: 'refresh-circle' as const };
    if (vs && vs !== 'registered') return { label: 'Under Review', color: COLORS.warning, icon: 'time' as const };
    return { label: 'Pending', color: COLORS.textMuted, icon: 'ellipse-outline' as const };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Partners</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? COLORS.background : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item }) => (
            <Card style={styles.userCard}>
              <View style={styles.userRow}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {item.store_name || item.restaurant_name || item.name}
                  </Text>
                  <Text style={styles.userPhone}>+{item.phone}</Text>
                  {item.address && (
                    <Text style={styles.userAddress} numberOfLines={1}>{item.address}</Text>
                  )}
                </View>
                {(() => {
                  const s = statusInfo(item);
                  return (
                    <View style={[styles.statusBadge, { backgroundColor: s.color + '18' }]}>
                      <Ionicons name={s.icon} size={16} color={s.color} />
                      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                    </View>
                  );
                })()}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No {activeTab} partners yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  userCard: {
    marginBottom: SPACING.sm,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  userName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  userPhone: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userAddress: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
});

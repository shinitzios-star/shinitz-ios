import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';

export default function KiranaProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  // Shinitz ops / support contact (founder-led support for now).
  const SUPPORT_PHONE = '919971500988';
  const openSupport = () => {
    const msg = encodeURIComponent(
      `Hi Shinitz support, I'm a kirana partner${user?.store_name ? ` (${user.store_name})` : ''} and need help.`,
    );
    Linking.openURL(`whatsapp://send?phone=${SUPPORT_PHONE}&text=${msg}`)
      .catch(() => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {}));
  };

  // Every item routes somewhere real — no dead buttons.
  const menuItems = [
    { icon: 'bar-chart-outline', label: 'Analytics', onPress: () => router.push('/(kirana)/analytics' as any) },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: openSupport },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Store Info */}
        <Card style={styles.storeCard}>
          <View style={styles.storeIcon}>
            <Ionicons name="storefront" size={40} color={COLORS.primary} />
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{user?.store_name || 'Store Name'}</Text>
            <Text style={styles.ownerName}>{user?.name}</Text>
            <Text style={styles.phone}>{formatPhone(user?.phone)}</Text>
            <View style={[styles.badge, user?.verified ? styles.verifiedBadge : styles.pendingBadge]}>
              <Ionicons
                name={user?.verified ? 'checkmark-circle' : 'time'}
                size={14}
                color={user?.verified ? COLORS.success : COLORS.warning}
              />
              <Text style={[styles.badgeText, { color: user?.verified ? COLORS.success : COLORS.warning }]}>
                {user?.verified ? 'Verified' : 'Pending Verification'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.textSecondary} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button
            title="Logout"
            variant="outline"
            onPress={handleLogout}
            style={styles.logoutBtn}
          />
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
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  storeCard: {
    marginHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  storeIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  ownerName: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  phone: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
    gap: 4,
  },
  verifiedBadge: {
    backgroundColor: COLORS.success + '20',
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + '20',
  },
  badgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  menuSection: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuItemText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  actionsSection: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  logoutBtn: {
    width: '100%',
  },
});

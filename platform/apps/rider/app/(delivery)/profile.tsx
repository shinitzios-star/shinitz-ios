import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';

export default function DeliveryProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isVerified = user?.verified === true;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  // Shinitz ops / support contact (founder-led support for now).
  const SUPPORT_PHONE = '919971500988';
  const openSupport = () => {
    const msg = encodeURIComponent(
      `Hi Shinitz support, I'm a delivery partner${user?.name ? ` (${user.name})` : ''} and need help.`,
    );
    Linking.openURL(`whatsapp://send?phone=${SUPPORT_PHONE}&text=${msg}`)
      .catch(() => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {}));
  };
  const soon = (label: string) => Alert.alert(label, 'Coming soon!');

  // Grouped "More" menu, Swiggy-rider style. Every item routes somewhere real
  // or clearly flags itself as upcoming — no dead buttons.
  const GROUPS: { title: string; items: { icon: string; label: string; onPress: () => void }[] }[] = [
    {
      title: 'Earnings',
      items: [
        { icon: 'wallet-outline', label: 'Earnings & Payouts', onPress: () => router.push('/(delivery)/earnings' as any) },
        { icon: 'card-outline', label: 'Wallet', onPress: () => router.push('/(delivery)/wallet' as any) },
        { icon: 'time-outline', label: 'Ride History', onPress: () => router.push('/(delivery)/history' as any) },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'headset-outline', label: 'Help & Support', onPress: openSupport },
        { icon: 'shield-checkmark-outline', label: 'Verification', onPress: () => router.push('/(delivery)/verification' as any) },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => soon('Notifications') },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: 'document-text-outline', label: 'Legal', onPress: () => soon('Legal') },
        { icon: 'settings-outline', label: 'Settings', onPress: () => soon('Settings') },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}><Ionicons name="bicycle" size={36} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || 'Delivery Partner'}</Text>
            <Text style={styles.phone}>{formatPhone(user?.phone)}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.vehicleBadge}>
                <Ionicons name="car" size={12} color={COLORS.info} />
                <Text style={styles.vehicleText}>{user?.vehicle_type || 'Bike'}</Text>
              </View>
              <View style={[styles.vehicleBadge, { backgroundColor: (isVerified ? COLORS.success : COLORS.warning) + '20' }]}>
                <Ionicons name={isVerified ? 'checkmark-circle' : 'time'} size={12} color={isVerified ? COLORS.success : COLORS.warning} />
                <Text style={[styles.vehicleText, { color: isVerified ? COLORS.success : COLORS.warning }]}>
                  {isVerified ? 'Verified' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payout UPI */}
        <View style={styles.upiCard}>
          <View style={styles.upiIcon}><Ionicons name="wallet" size={20} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upiLabel}>Payout UPI</Text>
            <Text style={styles.upiValue}>{user?.upi_id || 'Not added'}</Text>
          </View>
        </View>

        {/* Grouped menu */}
        {GROUPS.map((g) => (
          <View key={g.title} style={styles.group}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.groupCard}>
              {g.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, i < g.items.length - 1 && styles.menuItemBorder]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuLeft}>
                    <View style={styles.menuIcon}><Ionicons name={item.icon as any} size={18} color={COLORS.primary} /></View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Shinitz Partner · v1.5.5</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, paddingTop: SPACING.lg },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  userName: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  phone: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.info + '20', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  vehicleText: { fontSize: FONTS.sizes.xs, color: COLORS.info, fontWeight: '700' },

  upiCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  upiIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' },
  upiLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  upiValue: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text, marginTop: 1 },

  group: { marginTop: SPACING.lg, paddingHorizontal: SPACING.md },
  groupTitle: { fontSize: FONTS.sizes.xs, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.sm, marginLeft: SPACING.xs },
  groupCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', ...SHADOWS.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.error + '50', backgroundColor: COLORS.error + '0c',
  },
  logoutText: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.error },
  version: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.lg },
});

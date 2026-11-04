import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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
      `Hi Shinitz support, I'm an admin${user?.name ? ` (${user.name})` : ''} and need help.`,
    );
    Linking.openURL(`whatsapp://send?phone=${SUPPORT_PHONE}&text=${msg}`)
      .catch(() => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {}));
  };

  // Every item routes somewhere real — no dead buttons.
  const menuItems = [
    { icon: 'stats-chart-outline', label: 'Analytics', onPress: () => router.push('/(admin)/analytics' as any) },
    { icon: 'radio-outline', label: 'Live Orders', onPress: () => router.push('/(admin)/live-orders' as any) },
    { icon: 'cash-outline', label: 'Commission', onPress: () => router.push('/(admin)/commission' as any) },
    { icon: 'key-outline', label: 'Roles & Access', onPress: () => router.push('/(admin)/roles' as any) },
    { icon: 'list-outline', label: 'Service Requests', onPress: () => router.push('/(admin)/service-requests' as any) },
    { icon: 'text-outline', label: 'App Content & Texts', onPress: () => router.push('/(admin)/content' as any) },
    { icon: 'megaphone-outline', label: 'Offers & Banners', onPress: () => router.push('/(admin)/offers' as any) },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: openSupport },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}><Text style={styles.headerTitle}>Settings</Text></View>
        <Card style={styles.userCard}>
          <View style={styles.avatar}><Ionicons name="shield-checkmark" size={40} color={COLORS.primary} /></View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Admin'}</Text>
            <Text style={styles.phone}>{formatPhone(user?.phone)}</Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMINISTRATOR</Text>
            </View>
          </View>
        </Card>
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.textSecondary} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actionsSection}>
          <Button title="Logout" variant="outline" onPress={handleLogout} style={styles.logoutBtn} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text },
  userCard: { marginHorizontal: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  phone: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: 2 },
  adminBadge: { backgroundColor: COLORS.primary + '20', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, alignSelf: 'flex-start', marginTop: SPACING.xs },
  adminBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
  menuSection: { marginTop: SPACING.lg, paddingHorizontal: SPACING.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuItemText: { fontSize: FONTS.sizes.md, color: COLORS.text },
  actionsSection: { marginTop: SPACING.xl, paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  logoutBtn: { width: '100%' },
});

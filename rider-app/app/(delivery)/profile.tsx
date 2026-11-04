// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Rider — More page. Reference-aligned (hero + quick actions + grouped
// settings + plain list + version), rebuilt in SHINITZ green/gold. Preserves
// every existing action (logout, WhatsApp support, earnings/wallet/history/
// verification, UPI payout, notifications/legal/settings).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients, hitSlop } from '../../src/constants/designSystem';
import { Card } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';
import { VehicleIcon } from '../../src/utils/vehicleIcon';

export default function DeliveryMoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const isVerified = user?.verified === true;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  const SUPPORT_PHONE = '919971500988';
  const openSupport = () => {
    const msg = encodeURIComponent(`Hi Shinitz support, I'm a delivery partner${user?.name ? ` (${user.name})` : ''} and need help.`);
    Linking.openURL(`whatsapp://send?phone=${SUPPORT_PHONE}&text=${msg}`)
      .catch(() => Linking.openURL(`tel:+${SUPPORT_PHONE}`).catch(() => {}));
  };
  const soon = (label: string) => Alert.alert(label, 'Coming soon!');
  const go = (path: string) => router.push(path as any);

  // Quick actions (the 4 top cards).
  const QUICK = [
    { icon: 'person-outline', label: 'My Profile', onPress: () => go('/(delivery)/verification') },
    { icon: 'cash-outline', label: 'Floating Cash', onPress: () => go('/(delivery)/wallet') },
    { icon: 'alert-circle-outline', label: 'Report Issue', onPress: openSupport },
    { icon: 'chatbubble-ellipses-outline', label: 'Message Center', onPress: () => soon('Message Center') },
  ] as const;

  // Grouped settings card — existing functional items + reference services.
  const GROUP: { icon: string; mci?: boolean; label: string; badge?: string; badgeTone?: 'green' | 'new'; onPress: () => void }[] = [
    { icon: 'account-multiple-plus-outline', mci: true, label: 'Refer & Earn', badge: 'Upto ₹20,000', badgeTone: 'green', onPress: () => go('/(delivery)/refer') },
    { icon: 'wallet-outline', label: 'Earnings & Payouts', onPress: () => go('/(delivery)/earnings') },
    { icon: 'card-outline', label: 'Wallet', onPress: () => go('/(delivery)/wallet') },
    { icon: 'time-outline', label: 'Ride History', onPress: () => go('/(delivery)/history') },
    { icon: 'shield-checkmark-outline', label: 'Verification', onPress: () => go('/(delivery)/verification') },
    { icon: 'medal-outline', mci: true, label: 'Partner Club', onPress: () => soon('Partner Club') },
    { icon: 'shield-plus-outline', mci: true, label: 'Insurance', onPress: () => soon('Insurance') },
    { icon: 'account-group-outline', mci: true, label: 'Partner Meetings', badge: 'NEW', badgeTone: 'new', onPress: () => soon('Partner Meetings') },
    { icon: 'headset-outline', label: 'Help & Support', onPress: openSupport },
    { icon: 'cash-multiple', mci: true, label: 'Ways to Earn', onPress: () => go('/(delivery)/earnings') },
    { icon: 'sale-outline', mci: true, label: 'Special Benefits', badge: 'NEW', badgeTone: 'new', onPress: () => soon('Special Benefits') },
    { icon: 'storefront-outline', label: 'SHINITZ Store', onPress: () => soon('SHINITZ Store') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => soon('Notifications') },
  ];

  // Plain list (no card) at the bottom.
  const PLAIN = [
    { label: 'Login History', onPress: () => soon('Login History') },
    { label: 'SHINITZ Academy', onPress: () => soon('SHINITZ Academy') },
    { label: 'SHINITZ Skills', onPress: () => soon('SHINITZ Skills') },
    { label: 'Legal', onPress: () => soon('Legal') },
    { label: 'Settings', onPress: () => soon('Settings') },
  ];

  const s = makeStyles(colors);
  const partnerId = String(user?.id || '—').replace(/-/g, '').toUpperCase().slice(0, 10);

  return (
    <View style={s.screen}>
      {/* ── Hero ── */}
      <LinearGradient colors={gradients.heroWarm as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + space.sm }]}>
        <View style={s.heroTop}>
          <View />
          <TouchableOpacity style={s.helpBtn} onPress={openSupport} hitSlop={hitSlop}>
            <Text style={s.helpText}>Help</Text>
          </TouchableOpacity>
        </View>
        <View style={s.heroBody}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name || 'Delivery Partner'}</Text>
            <Text style={s.deId}>Partner ID : {partnerId}</Text>
            <Text style={s.phone}>{formatPhone(user?.phone)}</Text>
            <View style={s.badgeRow}>
              <View style={s.miniBadge}>
                <VehicleIcon type={user?.vehicle_type || 'Bike'} size={12} color="#fff" />
                <Text style={s.miniBadgeText}>{user?.vehicle_type || 'Bike'}</Text>
              </View>
              <View style={s.miniBadge}>
                <Ionicons name={isVerified ? 'checkmark-circle' : 'time'} size={12} color="#fff" />
                <Text style={s.miniBadgeText}>{isVerified ? 'Verified' : 'Pending'}</Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'center' }}>
            <LinearGradient colors={gradients.gold as any} style={s.tierCircle}>
              <MaterialCommunityIcons name="star-four-points" size={26} color="#fff" />
            </LinearGradient>
            <View style={[s.tierLabel, { backgroundColor: colors.primaryDark }]}>
              <Text style={s.tierLabelText}>Hero ›</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Quick actions ── */}
        <View style={s.quickRow}>
          {QUICK.map((q) => (
            <TouchableOpacity key={q.label} activeOpacity={0.85} onPress={q.onPress} style={s.quickCard}>
              <Ionicons name={q.icon as any} size={22} color={colors.primary} />
              <Text style={s.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Payout UPI (preserved) ── */}
        <View style={{ paddingHorizontal: space.lg }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.upiIcon, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="wallet" size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={[typography.caption as any, { color: colors.textSecondary }]}>Payout UPI</Text>
              <Text style={[typography.bodyStrong as any, { color: colors.text }]}>{user?.upi_id || 'Not added'}</Text>
            </View>
          </Card>
        </View>

        {/* ── Grouped settings ── */}
        <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
          <Card padded={false}>
            {GROUP.map((it, i) => (
              <TouchableOpacity key={it.label} activeOpacity={0.7} onPress={it.onPress}
                style={[s.row, i < GROUP.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={s.rowLeft}>
                  {it.mci
                    ? <MaterialCommunityIcons name={it.icon as any} size={22} color={colors.text} />
                    : <Ionicons name={it.icon as any} size={22} color={colors.text} />}
                  <Text style={[typography.body as any, { color: colors.text, fontWeight: '600' }]}>{it.label}</Text>
                  {it.badge && (
                    <View style={[s.badge, it.badgeTone === 'new'
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                      <Text style={[s.badgeText, { color: it.badgeTone === 'new' ? '#fff' : colors.successDark }]}>{it.badge}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Card>
        </View>

        {/* ── Plain list ── */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl, gap: space.xl }}>
          {PLAIN.map((p) => (
            <TouchableOpacity key={p.label} activeOpacity={0.6} onPress={p.onPress}>
              <Text style={[typography.h3 as any, { color: colors.text }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout + version ── */}
        <TouchableOpacity style={[s.logout, { borderColor: colors.error + '55', backgroundColor: colors.error + '0e' }]} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[typography.bodyStrong as any, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
        <Text style={[typography.caption as any, { color: colors.textMuted, textAlign: 'center', marginTop: space.lg }]}>
          SHINITZ Partner · v1.5.5
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: space.lg, paddingBottom: space.xl, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helpBtn: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 7, ...elevation(1) },
  helpText: { color: '#0b3325', fontWeight: '800', fontSize: 13 },
  heroBody: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.lg },
  name: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  deId: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', marginTop: 4 },
  phone: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  miniBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tierCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  tierLabel: { marginTop: -10, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 3 },
  tierLabelText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.lg },
  quickCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingVertical: space.md, paddingHorizontal: 6, alignItems: 'center', gap: 8, ...elevation(1) },
  quickLabel: { fontSize: 11.5, fontWeight: '700', color: colors.text, textAlign: 'center' },
  upiIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: 15 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginHorizontal: space.lg, marginTop: space.xl, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5 },
});

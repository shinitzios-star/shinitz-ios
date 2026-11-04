import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Linking, Image, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTranslation } from 'react-i18next';

const TERMS_URL = 'https://shinitz.com/terms-of-service';
const PRIVACY_URL = 'https://shinitz.com/privacy-policy';
const HELP_URL = 'https://shinitz.com/help';

// ── Reusable grouped row ──────────────────────────────────────────────────────
function Row({
  icon, label, value, onPress, right, isLast, colors,
}: any) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !right}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
        </View>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text> : null}
        {right}
        {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { colors, isDark } = useTheme();
  const { themeMode, setThemeMode, language, setLanguage, vegMode, setVegMode } = useSettingsStore();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logoutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  const handleThemeCycle = async () => {
    const modes = ['dark', 'light', 'system'] as const;
    const next = modes[(modes.indexOf(themeMode) + 1) % modes.length];
    await setThemeMode(next);
  };

  const handleLanguageToggle = async () => {
    const next = language === 'en' ? 'hi' : 'en';
    await setLanguage(next);
    i18n.changeLanguage(next);
  };

  const themeLabel = themeMode === 'dark' ? 'Dark' : themeMode === 'light' ? 'Light' : 'System';

  const openExternal = async (url: string) => {
    try { await WebBrowser.openBrowserAsync(url); }
    catch { showToast({ type: 'error', message: 'Could not open link' }); }
  };
  const openNotifSettings = async () => {
    try { await Linking.openSettings(); }
    catch { showToast({ type: 'error', message: 'Could not open settings' }); }
  };

  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header: avatar + name + view activity ─────────────────────────── */}
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarInitial, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitialText}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{user?.name || 'User'}</Text>
            <TouchableOpacity onPress={() => router.push('/(consumer)/orders')}>
              <Text style={[styles.viewActivity, { color: colors.success }]}>View activity ›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/(consumer)/edit-profile')} style={styles.editIcon}>
            <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Quick actions row ─────────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(consumer)/orders')}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Your Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(consumer)/favorites')}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="heart-outline" size={20} color={'#ef4444'} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Wishlist</Text>
          </TouchableOpacity>
        </View>

        {/* ── Preferences group ─────────────────────────────────────────────── */}
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>PREFERENCES</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row
            colors={colors} icon="leaf-outline" label="Veg Mode"
            right={
              <Switch
                value={vegMode}
                onValueChange={setVegMode}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor="#fff"
              />
            }
          />
          <Row colors={colors} icon={isDark ? 'moon-outline' : 'sunny-outline'} label="Appearance"
               value={themeLabel} onPress={handleThemeCycle} />
          <Row colors={colors} icon="language-outline" label="Language"
               value={language === 'en' ? 'English' : 'हिंदी'} onPress={handleLanguageToggle} />
          <Row colors={colors} icon="notifications-outline" label="Notifications"
               onPress={openNotifSettings} isLast />
        </View>

        {/* ── Account group ─────────────────────────────────────────────────── */}
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>ACCOUNT</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row colors={colors} icon="person-outline" label="Edit profile"
               onPress={() => router.push('/(consumer)/edit-profile')} />
          <Row colors={colors} icon="gift-outline" label="Refer & Earn"
               onPress={() => router.push('/(consumer)/refer' as any)} />
          <Row colors={colors} icon="location-outline" label="Saved addresses"
               onPress={() => router.push('/(consumer)/addresses')} />
          <Row colors={colors} icon="card-outline" label="Payment methods"
               onPress={() => router.push('/(consumer)/payment-methods')} />
          <Row colors={colors} icon="chatbubble-ellipses-outline" label="Chat support"
               onPress={() => router.push('/(consumer)/chat')} isLast />
        </View>

        {/* ── More group ────────────────────────────────────────────────────── */}
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>MORE</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row colors={colors} icon="help-circle-outline" label="Help & Support"
               onPress={() => openExternal(HELP_URL)} />
          <Row colors={colors} icon="document-text-outline" label="Terms of Service"
               onPress={() => openExternal(TERMS_URL)} />
          <Row colors={colors} icon="shield-checkmark-outline" label="Privacy Policy"
               onPress={() => openExternal(PRIVACY_URL)} isLast />
        </View>

        {/* ── Logout ────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.error + '55' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>{t('logout')}</Text>
        </TouchableOpacity>

        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.primary }]}>Shinitz</Text>
          <Text style={[styles.appVersion, { color: colors.textMuted }]}>Version 1.4</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: 110 },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACING.md,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarInitial: { justifyContent: 'center', alignItems: 'center' },
  avatarInitialText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: FONTS.sizes.xxl, fontWeight: '800' },
  viewActivity: { fontSize: FONTS.sizes.md, fontWeight: '600', marginTop: 2 },
  editIcon: { padding: 4 },

  goldBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  goldIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  goldText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },

  quickRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  quickCard: {
    flex: 1, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  quickIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: FONTS.sizes.md, fontWeight: '700', flex: 1 },

  groupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm, marginLeft: 4 },
  group: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14, minHeight: 56,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: FONTS.sizes.md, fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowValue: { fontSize: FONTS.sizes.sm, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.lg, borderWidth: 1, paddingVertical: 14, marginTop: SPACING.xl,
  },
  logoutText: { fontSize: FONTS.sizes.md, fontWeight: '700' },

  appInfo: { alignItems: 'center', marginTop: SPACING.lg },
  appName: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  appVersion: { fontSize: FONTS.sizes.xs, marginTop: 2 },
});

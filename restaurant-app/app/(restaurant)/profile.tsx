// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Restaurant — Profile (premium merchant redesign, pass 3).
// Photo pick/upload/remove flow is untouched (camera/gallery → PATCH
// /users/profile → refresh auth store). New: gradient hero with the avatar,
// verified pill, business-info card, grouped navigation rows, danger logout.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients, hitSlop } from '../../src/constants/designSystem';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';
import api from '../../src/services/api';

export default function RestaurantProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, login, logout } = useAuthStore();
  const [uploading, setUploading] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  // ── Pick + upload restaurant profile photo ───────────────────────────────
  const changePhoto = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', `Allow ${fromCamera ? 'camera' : 'photo'} access to set a picture`);
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert('Error', 'Could not read image'); return; }
      if (asset.base64.length > 1_500_000) { Alert.alert('Too large', 'Pick a smaller photo (under ~1 MB)'); return; }

      setUploading(true);
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      const res = await api.patch('/users/profile', { avatar_url: dataUrl });
      if (res.data?.success && res.data.user) {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) await login(res.data.user, token);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update photo');
    } finally {
      setUploading(false);
    }
  };

  const onAvatarPress = () => {
    Alert.alert('Restaurant Photo', 'Choose a source', [
      { text: 'Take Photo', onPress: () => changePhoto(true) },
      { text: 'Choose from Gallery', onPress: () => changePhoto(false) },
      ...(user?.avatar_url
        ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: async () => {
            setUploading(true);
            try {
              const res = await api.patch('/users/profile', { avatar_url: null });
              const token = await AsyncStorage.getItem('auth_token');
              if (res.data?.user && token) await login(res.data.user, token);
            } catch {} finally { setUploading(false); }
          } }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const go = (route: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(route as any);
  };

  const LINKS: { icon: any; tint: string; label: string; sub: string; route: string }[] = [
    { icon: 'create-outline', tint: colors.primary, label: 'Edit Profile', sub: 'Name, contact & business details', route: '/(restaurant)/edit-profile' },
    { icon: 'shield-checkmark-outline', tint: '#06b6d4', label: 'Verification & Documents', sub: 'FSSAI, licences, bank details', route: '/(restaurant)/verification' },
    { icon: 'wallet-outline', tint: '#10b981', label: 'Earnings & Payouts', sub: 'Balances, settlements & statements', route: '/(restaurant)/payouts' },
    { icon: 'megaphone-outline', tint: '#8b5cf6', label: 'Ad Campaigns', sub: 'Promotions & performance', route: '/(restaurant)/campaigns' },
  ];

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Gradient hero: avatar + identity */}
        <LinearGradient colors={gradients.hero as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <SafeAreaView edges={['top']}>
            <Text style={s.heroTitle}>Profile</Text>
            <View style={s.heroRow}>
              <TouchableOpacity style={s.avatarWrap} onPress={onAvatarPress} disabled={uploading} activeOpacity={0.8}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                    <Ionicons name="restaurant" size={34} color="#efd27a" />
                  </View>
                )}
                <View style={[s.cameraBadge, { backgroundColor: '#D4AF37' }]}>
                  {uploading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="camera" size={13} color="#fff" />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.heroName} numberOfLines={1}>{user?.restaurant_name || 'Restaurant'}</Text>
                <Text style={s.heroPhone}>{formatPhone(user?.phone)}</Text>
                <View style={[s.verifyPill, { backgroundColor: user?.verified ? 'rgba(212,175,55,0.25)' : 'rgba(245,158,11,0.25)' }]}>
                  <Ionicons name={user?.verified ? 'checkmark-circle' : 'time'} size={12}
                    color={user?.verified ? '#efd27a' : '#fcd34d'} />
                  <Text style={[s.verifyText, { color: user?.verified ? '#efd27a' : '#fcd34d' }]}>
                    {user?.verified ? 'Shinitz Verified' : 'Verification Pending'}
                  </Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ paddingHorizontal: space.lg }}>
          {/* Business information */}
          <View style={[s.card, { backgroundColor: colors.card }, elevation(1)]}>
            <Text style={[s.groupLabel, { color: colors.textMuted }]}>BUSINESS INFORMATION</Text>
            <InfoRow colors={colors} icon="business-outline" label="Restaurant"
              value={user?.restaurant_name || '—'} />
            <InfoRow colors={colors} icon="call-outline" label="Phone"
              value={formatPhone(user?.phone) || '—'} />
            <InfoRow colors={colors} icon="document-text-outline" label="FSSAI Licence"
              value={user?.fssai_number || 'Not added'} last />
          </View>

          {/* Manage group */}
          <View style={[s.card, { backgroundColor: colors.card }, elevation(1)]}>
            <Text style={[s.groupLabel, { color: colors.textMuted }]}>MANAGE</Text>
            {LINKS.map((l, i) => (
              <TouchableOpacity key={l.label} style={[s.linkRow, i < LINKS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                activeOpacity={0.7} onPress={() => go(l.route)}>
                <View style={[s.linkIcon, { backgroundColor: l.tint + '14' }]}>
                  <Ionicons name={l.icon} size={19} color={l.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong as any, { color: colors.text }]}>{l.label}</Text>
                  <Text style={[typography.caption as any, { color: colors.textSecondary }]}>{l.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[s.logoutBtn, { backgroundColor: colors.card, borderColor: colors.error + '44' }, elevation(1)]}
            onPress={handleLogout} activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={19} color={colors.error} />
            <Text style={[typography.bodyStrong as any, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={[s.brand, { color: colors.primary }]}>Shinitz Partner</Text>
            <Text style={[typography.caption as any, { color: colors.textMuted }]}>Made for your restaurant</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ colors, icon, label, value, last }: any) {
  return (
    <View style={[s.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
      <Ionicons name={icon} size={17} color={colors.textSecondary} />
      <Text style={[typography.caption as any, { color: colors.textSecondary, width: 96 }]}>{label}</Text>
      <Text style={[typography.bodyStrong as any, { color: colors.text, flex: 1 }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  hero: {
    paddingHorizontal: space.lg, paddingBottom: space.xxl,
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
  },
  heroTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700', paddingTop: space.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(212,175,55,0.6)',
  },
  avatarImg: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: 'rgba(212,175,55,0.8)' },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#12503a',
  },
  heroName: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  heroPhone: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  verifyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, marginTop: 7,
  },
  verifyText: { fontSize: 11, fontWeight: '800' },
  card: { borderRadius: radius.lg, padding: space.lg, marginTop: space.lg },
  groupLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: space.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  linkIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.lg, borderWidth: 1, paddingVertical: 14, marginTop: space.lg,
  },
  footer: { alignItems: 'center', marginTop: space.xxl, gap: 2 },
  brand: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';
import api from '../../src/services/api';

export default function RestaurantProfileScreen() {
  const router = useRouter();
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}><Text style={styles.headerTitle}>Profile</Text></View>

        <Card style={styles.userCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={onAvatarPress} disabled={uploading} activeOpacity={0.8}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}><Ionicons name="restaurant" size={40} color={COLORS.primary} /></View>
            )}
            <View style={styles.cameraBadge}>
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.restaurant_name || 'Restaurant'}</Text>
            <Text style={styles.phone}>{formatPhone(user?.phone)}</Text>
            {user?.fssai_number ? <Text style={styles.fssai}>FSSAI: {user.fssai_number}</Text> : null}
            <TouchableOpacity onPress={onAvatarPress}>
              <Text style={styles.changePhoto}>{user?.avatar_url ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.actionsSection}>
          <Button
            title="Edit Profile"
            onPress={() => router.push('/(restaurant)/edit-profile' as any)}
            style={styles.editBtn}
          />
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
  avatarWrap: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  avatarImg: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: COLORS.primary },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  phone: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: 2 },
  fssai: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
  changePhoto: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600', marginTop: 6 },
  actionsSection: { marginTop: SPACING.xl, paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  editBtn: { width: '100%' },
  logoutBtn: { width: '100%' },
});

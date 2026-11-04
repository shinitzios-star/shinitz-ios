import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { useToast } from '../../src/components/Toast';
import { formatPhone } from '../../src/utils/format';
import api from '../../src/services/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, login } = useAuthStore();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState(user?.address || '');
  // Local pending change — uploaded with the rest of the form on Save
  const [avatar, setAvatar] = useState<string | null>(user?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  // ── Pick a photo via gallery or camera ────────────────────────────────────
  const pickPhotoFromGallery = async () => {
    setPickingPhoto(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast({ type: 'warning', message: 'Photo permission denied' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        showToast({ type: 'error', message: 'Failed to read image' });
        return;
      }
      // Roughly cap at ~1 MB (matches backend MAX_AVATAR_LEN)
      if (asset.base64.length > 1_500_000) {
        showToast({ type: 'warning', message: 'Image too large. Try a smaller photo.' });
        return;
      }
      setAvatar(`data:image/jpeg;base64,${asset.base64}`);
    } catch (e) {
      if (__DEV__) console.warn('Image pick failed:', e);
      showToast({ type: 'error', message: 'Could not open photo library' });
    } finally {
      setPickingPhoto(false);
    }
  };

  const takePhotoWithCamera = async () => {
    setPickingPhoto(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast({ type: 'warning', message: 'Camera permission denied' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        showToast({ type: 'error', message: 'Failed to read image' });
        return;
      }
      if (asset.base64.length > 1_500_000) {
        showToast({ type: 'warning', message: 'Image too large. Try a smaller photo.' });
        return;
      }
      setAvatar(`data:image/jpeg;base64,${asset.base64}`);
    } catch (e) {
      if (__DEV__) console.warn('Camera failed:', e);
      showToast({ type: 'error', message: 'Could not open camera' });
    } finally {
      setPickingPhoto(false);
    }
  };

  // Show the action sheet on tap
  const handleChangePhoto = () => {
    Alert.alert(
      'Change Photo',
      'Choose a source',
      [
        { text: 'Take Photo', onPress: takePhotoWithCamera },
        { text: 'Choose from Gallery', onPress: pickPhotoFromGallery },
        ...(avatar
          ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setAvatar(null) }]
          : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  // ── Save: name + address + avatar in one PATCH ────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ type: 'error', message: 'Name is required' });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim(),
      };
      // Only include avatar_url when it actually changed (saves bandwidth)
      if (avatar !== (user?.avatar_url ?? null)) {
        body.avatar_url = avatar;
      }

      const response = await api.patch('/users/profile', body);

      if (response.data?.success) {
        // Refresh the auth store with the canonical user from the server
        const token = await AsyncStorage.getItem('auth_token');
        if (token && response.data.user) {
          await login(response.data.user, token);
        }
        showToast({ type: 'success', message: 'Profile updated' });
        router.back();
      } else {
        showToast({ type: 'error', message: 'Update failed' });
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Failed to update profile';
      showToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleChangePhoto}
              disabled={pickingPhoto}
              style={styles.avatarTouch}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Ionicons name="person" size={48} color={colors.primary} />
                </View>
              )}
              <View style={styles.editBadge}>
                {pickingPhoto ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#ffffff" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={handleChangePhoto}
              disabled={pickingPhoto}
            >
              <Ionicons name="camera" size={16} color={colors.text} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons name="call-outline" size={20} color={colors.textMuted} />
                <Text style={styles.disabledText}>{formatPhone(user?.phone) || '+91 XXXXXXXXXX'}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Delivery Address</Text>
              <View style={[styles.inputContainer, styles.inputMultiline]}>
                <Ionicons name="location-outline" size={20} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter your delivery address"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Role</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons name="shield-outline" size={20} color={colors.textMuted} />
                <Text style={styles.disabledText}>
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            size="lg"
            style={styles.saveBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  content: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.lg },
  avatarTouch: { position: 'relative' },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.primary,
    ...SHADOWS.md,
  },
  avatarImage: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: colors.primary,
    ...SHADOWS.md,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: colors.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: colors.border,
  },
  changePhotoText: { fontSize: FONTS.sizes.sm, color: colors.text, fontWeight: '500' },
  form: { paddingHorizontal: SPACING.md, gap: SPACING.lg },
  fieldGroup: { gap: SPACING.sm },
  label: {
    fontSize: FONTS.sizes.sm, fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  inputDisabled: { opacity: 0.6 },
  inputMultiline: { alignItems: 'flex-start' },
  input: { flex: 1, fontSize: FONTS.sizes.md, color: colors.text, padding: 0 },
  disabledText: { flex: 1, fontSize: FONTS.sizes.md, color: colors.textSecondary },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: FONTS.sizes.xs, color: colors.success, fontWeight: '600' },
  footer: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  saveBtn: { width: '100%' },
});

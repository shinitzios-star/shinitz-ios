import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { formatPhone } from '../../src/utils/format';
import api from '../../src/services/api';

export default function RestaurantEditProfileScreen() {
  const router = useRouter();
  const { user, login } = useAuthStore();

  const [restaurantName, setRestaurantName] = useState(user?.restaurant_name || user?.store_name || '');
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [address, setAddress] = useState(user?.address || '');
  const [fssai, setFssai] = useState(user?.fssai_number || '');
  const [gst, setGst] = useState(user?.gst_number || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const pick = async (fromCamera: boolean) => {
    setPickingPhoto(true);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', `Allow ${fromCamera ? 'camera' : 'photo'} access`); return; }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert('Error', 'Could not read image'); return; }
      if (asset.base64.length > 1_500_000) { Alert.alert('Too large', 'Pick a smaller photo (under ~1 MB)'); return; }
      setAvatar(`data:image/jpeg;base64,${asset.base64}`);
    } catch {
      Alert.alert('Error', 'Could not open the photo picker');
    } finally { setPickingPhoto(false); }
  };

  const handleChangePhoto = () => {
    Alert.alert('Restaurant Photo', 'Choose a source', [
      { text: 'Take Photo', onPress: () => pick(true) },
      { text: 'Choose from Gallery', onPress: () => pick(false) },
      ...(avatar ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setAvatar(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleSave = async () => {
    if (!restaurantName.trim()) { Alert.alert('Required', 'Restaurant name is required'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        restaurant_name: restaurantName.trim(),
        store_name: restaurantName.trim(),
        name: ownerName.trim() || restaurantName.trim(),
        address: address.trim(),
        fssai_number: fssai.trim(),
        gst_number: gst.trim(),
      };
      if (avatar !== (user?.avatar_url ?? null)) body.avatar_url = avatar;

      const res = await api.patch('/users/profile', body);
      if (res.data?.success) {
        const token = await AsyncStorage.getItem('auth_token');
        if (token && res.data.user) await login(res.data.user, token);
        Alert.alert('Saved', 'Your profile has been updated.');
        router.back();
      } else {
        Alert.alert('Error', 'Update failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const Field = ({ label, icon, value, onChange, placeholder, multiline, keyboardType, autoCapitalize }: any) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, multiline && styles.inputMultiline]}>
        <Ionicons name={icon} size={20} color={COLORS.textSecondary} style={multiline ? { marginTop: 2 } : undefined} />
        <TextInput
          style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <TouchableOpacity activeOpacity={0.8} onPress={handleChangePhoto} disabled={pickingPhoto} style={styles.avatarTouch}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}><Ionicons name="restaurant" size={44} color={COLORS.primary} /></View>
              )}
              <View style={styles.editBadge}>
                {pickingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.changePhotoBtn} onPress={handleChangePhoto} disabled={pickingPhoto}>
              <Ionicons name="camera" size={16} color={COLORS.text} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Field label="Restaurant Name" icon="storefront-outline" value={restaurantName} onChange={setRestaurantName} placeholder="Your restaurant's name" />
            <Field label="Owner Name" icon="person-outline" value={ownerName} onChange={setOwnerName} placeholder="Owner / contact name" />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons name="call-outline" size={20} color={COLORS.textMuted} />
                <Text style={styles.disabledText}>{formatPhone(user?.phone) || '+91 XXXXXXXXXX'}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>

            <Field label="Address" icon="location-outline" value={address} onChange={setAddress} placeholder="Restaurant address" multiline />
            <Field label="FSSAI Number" icon="document-text-outline" value={fssai} onChange={setFssai} placeholder="FSSAI license number" keyboardType="number-pad" />
            <Field label="GST Number" icon="receipt-outline" value={gst} onChange={setGst} placeholder="GST number (optional)" autoCapitalize="characters" />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" style={styles.saveBtn} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  content: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.lg },
  avatarTouch: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.primary, ...SHADOWS.md },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary, ...SHADOWS.md },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.background },
  changePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  changePhotoText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  form: { paddingHorizontal: SPACING.md, gap: SPACING.lg },
  fieldGroup: { gap: SPACING.sm },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  inputDisabled: { opacity: 0.6 },
  inputMultiline: { alignItems: 'flex-start' },
  input: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text, padding: 0 },
  disabledText: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: FONTS.sizes.xs, color: COLORS.success, fontWeight: '600' },
  footer: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn: { width: '100%' },
});

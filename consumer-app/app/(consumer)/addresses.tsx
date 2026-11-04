import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Button } from '../../src/components/Button';
import api from '../../src/services/api';
import { useAddressStore } from '../../src/store/addressStore';
import { resolveCoords, currentLocationAddress } from '../../src/utils/address';

export default function AddressesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    label: 'Home', full_address: '', landmark: '', instructions: '', is_default: false,
    lat: null as number | null, lng: null as number | null,
  });
  const { setSelected } = useAddressStore();

  // Internal label values stay in English (DB stores them); display labels come from t().
  const labels = ['Home', 'Work', 'Other'];
  const labelI18nKey = (l: string) =>
    l === 'Home' ? t('labelHome') : l === 'Work' ? t('labelWork') : t('labelOther');
  const labelIcons: Record<string, string> = { Home: 'home', Work: 'briefcase', Other: 'location' };

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await api.get('/addresses');
      setAddresses(res.data);
    } catch (e) {
      if (__DEV__) console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const openAdd = () => {
    setEditId(null);
    setForm({ label: 'Home', full_address: '', landmark: '', instructions: '', is_default: false, lat: null, lng: null });
    setShowModal(true);
  };

  const openEdit = (addr: any) => {
    setEditId(addr.id);
    setForm({
      label: addr.label, full_address: addr.full_address, landmark: addr.landmark || '',
      instructions: addr.instructions || '',
      is_default: addr.is_default, lat: addr.lat ?? null, lng: addr.lng ?? null,
    });
    setShowModal(true);
  };

  // Fill the address text + coordinates from the device's current location.
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const cur = await currentLocationAddress();
      if (!cur) {
        Alert.alert(t('error'), t('locationNotAvailable'));
        return;
      }
      setForm((f) => ({ ...f, full_address: cur.full_address, lat: cur.lat ?? null, lng: cur.lng ?? null }));
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_address.trim()) { Alert.alert(t('error'), t('enterAnAddress')); return; }
    setSaving(true);
    try {
      // Ensure the saved address carries coordinates (geocode the text if the
      // user typed it manually) so checkout never has to ask again.
      let { lat, lng } = form;
      if (lat == null || lng == null) {
        const coords = await resolveCoords({ full_address: form.full_address });
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }
      const payload = { ...form, lat, lng };
      const res = editId
        ? await api.put(`/addresses/${editId}`, payload)
        : await api.post('/addresses', payload);
      const saved = res.data?.address;
      // Keep the selected delivery address in sync when this becomes the default
      // (or it's the user's very first address).
      if (saved && (saved.is_default || addresses.length === 0)) {
        await setSelected({
          id: saved.id, label: saved.label, full_address: saved.full_address,
          instructions: saved.instructions ?? form.instructions ?? null,
          lat: saved.lat ?? lat, lng: saved.lng ?? lng,
        });
      }
      setShowModal(false);
      fetchAddresses();
    } catch (e: any) {
      Alert.alert(t('error'), e.response?.data?.detail || t('failedSaveAddress'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('deleteAddress'), t('areYouSure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try { await api.delete(`/addresses/${id}`); fetchAddresses(); }
          catch { Alert.alert(t('error'), t('failedDelete')); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('savedAddresses')}</Text>
        <TouchableOpacity onPress={openAdd} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color={'#ffffff'} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAddresses(); }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              item.is_default && { borderColor: colors.primary, borderWidth: 1.5 },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.labelRow}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: item.is_default ? colors.primary : colors.surface },
                  ]}
                >
                  <Ionicons
                    name={(labelIcons[item.label] || 'location') as any}
                    size={18}
                    color={item.is_default ? '#ffffff' : colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.labelText, { color: colors.text }]}>{labelI18nKey(item.label)}</Text>
                    {item.is_default && (
                      <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.defaultText}>{t('default')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.full_address}
                  </Text>
                  {item.landmark
                    ? <Text style={[styles.landmark, { color: colors.textMuted }]}>{t('near')}: {item.landmark}</Text>
                    : null}
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, { backgroundColor: colors.surface }]}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.actionBtn, { backgroundColor: colors.surface }]}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="location-outline" size={64} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noSavedAddresses')}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t('addAddressHint')}</Text>
            <Button title={t('addAddress')} onPress={openAdd} style={{ marginTop: SPACING.lg }} />
          </View>
        }
      />

      {/* Add/Edit modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editId ? t('editAddressTitle') : t('newAddress')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('label')}</Text>
            <View style={styles.labelPills}>
              {labels.map(l => {
                const isActive = form.label === l;
                return (
                  <TouchableOpacity
                    key={l}
                    style={[
                      styles.pill,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setForm({ ...form, label: l })}
                  >
                    <Ionicons
                      name={(labelIcons[l] || 'location') as any}
                      size={16}
                      color={isActive ? '#ffffff' : colors.textSecondary}
                    />
                    <Text style={[styles.pillText, { color: isActive ? '#ffffff' : colors.textSecondary }, isActive && { fontWeight: '700' }]}>
                      {labelI18nKey(l)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('fullAddress')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={form.full_address}
              // Editing the text invalidates any captured coords → re-geocode on save.
              onChangeText={txt => setForm({ ...form, full_address: txt, lat: null, lng: null })}
              placeholder={t('fullAddressPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.useLocBtn} onPress={useMyLocation} disabled={locating}>
              <Ionicons name="locate" size={16} color={colors.primary} />
              <Text style={[styles.useLocText, { color: colors.primary }]}>
                {locating ? `${t('detectingLocation')}` : t('useCurrentLocation')}
              </Text>
              {form.lat != null && !locating && (
                <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              )}
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('landmark')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, minHeight: 44 }]}
              value={form.landmark}
              onChangeText={txt => setForm({ ...form, landmark: txt })}
              placeholder={t('landmarkPlaceholder')}
              placeholderTextColor={colors.textMuted}
            />

            {/* Delivery instructions — saved with the address, auto-fills checkout
                and rides on every order so the rider sees it with the drop pin. */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('deliveryInstructions')}</Text>
            <View style={styles.instrChips}>
              {[t('instrLeaveAtGate'), t('instrDontRing'), t('instrCallOnArrival'), t('instrLeaveWithSecurity')].map((p) => {
                const active = form.instructions === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.instrChip, {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary + '15' : colors.surface,
                    }]}
                    onPress={() => setForm({ ...form, instructions: active ? '' : p })}
                  >
                    <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: FONTS.sizes.xs, fontWeight: '700' }}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, minHeight: 44 }]}
              value={form.instructions}
              onChangeText={txt => setForm({ ...form, instructions: txt })}
              placeholder={t('instrPlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={140}
            />

            <TouchableOpacity style={styles.defaultToggle} onPress={() => setForm({ ...form, is_default: !form.is_default })}>
              <Ionicons name={form.is_default ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
              <Text style={[styles.defaultToggleText, { color: colors.text }]}>{t('setAsDefault')}</Text>
            </TouchableOpacity>

            <Button
              title={editId ? t('updateAddress') : t('saveAddress')}
              onPress={handleSave}
              loading={saving}
              size="lg"
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  card: { borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', gap: SPACING.sm, flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  labelText: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
  defaultText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  addressText: { fontSize: FONTS.sizes.sm, marginTop: 4, lineHeight: 20 },
  landmark: { fontSize: FONTS.sizes.xs, marginTop: 2 },
  instrChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  instrChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  cardActions: { flexDirection: 'column', gap: SPACING.xs },
  actionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  empty: { justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700' },
  emptySub: { fontSize: FONTS.sizes.md, textAlign: 'center', marginTop: SPACING.sm },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700' },
  fieldLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', marginBottom: SPACING.xs, marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelPills: { flexDirection: 'row', gap: SPACING.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1 },
  pillText: { fontSize: FONTS.sizes.sm, fontWeight: '500' },
  input: { borderRadius: RADIUS.lg, padding: SPACING.md, fontSize: FONTS.sizes.md, borderWidth: 1, minHeight: 80, textAlignVertical: 'top' },
  useLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  useLocText: { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, paddingVertical: SPACING.sm },
  defaultToggleText: { fontSize: FONTS.sizes.md },
});

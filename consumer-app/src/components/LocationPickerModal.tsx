import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

export interface SavedAddress {
  id: string;
  label: string;
  full_address: string;
  landmark?: string;
  /** Saved rider guidance ("Leave at gate", "Don't ring the bell", custom…) —
   *  auto-populates checkout and rides on the order. */
  instructions?: string | null;
  is_default?: boolean;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onPickAddress: (addr: SavedAddress) => void;
  onAddNew: () => void;
}

const LABEL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Work: 'briefcase',
  Other: 'location',
};

/**
 * Bottom-sheet location picker shown from the Home header.
 *
 * Lets the user (a) snap back to GPS, (b) pick one of their saved addresses, or
 * (c) jump to the address manager. Saved addresses are loaded lazily each time
 * the sheet opens so a freshly-added address shows up without a manual refresh.
 */
export function LocationPickerModal({
  visible,
  onClose,
  onUseCurrentLocation,
  onPickAddress,
  onAddNew,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .get('/addresses')
      .then((r) => setAddresses(r.data || []))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Inner press swallows taps so the sheet doesn't close on its own content */}
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('selectLocation')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.currentBtn}
            activeOpacity={0.85}
            onPress={() => { onClose(); onUseCurrentLocation(); }}
          >
            <Ionicons name="locate" size={20} color={colors.primary} />
            <Text style={styles.currentText}>{t('useCurrentLocation')}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>{t('savedAddresses')}</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.lg }} />
          ) : (
            <FlatList
              data={addresses}
              keyExtractor={(item) => item.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.empty}>{t('noSavedAddressesYet')}</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.addrRow}
                  activeOpacity={0.7}
                  onPress={() => { onClose(); onPickAddress(item); }}
                >
                  <View style={styles.addrIcon}>
                    <Ionicons
                      name={LABEL_ICONS[item.label] || 'location'}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addrLabel}>
                      {item.label}{item.is_default ? '  •  Default' : ''}
                    </Text>
                    <Text style={styles.addrText} numberOfLines={2}>{item.full_address}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity
            style={styles.addNew}
            activeOpacity={0.7}
            onPress={() => { onClose(); onAddNew(); }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addNewText}>{t('addNewAddress')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: colors.text },
  currentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  currentText: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.primary },
  sectionLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  list: { maxHeight: 300 },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  addrIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addrLabel: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text },
  addrText: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  empty: {
    fontSize: FONTS.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  addNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
  },
  addNewText: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.primary },
});

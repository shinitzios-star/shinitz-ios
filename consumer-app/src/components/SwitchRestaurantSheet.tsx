import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/cartStore';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, FONTS, RADIUS } from '../constants/theme';

/**
 * "Items from another restaurant" confirmation.
 *
 * Mounted once at the root and driven by cartStore.pendingItem, so every Add
 * button — menu, home rail, item modal, reorder, deep link — gets the same
 * guard and wording without wiring each screen. Matches the website copy.
 */
export default function SwitchRestaurantSheet() {
  const { colors } = useTheme();
  const pendingItem = useCartStore((s) => s.pendingItem);
  const items = useCartStore((s) => s.items);
  const confirm = useCartStore((s) => s.confirmSwitchRestaurant);
  const cancel = useCartStore((s) => s.cancelSwitchRestaurant);

  const currentRestaurant = items[0]?.store_name || 'another restaurant';
  const newRestaurant = pendingItem?.store_name || 'this restaurant';

  return (
    <Modal visible={!!pendingItem} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel}>
        {/* Swallow taps inside the card so it doesn't dismiss accidentally. */}
        <Pressable style={[styles.card, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={styles.headRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={20} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Items from another restaurant</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Your cart contains items from <Text style={{ fontWeight: '700' }}>{currentRestaurant}</Text>.
                Adding this item from <Text style={{ fontWeight: '700' }}>{newRestaurant}</Text> will clear your existing cart.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel, keep my current cart"
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={confirm}
              accessibilityRole="button"
              accessibilityLabel="Clear cart and add this item"
            >
              <Text style={styles.confirmText}>Clear Cart &amp; Add</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end', padding: 0,
  },
  card: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
  },
  headRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(217,119,6,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  body: { fontSize: FONTS.sizes.sm, lineHeight: 20, marginTop: 4 },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  cancelBtn: { borderWidth: 1 },
  cancelText: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  confirmText: { fontSize: FONTS.sizes.md, fontWeight: '800', color: '#ffffff' },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { FONTS } from '../constants/theme';

// Exact wording set by the business. A constant (not i18n) so a translation can
// never drift from it.
export const DELIVERY_FEE_NOTE = 'This Fee Fairly Goes To Our Shinitz Riders For Delivering Food';

/**
 * Small informational line directly under a Delivery Fee row (cart bill, order
 * details). Display only — it never touches the fee or any total. Callers show
 * it when there is a fee to explain (not under "FREE").
 */
export default function DeliveryFeeNote() {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={styles.icon} />
      <Text style={[styles.text, { color: colors.textMuted }]}>{DELIVERY_FEE_NOTE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: -4, marginBottom: 8 },
  icon: { marginTop: 1.5 },
  text: { flex: 1, fontSize: FONTS.sizes.xs, lineHeight: 16 },
});

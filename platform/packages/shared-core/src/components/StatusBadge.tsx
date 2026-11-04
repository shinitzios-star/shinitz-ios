import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '../constants/theme';
import { RADIUS, SPACING, FONTS } from '../constants/theme';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const color = ORDER_STATUS_COLORS[status] || '#6b7280';
  const label = ORDER_STATUS_LABELS[status] || status;

  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

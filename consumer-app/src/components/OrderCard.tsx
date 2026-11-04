import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { format } from 'date-fns';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  delivery_address: string;
  created_at: string;
  kirana_name?: string;
  delivery_partner_name?: string;
  verification_code?: string;
  pickup_otp?: string;
  delivery_otp?: string;
  distance?: number;
}

interface OrderCardProps {
  order: Order;
  userRole: string;
  onPress?: () => void;
  onAction?: (action: string) => void;
}

export const OrderCard: React.FC<OrderCardProps> = React.memo(({ order, userRole, onPress, onAction }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const getActionButtons = () => {
    // Kirana and restaurant share the same prep workflow.
    // NEW: accepted → preparing is BLOCKED. Must wait for a delivery partner
    // to claim the order (status moves through delivery_assigned first).
    if (userRole === 'kirana' || userRole === 'restaurant') {
      switch (order.status) {
        case 'pending':
          return [{ label: 'Accept', action: 'accepted', color: colors.success }];
        case 'accepted':
          // Waiting for delivery partner — no action available, just info
          return [];
        case 'delivery_assigned':
          return [{ label: 'Start Preparing', action: 'preparing', color: colors.primary }];
        case 'preparing':
          return [{ label: 'Ready for Pickup', action: 'ready_for_pickup', color: colors.success }];
        default:
          return [];
      }
    }

    // Delivery now claims orders in "accepted" status (kirana ready, no cooking yet)
    if (userRole === 'delivery') {
      switch (order.status) {
        case 'accepted':
          return [{ label: 'Accept Delivery', action: 'delivery_assigned', color: colors.success }];
        case 'delivery_assigned':
          // Can release while kirana hasn't started cooking yet
          return [{ label: 'Release Order', action: 'accepted', color: colors.warning }];
        case 'ready_for_pickup':
          return [{ label: 'Picked Up', action: 'out_for_delivery', color: colors.primary }];
        case 'out_for_delivery':
          return [{ label: 'Delivered', action: 'delivered', color: colors.success }];
        default:
          return [];
      }
    }

    // Consumer can cancel before delivery has committed
    if (userRole === 'consumer') {
      if (order.status === 'pending' || order.status === 'accepted') {
        return [{ label: 'Cancel Order', action: 'cancelled', color: colors.error }];
      }
    }

    return [];
  };

  const actions = getActionButtons();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.date}>
              {format(new Date(order.created_at), 'MMM dd, yyyy • hh:mm a')}
            </Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View style={styles.divider} />

        <View style={styles.items}>
          {order.items.slice(0, 3).map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          {order.items.length > 3 && (
            <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.address} numberOfLines={1}>{order.delivery_address}</Text>
            {order.distance !== undefined && (
              <Text style={styles.distance}>{order.distance}km</Text>
            )}
          </View>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₹{order.total_amount}</Text>
          </View>
        </View>

        {order.kirana_name && (
          <View style={styles.infoRow}>
            <Ionicons name="storefront" size={14} color={colors.success} />
            <Text style={styles.infoText}>{order.kirana_name}</Text>
          </View>
        )}

        {order.delivery_partner_name && (
          <View style={styles.infoRow}>
            <Ionicons name="bicycle" size={14} color={colors.info} />
            <Text style={styles.infoText}>{order.delivery_partner_name}</Text>
          </View>
        )}

        {/* Pickup OTP — shown ONLY to the store. The store reads this to the
            rider at handover; rider enters it to mark the order picked up.
            (Backend redacts pickup_otp for everyone except the owning store.) */}
        {(userRole === 'kirana' || userRole === 'restaurant') && order.pickup_otp &&
         ['ready_for_pickup', 'delivery_assigned', 'preparing'].includes(order.status) && (
          <View style={styles.verificationBox}>
            <Text style={styles.verificationLabel}>Pickup OTP — give to rider</Text>
            <Text style={styles.verificationCode}>{order.pickup_otp}</Text>
          </View>
        )}

        {/* Kirana/restaurant hint: order accepted but waiting for delivery partner.
            Without this, the missing "Start Preparing" button would feel like a bug. */}
        {(userRole === 'kirana' || userRole === 'restaurant') && order.status === 'accepted' && (
          <View style={styles.waitingBox}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.waitingText}>
              Waiting for a delivery partner to accept. Please do not start preparing yet.
            </Text>
          </View>
        )}

        {actions.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.actionBtn, { backgroundColor: action.color }]}
                onPress={() => onAction?.(action.action)}
              >
                <Text style={styles.actionBtnText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontSize: FONTS.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: SPACING.sm,
  },
  items: {
    gap: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQty: {
    fontSize: FONTS.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
    width: 30,
  },
  itemName: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: colors.text,
  },
  itemPrice: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
  },
  moreItems: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    gap: SPACING.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  address: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
  },
  distance: {
    fontSize: FONTS.sizes.sm,
    color: colors.success,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: colors.text,
  },
  verificationBox: {
    backgroundColor: colors.primary + '20',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  verificationLabel: {
    fontSize: FONTS.sizes.xs,
    color: colors.textSecondary,
  },
  verificationCode: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 4,
  },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: colors.warning + '15',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  waitingText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: colors.warning,
    fontWeight: '600',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: '#ffffff',
  },
});

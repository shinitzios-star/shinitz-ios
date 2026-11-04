import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { OrderCard } from '../../src/components/OrderCard';
import { OrderListSkeleton } from '../../src/components/SkeletonLoader';
import { ordersAPI } from '../../src/services/api';
import { rebuildCartFromOrder, reorderSummary } from '../../src/utils/reorder';

export default function OrdersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await ordersAPI.getAll();
      setOrders(response.data);
    } catch (error) {
      if (__DEV__) console.warn('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh whenever the tab regains focus (e.g. after placing an order)
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert(
      t('cancelOrder'),
      t('cancelOrderConfirm'),
      [
        { text: t('no'), style: 'cancel' },
        {
          text: t('yesCancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersAPI.updateStatus(orderId, 'cancelled');
              fetchOrders();
            } catch (e: any) {
              Alert.alert(t('error'), e.response?.data?.detail || t('failedToCancel'));
            }
          },
        },
      ],
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // One-tap reorder — rebuilds the cart from a finished order with live
  // availability/price validation, then lands on the cart.
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const handleReorder = async (order: any) => {
    if (reorderingId) return;
    setReorderingId(order.id);
    try {
      const res = await rebuildCartFromOrder(order);
      if (!res.ok) {
        Alert.alert(t('error'), 'None of these items are available right now.');
        return;
      }
      const diff = reorderSummary(res);
      if (diff) {
        Alert.alert('A few things changed', diff, [
          { text: 'Review cart', onPress: () => router.push('/(consumer)/cart') },
        ]);
      } else {
        router.push('/(consumer)/cart');
      }
    } finally {
      setReorderingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('myOrders')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('myOrders')}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <View>
            <OrderCard
              order={item}
              userRole="consumer"
              onPress={() => router.push({ pathname: '/(consumer)/order-detail', params: { orderId: item.id } })}
              onAction={(action) => {
                if (action === 'cancelled') handleCancelOrder(item.id);
              }}
            />
            {['delivered', 'cancelled'].includes(item.status) && (
              <TouchableOpacity
                style={[styles.reorderPill, { borderColor: colors.primary }]}
                disabled={reorderingId === item.id}
                onPress={() => handleReorder(item)}
                activeOpacity={0.75}
              >
                {reorderingId === item.id
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name="repeat" size={15} color={colors.primary} />}
                <Text style={[styles.reorderPillText, { color: colors.primary }]}>Reorder</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('noOrdersYet')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{t('ordersAppearHere')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  reorderPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'flex-end', borderWidth: 1.5, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 6,
    marginTop: -6, marginBottom: SPACING.sm, marginRight: 2,
  },
  reorderPillText: { fontWeight: '800', fontSize: FONTS.sizes.sm },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: '600', marginTop: SPACING.md },
  emptySubtext: { fontSize: FONTS.sizes.sm, marginTop: SPACING.xs },
});

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { OrderCard } from '../../src/components/OrderCard';
import { Button } from '../../src/components/Button';
import { CollectPaymentModal } from '../../src/components/CollectPaymentModal';
import { ordersAPI, deliveryAPI } from '../../src/services/api';
import { useRiderTracking } from '../../src/hooks/useRiderTracking';
import { useRouter } from 'expo-router';

export default function ActiveDeliveriesScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  // 'pickup' = get code from store to mark picked up
  // 'delivery' = get code from customer to mark delivered
  const [otpType, setOtpType] = useState<'pickup' | 'delivery'>('pickup');
  const [collectOrder, setCollectOrder] = useState<any>(null);

  // Keep latest active orders in a ref so the location-ping loop always sees them
  const ordersRef = useRef<any[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await ordersAPI.getAll();
      const activeOrders = response.data.filter(
        (o: any) => ['delivery_assigned', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status)
      );
      ordersRef.current = activeOrders;
      setOrders(activeOrders);
    } catch (error) {
      if (__DEV__) console.warn('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const interval = setInterval(fetchOrders, 30000);
      return () => clearInterval(interval);
    }, [fetchOrders]),
  );

  // ── Live GPS via WebSocket ───────────────────────────────────────────────
  // useRiderTracking opens a WS per active order, sending GPS every 5 s.
  // The server broadcasts to consumer + store watchers in real time.
  // We only track the first active order — typical at any point there is one.
  const activeOrderId = ordersRef.current.find(
    (o) => ['delivery_assigned', 'ready_for_pickup', 'out_for_delivery'].includes(o.status),
  )?.id ?? null;
  useRiderTracking(activeOrderId, true);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Emergency SOS — alerts Shinitz support with the rider's live location.
  const handleSOS = () => {
    Alert.alert('🚨 Emergency SOS', 'This alerts Shinitz support with your live location. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send SOS', style: 'destructive',
        onPress: async () => {
          let lat: number | undefined, lng: number | undefined;
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              lat = loc.coords.latitude; lng = loc.coords.longitude;
            }
          } catch {}
          try {
            const activeId = ordersRef.current[0]?.id;
            const res = await deliveryAPI.sos(lat, lng, activeId);
            const phone = res.data?.support_phone;
            Alert.alert('SOS sent', 'Support has been alerted. Do you want to call them now?', [
              { text: 'Not now', style: 'cancel' },
              { text: 'Call support', onPress: () => { if (phone) Linking.openURL(`tel:+${phone}`).catch(() => {}); } },
            ]);
          } catch {
            Alert.alert('Could not send SOS', 'Please call support directly.');
          }
        },
      },
    ]);
  };

  // Unified OTP verification — handles both pickup and delivery.
  const handleVerifyOtp = async () => {
    if (!verificationCode || verificationCode.length !== 4) {
      Alert.alert('Error', 'Please enter the 4-digit OTP');
      return;
    }
    const targetStatus = otpType === 'pickup' ? 'out_for_delivery' : 'delivered';
    setVerifying(true);
    try {
      // OTP is verified server-side inside the status transition
      await ordersAPI.updateStatus(selectedOrder.id, targetStatus, verificationCode);
      Alert.alert(
        'Success',
        otpType === 'pickup'
          ? 'Pickup verified! Order is now out for delivery.'
          : 'Delivery confirmed! Great job!',
      );
      setShowVerifyModal(false);
      setVerificationCode('');
      fetchOrders();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setVerifying(false);
    }
  };

  const handleReleaseOrder = (orderId: string) => {
    Alert.alert(
      'Release this order?',
      'The order will go back to the available pool for another partner to claim.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersAPI.updateStatus(orderId, 'accepted');
              fetchOrders();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'Failed to release order');
            }
          },
        },
      ],
    );
  };

  const handleOrderAction = (order: any, action: string) => {
    if (action === 'out_for_delivery') {
      // Pickup: enter the OTP the STORE shows you
      setSelectedOrder(order);
      setOtpType('pickup');
      setVerificationCode('');
      setShowVerifyModal(true);
    } else if (action === 'delivered') {
      // Delivery: enter the OTP the CUSTOMER shows you
      setSelectedOrder(order);
      setOtpType('delivery');
      setVerificationCode('');
      setShowVerifyModal(true);
    } else if (action === 'accepted') {
      // Release the order back to the available pool
      handleReleaseOrder(order.id);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Active Deliveries</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Deliveries</Text>
        <View style={styles.headerRight}>
          {orders.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{orders.length}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.8}>
            <Ionicons name="warning" size={15} color="#fff" />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => {
          // Before pickup → navigate to the STORE; after pickup → to the CUSTOMER.
          const toCustomer = item.status === 'out_for_delivery';
          const navTarget = toCustomer ? item.delivery_location : item.kirana_location;
          const navLabel = toCustomer ? 'Navigate to Customer' : 'Navigate to Store';
          return (
            <View>
              {item.batch_id && (
                <View style={styles.batchBanner}>
                  <Ionicons name="git-merge" size={15} color={COLORS.primary} />
                  <Text style={styles.batchText}>
                    Batched order — pick up together at {item.kirana_name || 'the store'}
                  </Text>
                </View>
              )}
              <OrderCard
                order={item}
                userRole="delivery"
                onAction={(action) => handleOrderAction(item, action)}
              />
              {['delivery_assigned', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(item.status) && (
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => router.push({ pathname: '/(delivery)/navigation' as any, params: { orderId: item.id } })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="map" size={18} color="#fff" />
                  <Text style={styles.navBtnText}>{navLabel}</Text>
                </TouchableOpacity>
              )}
              {/* COD collection — on the delivery leg, before it's paid */}
              {item.payment_method === 'cod' && item.payment_status !== 'paid' && item.status === 'out_for_delivery' && (
                <TouchableOpacity style={styles.collectBtn} onPress={() => setCollectOrder(item)} activeOpacity={0.85}>
                  <Ionicons name="qr-code" size={18} color="#fff" />
                  <Text style={styles.navBtnText}>Collect ₹{Number(item.total_amount || 0).toFixed(0)} (COD)</Text>
                </TouchableOpacity>
              )}
              {item.payment_method === 'cod' && item.payment_status === 'paid' && (
                <View style={styles.paidTag}>
                  <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
                  <Text style={styles.paidText}>Payment collected</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyText}>No active deliveries</Text>
            <Text style={styles.emptySubtext}>
              Accept available orders to start delivering
            </Text>
          </View>
        }
      />

      {/* COD payment collection */}
      <CollectPaymentModal
        visible={!!collectOrder}
        order={collectOrder}
        onClose={() => setCollectOrder(null)}
        onCollected={() => { setCollectOrder(null); fetchOrders(); }}
      />

      {/* Verification Modal */}
      <Modal
        visible={showVerifyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVerifyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {otpType === 'pickup' ? 'Verify Pickup' : 'Verify Delivery'}
              </Text>
              <TouchableOpacity onPress={() => setShowVerifyModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              {otpType === 'pickup'
                ? 'Enter the LAST 4 CHARACTERS of the Order ID (the store will confirm it from their order ticket).'
                : 'Ask the CUSTOMER for the 4-digit Delivery OTP shown in their app.'}
            </Text>

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                placeholder="••••"
                placeholderTextColor={COLORS.textMuted}
                value={verificationCode}
                onChangeText={(t) =>
                  otpType === 'pickup'
                    // Order-ID last-4 is hex → allow letters + digits, uppercased
                    ? setVerificationCode(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4))
                    : setVerificationCode(t.replace(/\D/g, '').slice(0, 4))
                }
                maxLength={4}
                keyboardType={otpType === 'pickup' ? 'default' : 'number-pad'}
                autoCapitalize="characters"
                textAlign="center"
              />
            </View>

            <Button
              title={otpType === 'pickup' ? 'Verify & Pick Up' : 'Verify & Complete'}
              onPress={handleVerifyOtp}
              loading={verifying}
              disabled={verificationCode.length !== 4}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  batchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary + '40',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginBottom: SPACING.xs,
  },
  batchText: { color: COLORS.primary, fontSize: FONTS.sizes.xs, fontWeight: '700', flex: 1 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.info,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  navBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  collectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.success, marginBottom: SPACING.md, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  paidTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: SPACING.md },
  paidText: { color: COLORS.success, fontWeight: '700', fontSize: FONTS.sizes.sm },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.error, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 6,
  },
  sosText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.xs },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  codeInputContainer: {
    marginBottom: SPACING.lg,
  },
  codeInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

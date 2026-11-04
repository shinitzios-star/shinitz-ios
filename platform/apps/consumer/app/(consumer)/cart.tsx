import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LocationPickerModal, type SavedAddress } from '../../src/components/LocationPickerModal';
import { useCartStore } from '../../src/store/cartStore';
import { useAuthStore } from '../../src/store/authStore';
import { useAddressStore } from '../../src/store/addressStore';
import { resolveCoords, currentLocationAddress } from '../../src/utils/address';
import { usePayment } from '../../src/hooks/usePayment';
import type { PaymentMethod } from '../../src/types/payment';
import { computeBill } from '../../src/utils/bill';

// ─────────────────────────────────────────────────────────────────────────────

export default function CartScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { items, updateQuantity, removeItem, getTotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { selected, ensureSelected, setSelected } = useAddressStore();
  const { status, isLoading, initiatePayment } = usePayment();

  const [notes, setNotes] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('online');
  const [showSheet, setShowSheet] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showGstInfo, setShowGstInfo] = useState(false);
  const [resolvingAddr, setResolvingAddr] = useState(false);
  // Coordinates resolved for the chosen address, captured at "Proceed" time.
  const resolvedCoords = useRef<{ lat: number; lng: number } | null>(null);

  // Bottom sheet slide animation
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Reuse the address the user already picked (default saved address on first
  // visit). The user enters their address once; checkout just uses it.
  useEffect(() => {
    ensureSelected();
  }, []);

  // ── Address selection ─────────────────────────────────────────────────────

  // Pick a saved address from the sheet — carry its coords (geocode if legacy).
  const chooseSaved = async (addr: SavedAddress) => {
    setResolvingAddr(true);
    try {
      const coords = await resolveCoords({
        full_address: addr.full_address,
        lat: addr.lat,
        lng: addr.lng,
      });
      await setSelected({
        id: addr.id,
        label: addr.label,
        full_address: addr.full_address,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    } finally {
      setResolvingAddr(false);
    }
  };

  // "Use current location" from the sheet — GPS + reverse geocode.
  const chooseCurrent = async () => {
    setResolvingAddr(true);
    try {
      const cur = await currentLocationAddress();
      if (!cur) {
        Alert.alert(t('locationRequired'), t('enableLocationMsg'));
        return;
      }
      await setSelected(cur);
    } finally {
      setResolvingAddr(false);
    }
  };

  // ── Payment sheet animations ─────────────────────────────────────────────────

  const openSheet = () => {
    setShowSheet(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(sheetAnim, {
        toValue: 400,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSheet(false);
      cb?.();
    });
  };

  // ── Validation ───────────────────────────────────────────────────────────────

  const handleProceed = async () => {
    if (!user) {
      Alert.alert(t('notLoggedIn'), t('loginToContinue'));
      return;
    }
    if (!selected || !selected.full_address.trim()) {
      // No address yet → let the user pick one instead of blocking with an error.
      setShowAddressPicker(true);
      return;
    }
    // Make sure we have coordinates for delivery (geocode legacy addresses, or
    // fall back to GPS). Block only if we truly can't resolve a location.
    setResolvingAddr(true);
    let coords = await resolveCoords(selected);
    if (!coords) {
      const cur = await currentLocationAddress();
      if (cur && cur.lat != null && cur.lng != null) {
        coords = { lat: cur.lat, lng: cur.lng };
        await setSelected({ ...selected, lat: cur.lat, lng: cur.lng });
      }
    } else if (selected.lat == null || selected.lng == null) {
      // Persist the freshly-geocoded coords so we don't geocode every time.
      await setSelected({ ...selected, lat: coords.lat, lng: coords.lng });
    }
    setResolvingAddr(false);
    if (!coords) {
      Alert.alert(t('locationRequired'), t('enableLocationMsg'));
      return;
    }
    resolvedCoords.current = coords;
    openSheet();
  };

  // ── Pay / Place order ────────────────────────────────────────────────────────

  const handleConfirmPayment = async () => {
    const coords = resolvedCoords.current;
    if (!user || !selected || !coords) return;

    closeSheet(async () => {
      const result = await initiatePayment(
        {
          items,
          delivery_address: selected.full_address.trim(),
          delivery_location: coords,
          total_amount: grandTotal,
          notes: notes.trim() || null,
        },
        selectedMethod,
        { name: user.name, phone: user.phone },
      );

      if (result.success) {
        router.push({
          pathname: '/(consumer)/payment-success',
          params: {
            orderId: result.orderId,
            paymentId: result.paymentId ?? '',
            amount: String(result.amount),
            method: selectedMethod,
          },
        });
      } else if (!result.cancelled) {
        // Cancelled = user closed checkout; stay in cart silently
        router.push({
          pathname: '/(consumer)/payment-failed',
          params: {
            orderId: result.orderId,
            amount: String(result.amount),
            errorMessage: result.errorMessage ?? 'Payment failed',
            errorCode: String(result.errorCode ?? -1),
          },
        });
      }
    });
  };

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotal = getTotal();
  const bill = computeBill(subtotal);
  const deliveryFee = bill.deliveryFee;
  const grandTotal = bill.grandTotal;

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('cartTitle')}</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="cart-outline" size={52} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('cartEmpty')}</Text>
          <Text style={styles.emptySubtext}>{t('cartEmptyHint')}</Text>
          <Button
            title={t('browseProducts')}
            onPress={() => router.push('/(consumer)/home')}
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('cartTitle')}</Text>
        <TouchableOpacity onPress={clearCart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearText}>{t('clearAll')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Cart items ── */}
        {items.map((item) => (
          <Card key={item.product_id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                {item.store_name ? (
                  <Text style={styles.itemStore}>{item.store_name}</Text>
                ) : null}
                <Text style={styles.itemPrice}>{t('eachPrice', { price: item.price })}</Text>
              </View>

              <View style={styles.qtyControl}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.itemFooter}>
              <Text style={styles.itemLineTotal}>₹{item.price * item.quantity}</Text>
              <TouchableOpacity onPress={() => removeItem(item.product_id)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {/* ── Delivery address (reuses the saved/default address — no re-entry) ── */}
        <Card style={styles.addressCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('deliveryAddress')}</Text>
          </View>

          {selected && selected.full_address ? (
            <TouchableOpacity
              style={styles.savedAddrRow}
              activeOpacity={0.7}
              onPress={() => setShowAddressPicker(true)}
            >
              <View style={styles.savedAddrIcon}>
                <Ionicons name="location" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {!!selected.label && <Text style={styles.savedAddrLabel}>{selected.label}</Text>}
                <Text style={styles.savedAddrText} numberOfLines={2}>{selected.full_address}</Text>
              </View>
              {resolvingAddr
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.changeLink}>{t('change')}</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.setAddrBtn}
              activeOpacity={0.85}
              onPress={() => setShowAddressPicker(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.setAddrText}>{t('setDeliveryAddress')}</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* ── Order notes ── */}
        <Card style={styles.notesCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>{t('orderNotes')}</Text>
            <Text style={styles.optionalTag}>{t('optionalLower')}</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            placeholder={t('notesPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Card>

        {/* ── Bill summary ── */}
        <Card style={styles.billCard}>
          <Text style={styles.billTitle}>{t('billDetails')}</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>{t('itemTotal')}</Text>
            <Text style={styles.billValue}>₹{bill.subtotal}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>{t('deliveryFee')}</Text>
            <Text style={[styles.billValue, deliveryFee === 0 && styles.freeText]}>
              {deliveryFee === 0 ? t('free') : `₹${deliveryFee}`}
            </Text>
          </View>

          {/* GST — tappable, opens the government-tax breakdown (matches ref). */}
          <TouchableOpacity
            style={styles.billRow}
            activeOpacity={0.6}
            onPress={() => setShowGstInfo(true)}
          >
            <View style={styles.taxLabelRow}>
              <Text style={[styles.billLabel, styles.taxLabelUnderline]}>{t('gstGovtTaxes')}</Text>
              <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
            </View>
            <Text style={styles.billValue}>₹{bill.taxTotal.toFixed(2)}</Text>
          </TouchableOpacity>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandLabel}>{t('toPay')}</Text>
            <Text style={styles.grandValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </Card>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerTotal}>₹{grandTotal}</Text>
          <Text style={styles.footerCount}>{t(items.length === 1 ? 'itemsCountOne' : 'itemsCount', { count: items.length })}</Text>
        </View>
        <TouchableOpacity
          style={[styles.proceedBtn, isLoading && styles.btnDisabled]}
          onPress={handleProceed}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.proceedBtnText}>{t('proceedToPay')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Loading overlay (shown while payment is processing) ── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>
              {status === 'creating_order'
                ? t('creatingOrder')
                : status === 'opening_checkout'
                ? t('openingCheckout')
                : t('verifyingPayment')}
            </Text>
            <Text style={styles.loadingSubtitle}>{t('doNotCloseApp')}</Text>
          </View>
        </View>
      )}

      {/* ── Payment method bottom sheet ── */}
      <Modal
        visible={showSheet}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeSheet()}
      >
        <Animated.View style={[styles.sheetOverlay, { opacity: overlayAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => closeSheet()}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
        >
          {/* Handle bar */}
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>{t('selectPaymentMethod')}</Text>
          <Text style={styles.sheetSubtitle}>{t('choosePaymentMethod')}</Text>

          <View style={styles.methodList}>
            {/* Online */}
            <MethodCard
              styles={styles}
              selected={selectedMethod === 'online'}
              onPress={() => setSelectedMethod('online')}
              icon="card"
              iconBg={colors.primary + '15'}
              iconColor={colors.primary}
              title={t('payOnline')}
              subtitle={t('payOnlineSub')}
              badge={t('recommended')}
            />

            {/* COD */}
            <MethodCard
              styles={styles}
              selected={selectedMethod === 'cod'}
              onPress={() => setSelectedMethod('cod')}
              icon="cash"
              iconBg={colors.success + '15'}
              iconColor={colors.success}
              title={t('cashOnDelivery')}
              subtitle={t('codSub')}
            />
          </View>

          {/* Razorpay trust badge */}
          {selectedMethod === 'online' && (
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={15} color={colors.success} />
              <Text style={styles.trustText}>
                {t('razorpaySecured')}
              </Text>
            </View>
          )}

          {/* Amount summary in sheet */}
          <View style={styles.sheetTotal}>
            <View>
              <Text style={styles.sheetTotalLabel}>{t('totalPayable')}</Text>
              <Text style={styles.sheetTotalValue}>₹{grandTotal}</Text>
            </View>
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={handleConfirmPayment}
              activeOpacity={0.85}
            >
              <Text style={styles.payNowText}>
                {selectedMethod === 'online' ? t('payNow') : t('placeOrder')}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* ── GST (govt. taxes) breakdown ── */}
      <Modal
        visible={showGstInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGstInfo(false)}
      >
        <TouchableOpacity style={styles.gstOverlay} activeOpacity={1} onPress={() => setShowGstInfo(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.gstCard} onPress={() => {}}>
            <Text style={styles.gstTitle}>{t('gstGovtTaxes')}</Text>
            <Text style={styles.gstNote}>{t('taxesGovtNote')}</Text>
            <View style={styles.gstDivider} />
            <View style={styles.gstRow}>
              <Text style={styles.gstRowLabel}>{t('gstOnItems')}</Text>
              <Text style={styles.gstRowValue}>₹{bill.foodGst.toFixed(2)}</Text>
            </View>
            <View style={styles.gstRow}>
              <Text style={styles.gstRowLabel}>{t('gstOnDelivery')}</Text>
              <Text style={styles.gstRowValue}>₹{bill.deliveryGst.toFixed(2)}</Text>
            </View>
            <View style={styles.gstDivider} />
            <View style={styles.gstRow}>
              <Text style={styles.gstTotalLabel}>{t('total')}</Text>
              <Text style={styles.gstTotalValue}>₹{bill.taxTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.gstOkBtn} activeOpacity={0.8} onPress={() => setShowGstInfo(false)}>
              <Text style={styles.gstOkText}>{t('okay')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Change / set delivery address ── */}
      <LocationPickerModal
        visible={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onUseCurrentLocation={chooseCurrent}
        onPickAddress={chooseSaved}
        onAddNew={() => router.push('/(consumer)/addresses')}
      />
    </SafeAreaView>
  );
}

// ─── MethodCard sub-component ─────────────────────────────────────────────────

function MethodCard({
  selected,
  onPress,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  badge,
  styles,
}: {
  selected: boolean;
  onPress: () => void;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: string;
  styles: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.methodCard, selected && styles.methodCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.methodIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={24} color={iconColor} />
      </View>

      <View style={styles.methodText}>
        <View style={styles.methodTitleRow}>
          <Text style={styles.methodTitle}>{title}</Text>
          {badge && (
            <View style={styles.methodBadge}>
              <Text style={styles.methodBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.methodSubtitle}>{subtitle}</Text>
      </View>

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  clearText: {
    fontSize: FONTS.sizes.sm,
    color: colors.error,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SPACING.xxl,
  },
  emptyIconBg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
    marginTop: SPACING.xs,
  },
  // Cart items
  itemCard: {
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  itemName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 21,
  },
  itemStore: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
    marginTop: SPACING.xs,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  qtyBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.text,
    minWidth: 26,
    textAlign: 'center',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  itemLineTotal: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: colors.primary,
  },
  // Address
  addressCard: {
    marginTop: SPACING.md,
  },
  savedAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  savedAddrIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedAddrLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  savedAddrText: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 19,
  },
  changeLink: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  setAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  setAddrText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  optionalTag: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginLeft: 4,
  },
  addressInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  locationBtnText: {
    fontSize: FONTS.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  // Notes
  notesCard: {
    marginTop: SPACING.sm,
  },
  notesInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: colors.text,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  // Bill
  billCard: {
    marginTop: SPACING.md,
  },
  billTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: colors.text,
    marginBottom: SPACING.md,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  billLabel: {
    fontSize: FONTS.sizes.md,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: FONTS.sizes.md,
    color: colors.text,
    fontWeight: '600',
  },
  freeText: {
    color: colors.success,
    fontWeight: '700',
  },
  freeHint: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  billDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: SPACING.sm,
  },
  grandLabel: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  grandValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: colors.primary,
  },
  // Tax row (tappable)
  taxLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  taxLabelUnderline: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: colors.textMuted,
  },
  // GST breakdown popup
  gstOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  gstCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.lg,
  },
  gstTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.text },
  gstNote: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  gstDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: SPACING.md },
  gstRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  gstRowLabel: { fontSize: FONTS.sizes.md, color: colors.textSecondary },
  gstRowValue: { fontSize: FONTS.sizes.md, color: colors.text, fontWeight: '600' },
  gstTotalLabel: { fontSize: FONTS.sizes.md, color: colors.text, fontWeight: '800' },
  gstTotalValue: { fontSize: FONTS.sizes.md, color: colors.text, fontWeight: '800' },
  gstOkBtn: {
    marginTop: SPACING.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  gstOkText: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.primary },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...SHADOWS.lg,
  },
  footerTotal: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: colors.text,
  },
  footerCount: {
    fontSize: FONTS.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    ...SHADOWS.md,
  },
  proceedBtnText: {
    color: '#ffffff',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '75%',
    ...SHADOWS.lg,
  },
  loadingTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  // Bottom sheet overlay
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl + 4,
    borderTopRightRadius: RADIUS.xl + 4,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
    ...SHADOWS.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.lg,
  },
  methodList: {
    gap: SPACING.sm,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  methodIcon: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  methodText: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  methodTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  methodBadge: {
    backgroundColor: colors.accent + '25',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  methodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentDark,
  },
  methodSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  trustText: {
    fontSize: FONTS.sizes.xs,
    color: colors.success,
    fontWeight: '600',
  },
  sheetTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetTotalLabel: {
    fontSize: FONTS.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sheetTotalValue: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    ...SHADOWS.md,
  },
  payNowText: {
    color: '#ffffff',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
});

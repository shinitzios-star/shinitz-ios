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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DeliveryFeeNote from '../../src/components/DeliveryFeeNote';
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
import { ordersAPI, couponsAPI, productsAPI, walletAPI } from '../../src/services/api';
import { AudioNoteRecorder, type AudioNote } from '../../src/components/AudioNoteRecorder';

// The delivery quote's FINAL fee is all the app uses. The endpoint also returns
// internal pricing inputs (distance, per-km rate); they are intentionally not
// typed here so no screen can show the customer how the fee was worked out.
type DeliveryQuote = { delivery_fee: number };

// Cancellation policy shown before an order is placed — exact wording as set by
// the business. Deliberately not run through i18n so it can't drift.
const CANCELLATION_POLICY_TITLE = 'Cancellation Policy';
const CANCELLATION_POLICY_TEXT =
  'Please Double Check your order and address details. Orders are non-refundable once placed.';
const CANCELLATION_POLICY_ACK = 'I have checked my order and address details.';
type AppliedCoupon = { code: string; discount: number; free_delivery: boolean; title?: string };
type AvailableCoupon = {
  id: string; code: string; title: string; subtitle?: string | null;
  eligible: boolean; discount_preview?: number | null; ineligible_reason?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function CartScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, removeItem, getTotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { selected, ensureSelected, setSelected } = useAddressStore();
  const { status, isLoading, initiatePayment } = usePayment();
  // True from the tap until the payment attempt resolves — see handleConfirmPayment.
  const payingRef = useRef(false);

  const [notes, setNotes] = useState('');
  const [audioNote, setAudioNote] = useState<AudioNote | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('online');
  const [showSheet, setShowSheet] = useState(false);
  // Cancellation-policy acknowledgement — required before Pay / Place Order,
  // and asked afresh for every checkout (reset when the sheet opens).
  const [policyAck, setPolicyAck] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showGstInfo, setShowGstInfo] = useState(false);
  const [resolvingAddr, setResolvingAddr] = useState(false);
  // Coordinates resolved for the chosen address, captured at "Proceed" time.
  const resolvedCoords = useRef<{ lat: number; lng: number } | null>(null);
  // Live distance-based delivery-fee quote (recomputed on address/cart change).
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);

  // ── Coupons ────────────────────────────────────────────────────────────────
  // All discount math is SERVER-side (couponsAPI.validate); we only display it.
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [showCoupons, setShowCoupons] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [couponStoreId, setCouponStoreId] = useState<string | null>(null);
  // "You saved ₹x" pop-in animation on successful apply.
  const savedAnim = useRef(new Animated.Value(0)).current;

  // ── P10: Wallet ────────────────────────────────────────────────────────────
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  // ── P9: Scheduled delivery ─────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<{ iso: string; label: string; day: string } | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [slotDays, setSlotDays] = useState<any[]>([]);
  const [slotDayIdx, setSlotDayIdx] = useState(0);
  const [slotsLoading, setSlotsLoading] = useState(false);

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
        instructions: addr.instructions ?? null,   // saved rider guidance rides along
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
    setPolicyAck(false);
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
    if (!user || !selected || !coords || !policyAck) return;
    // Re-entry guard. The sheet takes ~220ms to animate away, and the button
    // stays tappable for all of it: a second tap in that window placed a SECOND
    // order (the payment lock only covers the Razorpay step, which happens
    // after the order is created).
    if (payingRef.current || isLoading) return;
    // Never send someone to the gateway on a total that is still missing the
    // delivery fee — that is how the charged amount ends up above the screen.
    if (!feeKnown) return;
    payingRef.current = true;

    closeSheet(async () => {
      try {
        const result = await initiatePayment(
          {
            items,
            delivery_address: selected.full_address.trim(),
            delivery_location: coords,
            total_amount: grandTotal,
            notes: notes.trim() || null,
            // Server re-validates the code and recomputes the discount — this is
            // only the customer's intent, never the price authority.
            coupon_code: coupon?.code || null,
            // Saved per-address rider guidance rides on the order.
            delivery_instructions: selected.instructions?.trim() || null,
            // P10/P9: wallet credits + optional delivery slot (server validates both).
            use_wallet: useWallet && walletBalance > 0,
            scheduled_for: schedule?.iso || null,
          },
          selectedMethod,
          { name: user.name, phone: user.phone },
        );

        if (result.success) {
          // Attach the recorded voice note to the new order (best-effort).
          if (audioNote && result.orderId) {
            ordersAPI.uploadAudioNote(result.orderId, audioNote.uri, audioNote.duration).catch(() => {});
          }
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
      } finally {
        // ALWAYS release, on every path — a guard that can stick is the very
        // bug it is meant to prevent (a button that never works again).
        payingRef.current = false;
      }
    });
  };

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotal = getTotal();

  // Recompute the live distance-based delivery fee whenever the delivery address
  // or the cart changes. Falls back to the flat fee until coords resolve.
  useEffect(() => {
    const drop_lat = selected?.lat ?? null;
    const drop_lng = selected?.lng ?? null;
    const pid = items[0]?.product_id;
    if (!pid || drop_lat == null || drop_lng == null) { setQuote(null); return; }
    let cancelled = false;
    ordersAPI.deliveryQuote({ product_id: pid, drop_lat, drop_lng, subtotal })
      .then((r) => { if (!cancelled) setQuote(r.data as DeliveryQuote); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [selected?.lat, selected?.lng, items, subtotal]);

  // The delivery fee is the backend's to decide, and it needs an address.
  // Until it answers we do NOT invent one: the old fallback (free over Rs200,
  // else Rs20) is a retired rule, and showing it made the total jump later.
  const feeKnown = quote?.delivery_fee != null;
  const bill = computeBill(subtotal, feeKnown ? quote!.delivery_fee : 0);
  const deliveryFee = bill.deliveryFee;
  const discount = coupon?.discount ?? 0;
  const grandTotal = Math.max(0, +(bill.grandTotal - discount).toFixed(2));
  // P10: wallet preview mirrors the server's math (min(balance, total)); the
  // server recomputes against the LIVE ledger and returns amount_payable.
  const walletApplied = useWallet ? Math.min(walletBalance, grandTotal) : 0;
  const payableTotal = Math.max(0, +(grandTotal - walletApplied).toFixed(2));

  // Wallet balance — refreshed whenever the cart gains focus.
  useEffect(() => {
    let cancelled = false;
    walletAPI.get()
      .then((r) => { if (!cancelled) setWalletBalance(Number(r.data?.balance) || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // P9: load bookable slots when the picker opens (fresh availability).
  const openSlots = async () => {
    if (!couponStoreId) {
      Alert.alert(t('scheduleUnavailableTitle'), t('scheduleUnavailableMsg'));
      return;
    }
    setShowSlots(true);
    setSlotsLoading(true);
    try {
      const { data } = await ordersAPI.scheduleSlots(couponStoreId);
      setSlotDays(data?.days || []);
      setSlotDayIdx(0);
    } catch {
      setSlotDays([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  // ── Coupon plumbing ────────────────────────────────────────────────────────

  // Store-scoped coupons need the cart's store — resolve once from the first item.
  useEffect(() => {
    const pid = items[0]?.product_id;
    if (!pid) { setCouponStoreId(null); return; }
    let cancelled = false;
    productsAPI.getOne(pid)
      .then((r) => { if (!cancelled) setCouponStoreId(r.data?.store_id ?? null); })
      .catch(() => { if (!cancelled) setCouponStoreId(null); });
    return () => { cancelled = true; };
  }, [items[0]?.product_id]);

  const applyCoupon = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean || couponChecking) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const { data } = await couponsAPI.validate({
        code: clean, subtotal, delivery_fee: deliveryFee, store_id: couponStoreId,
      });
      if (data?.valid) {
        setCoupon({ code: clean, discount: data.discount, free_delivery: !!data.free_delivery, title: data.offer?.title });
        setShowCoupons(false);
        setCouponInput('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        savedAnim.setValue(0);
        Animated.spring(savedAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }).start();
      } else {
        setCouponError(data?.reason || t('couponInvalid'));
      }
    } catch (e: any) {
      setCouponError(e?.response?.data?.detail || t('couponInvalid'));
    } finally {
      setCouponChecking(false);
    }
  };

  // Auto-apply the best eligible coupon ONCE per cart session. The moment the
  // user manually removes a coupon we stop auto-applying so we never fight them.
  const autoApplyDone = useRef(false);
  useEffect(() => {
    if (coupon || autoApplyDone.current || subtotal <= 0) return;
    let cancelled = false;
    couponsAPI.best({ subtotal, delivery_fee: deliveryFee, store_id: couponStoreId })
      .then(({ data }) => {
        if (cancelled || !data?.coupon) return;
        autoApplyDone.current = true;
        const c = data.coupon;
        setCoupon({ code: c.code, discount: c.discount, free_delivery: !!c.free_delivery, title: c.title });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      })
      .catch(() => { /* no auto coupon — silent */ });
    return () => { cancelled = true; };
  }, [couponStoreId, subtotal]);

  const removeCoupon = () => {
    autoApplyDone.current = true; // don't re-auto-apply after a manual removal
    setCoupon(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // Cart/fee changes invalidate the preview → silently re-validate the applied
  // code; if it no longer qualifies (e.g. items removed below min order), drop
  // it visibly rather than failing at order time.
  useEffect(() => {
    if (!coupon) return;
    let cancelled = false;
    couponsAPI.validate({ code: coupon.code, subtotal, delivery_fee: deliveryFee, store_id: couponStoreId })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.valid) {
          setCoupon((c) => (c ? { ...c, discount: data.discount } : c));
        } else {
          setCoupon(null);
          setCouponError(data?.reason || null);
          Alert.alert(t('couponRemovedTitle'), data?.reason || t('couponInvalid'));
        }
      })
      .catch(() => { /* transient network issue — order create re-validates anyway */ });
    return () => { cancelled = true; };
  }, [subtotal, deliveryFee, couponStoreId]);

  // Lazy-load redeemable coupons whenever the sheet opens (fresh eligibility).
  useEffect(() => {
    if (!showCoupons) return;
    let cancelled = false;
    couponsAPI.available({ subtotal, store_id: couponStoreId })
      .then((r) => { if (!cancelled) setAvailableCoupons(r.data || []); })
      .catch(() => { if (!cancelled) setAvailableCoupons([]); });
    return () => { cancelled = true; };
  }, [showCoupons, subtotal, couponStoreId]);

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
          <AudioNoteRecorder value={audioNote} onChange={setAudioNote} />
        </Card>

        {/* ── Delivery time (P9) ── */}
        <Card style={styles.couponCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>{t('deliveryTime')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
            <TouchableOpacity
              style={[styles.timeChip, !schedule && styles.timeChipOn]}
              onPress={() => setSchedule(null)}
            >
              <Ionicons name="flash" size={15} color={!schedule ? '#fff' : colors.primary} />
              <Text style={[styles.timeChipText, !schedule && styles.timeChipTextOn]}>{t('deliverNow')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timeChip, !!schedule && styles.timeChipOn]}
              onPress={openSlots}
            >
              <Ionicons name="calendar" size={15} color={schedule ? '#fff' : colors.primary} />
              <Text style={[styles.timeChipText, !!schedule && styles.timeChipTextOn]} numberOfLines={1}>
                {schedule ? `${schedule.day} · ${schedule.label}` : t('scheduleForLater')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── Wallet (P10) ── */}
        {walletBalance > 0 && (
          <Card style={styles.couponCard}>
            <TouchableOpacity style={styles.couponRow} activeOpacity={0.75}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setUseWallet(!useWallet); }}>
              <View style={styles.couponTicket}>
                <Ionicons name="wallet" size={18} color={useWallet ? colors.success : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponCta}>{t('useWalletBalance')}</Text>
                <Text style={styles.couponSaved}>
                  {useWallet
                    ? t('walletApplying', { amount: walletApplied.toFixed(0) })
                    : t('walletAvailable', { amount: walletBalance.toFixed(0) })}
                </Text>
              </View>
              <Ionicons name={useWallet ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
            </TouchableOpacity>
          </Card>
        )}

        {/* ── Coupon ── */}
        <Card style={styles.couponCard}>
          {coupon ? (
            <Animated.View style={[styles.couponApplied, {
              opacity: savedAnim,
              transform: [{ scale: savedAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            }]}>
              <View style={styles.couponTicket}>
                <Ionicons name="pricetag" size={18} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponCode}>{coupon.code}</Text>
                <Text style={styles.couponSaved}>
                  {coupon.free_delivery ? t('couponFreeDelivery') : t('couponYouSave', { amount: coupon.discount })}
                </Text>
              </View>
              <TouchableOpacity onPress={removeCoupon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.couponRow} activeOpacity={0.7} onPress={() => { setCouponError(null); setShowCoupons(true); }}>
              <View style={styles.couponTicket}>
                <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.couponCta}>{t('applyCoupon')}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
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
            <Text style={[styles.billValue, feeKnown && deliveryFee === 0 && styles.freeText]}>
              {!feeKnown ? '—' : deliveryFee === 0 ? t('free') : `₹${deliveryFee}`}
            </Text>
          </View>
          {!feeKnown && (
            <Text style={styles.feePendingNote}>
              Delivery fee depends on your address — added at the next step.
            </Text>
          )}
          {feeKnown && deliveryFee > 0 && <DeliveryFeeNote />}

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

          {discount > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.success }]}>
                {t('couponDiscountLabel', { code: coupon?.code })}
              </Text>
              <Text style={[styles.billValue, { color: colors.success }]}>-₹{discount.toFixed(2)}</Text>
            </View>
          )}

          {walletApplied > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: colors.success }]}>{t('walletCredits')}</Text>
              <Text style={[styles.billValue, { color: colors.success }]}>-₹{walletApplied.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandLabel}>{t('toPay')}</Text>
            <Text style={styles.grandValue}>₹{payableTotal.toFixed(2)}</Text>
          </View>
          {(discount > 0 || walletApplied > 0) && (
            <Text style={styles.totalSavings}>{t('totalSavings', { amount: (discount + walletApplied).toFixed(0) })}</Text>
          )}
        </Card>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerTotal}>₹{payableTotal}</Text>
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
          style={[styles.sheet, { paddingBottom: SPACING.xl + insets.bottom, transform: [{ translateY: sheetAnim }] }]}
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

          {/* Cancellation policy — read and acknowledged right before the order
              is placed. Wording is fixed by the business; not translated. */}
          <View style={styles.policyBox}>
            <View style={styles.policyHead}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning || '#B45309'} />
              <Text style={styles.policyTitle}>{CANCELLATION_POLICY_TITLE}</Text>
            </View>
            <Text style={styles.policyText}>{CANCELLATION_POLICY_TEXT}</Text>
            <TouchableOpacity
              style={styles.policyCheckRow}
              onPress={() => setPolicyAck((a) => !a)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: policyAck }}
              hitSlop={6}
            >
              <View style={[styles.policyCheckbox, policyAck && styles.policyCheckboxOn]}>
                {policyAck && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </View>
              <Text style={styles.policyCheckText}>{CANCELLATION_POLICY_ACK}</Text>
            </TouchableOpacity>
          </View>

          {/* Amount summary in sheet */}
          <View style={styles.sheetTotal}>
            <View>
              <Text style={styles.sheetTotalLabel}>{t('totalPayable')}</Text>
              <Text style={styles.sheetTotalValue}>₹{payableTotal}</Text>
            </View>
            <TouchableOpacity
              style={[styles.payNowBtn, (!policyAck || isLoading || !feeKnown) && styles.btnDisabled]}
              onPress={handleConfirmPayment}
              disabled={!policyAck || isLoading || !feeKnown}
              activeOpacity={0.85}
              accessibilityState={{ disabled: !policyAck || isLoading || !feeKnown }}
            >
              <Text style={styles.payNowText}>
                {!feeKnown
                  ? 'Calculating delivery…'
                  : selectedMethod === 'online' ? t('payNow') : t('placeOrder')}
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

      {/* ── Coupons: manual entry + suggestions ── */}
      <Modal
        visible={showCoupons}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoupons(false)}
      >
        <View style={styles.couponSheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCoupons(false)} />
          <View style={styles.couponSheet}>
            <View style={styles.couponSheetHandle} />
            <Text style={styles.couponSheetTitle}>{t('applyCoupon')}</Text>

            <View style={styles.couponInputRow}>
              <TextInput
                style={styles.couponInputBox}
                placeholder={t('couponPlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                value={couponInput}
                onChangeText={(v) => { setCouponInput(v); setCouponError(null); }}
                maxLength={24}
                returnKeyType="done"
                onSubmitEditing={() => applyCoupon(couponInput)}
              />
              <TouchableOpacity
                style={[styles.couponApplyBtn, (!couponInput.trim() || couponChecking) && styles.btnDisabled]}
                disabled={!couponInput.trim() || couponChecking}
                onPress={() => applyCoupon(couponInput)}
              >
                {couponChecking
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.couponApplyText}>{t('apply')}</Text>}
              </TouchableOpacity>
            </View>
            {couponError ? <Text style={styles.couponErr}>{couponError}</Text> : null}

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {availableCoupons.length === 0 && (
                <View style={styles.couponEmpty}>
                  <Ionicons name="pricetags-outline" size={34} color={colors.textMuted} />
                  <Text style={styles.couponEmptyText}>{t('noCoupons')}</Text>
                </View>
              )}
              {availableCoupons.map((c) => (
                <View key={c.id} style={[styles.couponOffer, !c.eligible && { opacity: 0.55 }]}>
                  <View style={styles.couponCodeChip}>
                    <Text style={styles.couponCodeChipText}>{c.code}</Text>
                  </View>
                  <Text style={styles.couponOfferTitle}>{c.title}</Text>
                  {c.subtitle ? <Text style={styles.couponOfferSub}>{c.subtitle}</Text> : null}
                  {c.eligible ? (
                    <View style={styles.couponOfferFoot}>
                      {c.discount_preview != null && (
                        <Text style={styles.couponPreview}>{t('couponYouSave', { amount: c.discount_preview })}</Text>
                      )}
                      <TouchableOpacity onPress={() => applyCoupon(c.code)} disabled={couponChecking}>
                        <Text style={styles.couponOfferApply}>{t('apply').toUpperCase()}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.couponIneligible}>{c.ineligible_reason}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Delivery slot picker (P9) ── */}
      <Modal visible={showSlots} transparent animationType="slide" onRequestClose={() => setShowSlots(false)}>
        <View style={styles.couponSheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSlots(false)} />
          <View style={styles.couponSheet}>
            <View style={styles.couponSheetHandle} />
            <Text style={styles.couponSheetTitle}>{t('pickDeliverySlot')}</Text>

            {/* Day tabs */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
              {slotDays.map((d, i) => (
                <TouchableOpacity key={d.date}
                  style={[styles.timeChip, slotDayIdx === i && styles.timeChipOn]}
                  onPress={() => setSlotDayIdx(i)}>
                  <Text style={[styles.timeChipText, slotDayIdx === i && styles.timeChipTextOn]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {slotsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.xl }} />
            ) : (slotDays[slotDayIdx]?.slots?.length ? (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <View style={styles.slotGrid}>
                  {slotDays[slotDayIdx].slots.map((s: any) => {
                    const on = schedule?.iso === s.iso;
                    return (
                      <TouchableOpacity key={s.iso} disabled={!s.available}
                        style={[styles.slotChip,
                          !s.available && { opacity: 0.35 },
                          on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setSchedule({ iso: s.iso, label: s.label, day: slotDays[slotDayIdx].label });
                          setShowSlots(false);
                        }}>
                        <Text style={[styles.slotChipText, on && { color: '#fff' }]}>{s.label}</Text>
                        {!s.available && <Text style={styles.slotFull}>{t('slotFull')}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.couponEmpty}>
                <Ionicons name="calendar-outline" size={34} color={colors.textMuted} />
                <Text style={styles.couponEmptyText}>{t('noSlotsToday')}</Text>
              </View>
            ))}
          </View>
        </View>
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
  // Coupon
  couponCard: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  couponApplied: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  couponTicket: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  couponCta: { flex: 1, fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text },
  couponCode: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  couponSaved: { fontSize: FONTS.sizes.sm, color: colors.success, fontWeight: '600', marginTop: 1 },
  totalSavings: {
    fontSize: FONTS.sizes.sm, color: colors.success, fontWeight: '700',
    textAlign: 'right', marginTop: 2,
  },
  // Coupon sheet
  couponSheetOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  couponSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
  },
  couponSheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  couponSheetTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: colors.text, marginBottom: SPACING.md },
  couponInputRow: { flexDirection: 'row', gap: SPACING.sm },
  couponInputBox: {
    flex: 1, backgroundColor: colors.surfaceLight, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: FONTS.sizes.md, fontWeight: '700', letterSpacing: 1, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  couponApplyBtn: {
    backgroundColor: colors.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center',
  },
  couponApplyText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  couponErr: { color: colors.error, fontSize: FONTS.sizes.sm, marginTop: SPACING.sm },
  couponEmpty: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  couponEmptyText: { color: colors.textMuted, fontSize: FONTS.sizes.md },
  couponOffer: {
    marginTop: SPACING.md, padding: SPACING.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg,
    borderStyle: 'dashed',
  },
  couponCodeChip: {
    alignSelf: 'flex-start', backgroundColor: colors.primary + '14',
    borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 6,
  },
  couponCodeChipText: { color: colors.primary, fontWeight: '800', letterSpacing: 1, fontSize: FONTS.sizes.sm },
  couponOfferTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text },
  couponOfferSub: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  couponOfferFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.sm,
  },
  couponPreview: { color: colors.success, fontWeight: '700', fontSize: FONTS.sizes.sm },
  couponOfferApply: { color: colors.primary, fontWeight: '800', fontSize: FONTS.sizes.md, letterSpacing: 0.5 },
  couponIneligible: { color: colors.textMuted, fontSize: FONTS.sizes.sm, marginTop: SPACING.sm, fontStyle: 'italic' },
  // Delivery time + slots (P9)
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  timeChipOn: { backgroundColor: colors.primary },
  timeChipText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  timeChipTextOn: { color: '#fff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  slotChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10, minWidth: '30%',
    alignItems: 'center', backgroundColor: colors.surfaceLight,
  },
  slotChipText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.text },
  slotFull: { fontSize: FONTS.sizes.xs, color: colors.error, marginTop: 2 },
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
  feePendingNote: { fontSize: 12, color: colors.textMuted, marginTop: -4, marginBottom: 8 },
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
  policyBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: (colors.warning || '#B45309') + '55',
    backgroundColor: (colors.warning || '#B45309') + '12',
  },
  policyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  policyTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: colors.text },
  policyText: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, lineHeight: 19, marginTop: 4 },
  policyCheckRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  policyCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  policyCheckboxOn: { backgroundColor: colors.primary },
  policyCheckText: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: '600', color: colors.text },
});

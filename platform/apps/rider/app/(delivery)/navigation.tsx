/**
 * Rider Navigation Screen — OSM (Leaflet/WebView) map, no Google.
 *
 * Shows store + customer markers, the OSRM route polyline, and the rider's
 * live position. GPS streams over WebSocket (useRiderTracking). Route is
 * recalculated when the rider moves > 50 m. "Arrived At Restaurant" appears
 * inside the ~100 m geofence before pickup.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert,
  ActivityIndicator, SafeAreaView, Platform, useWindowDimensions, AppState,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { TrackingMap, MapCoord } from '../../src/components/TrackingMap';
import { useRiderTracking } from '../../src/hooks/useRiderTracking';
import { fetchRoute, haversineKmExport } from '../../src/services/routing';
import { openNativeNavigation } from '../../src/utils/nav';
import api, { ordersAPI } from '../../src/services/api';

const STATUS_LABEL: Record<string, string> = {
  delivery_assigned: 'Heading to store',
  preparing:         'Heading to store',
  ready_for_pickup:  'Heading to store',
  out_for_delivery:  'Heading to customer',
};

export default function RiderNavigationScreen() {
  const router = useRouter();
  const { height: screenH } = useWindowDimensions();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order,    setOrder]    = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [route,    setRoute]    = useState<MapCoord[] | null>(null);
  const [eta,      setEta]      = useState<number | null>(null);
  const [distKm,   setDistKm]   = useState<number | null>(null);
  const [riderLat, setRiderLat] = useState<number | null>(null);
  const [riderLng, setRiderLng] = useState<number | null>(null);
  const [arrived,  setArrived]  = useState(false);
  const [markingArrived, setMarkingArrived] = useState(false);
  const routeReady = useRef(false);

  // Inline pickup/delivery confirmation (so the rider never has to leave this
  // screen after returning from Google Maps).
  const [showOtp, setShowOtp] = useState(false);
  const [otpType, setOtpType] = useState<'pickup' | 'delivery'>('pickup');
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const autoArrivedRef = useRef(false);

  // ── Per-order state isolation (BUGFIX) ─────────────────────────────────────
  // This screen is a persistent tab, so without an explicit reset the previous
  // order's state (arrived flag, route, ETA, rider position) leaked into the
  // next order — e.g. "Arrived at Restaurant" looked already done. Reset every
  // piece of per-order state whenever the orderId changes.
  useEffect(() => {
    setOrder(null);
    setLoading(true);
    setArrived(false);
    setMarkingArrived(false);
    setRoute(null);
    setEta(null);
    setDistKm(null);
    setRiderLat(null);
    setRiderLng(null);
    routeReady.current = false;
    setShowOtp(false);
    setOtpCode('');
    autoArrivedRef.current = false;
  }, [orderId]);

  // ── Load order snapshot ────────────────────────────────────────────────────
  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get(`/tracking/${orderId}/snapshot`);
      setOrder(res.data);
    } catch {
      try { const res = await api.get(`/orders/${orderId}`); setOrder(res.data); } catch {}
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  // ── Return-from-Maps handler ───────────────────────────────────────────────
  // When the rider comes back from Google Maps (app → foreground), the WS GPS
  // stream has been paused, so the geofence/"arrived" state is stale. Pull a
  // fresh order snapshot + a one-shot GPS fix so the Pickup action surfaces
  // immediately — no waiting for the next socket tick.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      loadOrder();
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setRiderLat(loc.coords.latitude);
          setRiderLng(loc.coords.longitude);
        } catch {}
      })();
    });
    return () => sub.remove();
  }, [loadOrder]);

  useEffect(() => { if (order?.rider_arrived_at_store) setArrived(true); }, [order]);

  // ── GPS → WebSocket + marker (NO route recalculation per update) ───────────
  // Cost optimisation: the rider marker simply moves on each GPS tick. The route
  // line is generated ONCE (below) and reused. Real turn-by-turn is the native
  // Google Maps deep link, so we never poll Directions during navigation.
  const active = !!(orderId && order && !['delivered', 'cancelled'].includes(order?.status));
  useRiderTracking(orderId, active, (lat, lng) => {
    setRiderLat(lat);
    setRiderLng(lng);
  });

  // ── Route generated ONCE per order ─────────────────────────────────────────
  useEffect(() => {
    if (!order || routeReady.current) return;
    (async () => {
      // Post-pickup: reuse the backend-generated Restaurant→Customer route.
      if (Array.isArray(order.route_polyline) && order.route_polyline.length > 1) {
        setRoute(order.route_polyline.map((p: number[]) => ({ latitude: p[0], longitude: p[1] })));
        setEta(order.route_eta_minutes ?? null);
        setDistKm(order.route_distance_km ?? null);
        routeReady.current = true;
        return;
      }
      // Otherwise fetch the current leg exactly once (store→customer context).
      const from = order.kirana_location;
      const to = order.delivery_location;
      if (from?.lat && to?.lat) {
        try {
          const r = await fetchRoute(from.lat, from.lng, to.lat, to.lng);
          setRoute(r.polyline);
          setEta(r.etaMinutes);
          setDistKm(r.distanceKm);
          routeReady.current = true;
        } catch {}
      }
    })();
  }, [order]);

  const markArrived = async () => {
    if (!orderId) return;
    setMarkingArrived(true);
    try { await ordersAPI.arrivedAtStore(orderId); setArrived(true); }
    catch {} finally { setMarkingArrived(false); }
  };

  const openPickup = () => { setOtpType('pickup'); setOtpCode(''); setShowOtp(true); };
  const openDelivery = () => { setOtpType('delivery'); setOtpCode(''); setShowOtp(true); };

  // Confirm pickup (→ out_for_delivery) or delivery (→ delivered), verified
  // server-side. On success the screen flips to the next leg automatically.
  const submitOtp = async () => {
    if (!orderId || otpCode.length !== 4) {
      Alert.alert('Enter code', 'Please enter the 4-character code.');
      return;
    }
    const target = otpType === 'pickup' ? 'out_for_delivery' : 'delivered';
    setVerifying(true);
    try {
      await ordersAPI.updateStatus(orderId, target, otpCode);
      setShowOtp(false);
      setOtpCode('');
      if (otpType === 'pickup') {
        routeReady.current = false; // regenerate route for the store→customer leg
        await loadOrder();
        Alert.alert('Picked up', 'Order picked up — navigate to the customer.');
      } else {
        Alert.alert('Delivered', 'Delivery confirmed. Great job!');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Invalid code', e?.response?.data?.detail || 'Could not verify the code.');
    } finally {
      setVerifying(false);
    }
  };

  // No automatic actions: the "Arrived At Restaurant" button surfaces inside the
  // geofence (showArrivedBtn) and the rider taps it explicitly — we never fire it
  // for them. (Removed the previous auto-arrive effect per the no-auto-tap rule.)

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </SafeAreaView>
    );
  }

  const prePickup  = ['delivery_assigned', 'preparing', 'ready_for_pickup'].includes(order?.status);
  const readyForPickup = order?.status === 'ready_for_pickup';
  const destLoc    = prePickup ? order?.kirana_location : order?.delivery_location;
  const storeLoc   = order?.kirana_location;
  const customerLoc = order?.delivery_location;
  const statusText = STATUS_LABEL[order?.status] || 'Navigating';

  const GEOFENCE_M = 100;
  const straightToStoreM =
    riderLat != null && riderLng != null && storeLoc?.lat != null
      ? haversineKmExport(riderLat, riderLng, storeLoc.lat, storeLoc.lng) * 1000
      : null;
  const showArrivedBtn = prePickup && !arrived && straightToStoreM != null && straightToStoreM <= GEOFENCE_M;

  const haveGeo = storeLoc?.lat != null && customerLoc?.lat != null;

  return (
    <View style={styles.container}>
      {/* ── OSM map (Leaflet/WebView) ──────────────────────────────────────── */}
      {haveGeo ? (
        <TrackingMap
          storeLat={storeLoc.lat} storeLng={storeLoc.lng}
          destLat={customerLoc.lat} destLng={customerLoc.lng}
          riderLat={riderLat} riderLng={riderLng}
          route={route}
          height={screenH}
          showRecenter
        />
      ) : (
        <View style={styles.center}><Text style={styles.loadingText}>Waiting for location…</Text></View>
      )}

      {/* ── Top status bar ─────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topCard}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.orderText}>#{orderId?.slice(-8).toUpperCase()}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Bottom panel ───────────────────────────────────────────────────── */}
      <View style={styles.bottomPanel}>
        {showArrivedBtn && (
          <TouchableOpacity style={styles.arrivedBtn} onPress={markArrived} disabled={markingArrived} activeOpacity={0.85}>
            {markingArrived
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="storefront" size={18} color="#fff" /><Text style={styles.arrivedBtnText}>Arrived At Restaurant</Text></>}
          </TouchableOpacity>
        )}
        {prePickup && arrived && (
          <View style={styles.arrivedDone}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.arrivedDoneText}>
              {readyForPickup ? "You've arrived — confirm pickup below" : 'Arrived — waiting for the order to be ready'}
            </Text>
          </View>
        )}

        {/* Inline pickup / delivery confirmation — no need to leave this screen.
            Pickup is only valid once the restaurant marks the order ready. */}
        {readyForPickup && (
          <TouchableOpacity style={styles.confirmBtn} onPress={openPickup} activeOpacity={0.85}>
            <Ionicons name="bag-check" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Pickup</Text>
          </TouchableOpacity>
        )}
        {order?.status === 'out_for_delivery' && (
          <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnDeliver]} onPress={openDelivery} activeOpacity={0.85}>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoValue}>{eta != null ? `${eta} min` : '—'}</Text>
            <Text style={styles.infoLabel}>ETA</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBlock}>
            <Text style={styles.infoValue}>{distKm != null ? `${distKm} km` : '—'}</Text>
            <Text style={styles.infoLabel}>Distance</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBlock}>
            <Text style={styles.infoValue}>{prePickup ? 'Store' : 'Customer'}</Text>
            <Text style={styles.infoLabel}>Destination</Text>
          </View>
        </View>

        {/* ── Deep-link navigation (opens native Google Maps — no API cost) ──── */}
        <View style={styles.navBtnRow}>
          <TouchableOpacity
            style={[styles.navBtn, !storeLoc?.lat && styles.navBtnDisabled]}
            disabled={!storeLoc?.lat}
            onPress={() => openNativeNavigation(storeLoc?.lat, storeLoc?.lng)}
          >
            <Ionicons name="storefront" size={16} color="#fff" />
            <Text style={styles.navBtnText}>Navigate to Restaurant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnAlt, !customerLoc?.lat && styles.navBtnDisabled]}
            disabled={!customerLoc?.lat}
            onPress={() => openNativeNavigation(customerLoc?.lat, customerLoc?.lng)}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.navBtnText}>Navigate to Customer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Pickup / Delivery OTP modal ────────────────────────────────────── */}
      <Modal visible={showOtp} transparent animationType="slide" onRequestClose={() => setShowOtp(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{otpType === 'pickup' ? 'Verify Pickup' : 'Verify Delivery'}</Text>
              <TouchableOpacity onPress={() => setShowOtp(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              {otpType === 'pickup'
                ? 'Enter the LAST 4 CHARACTERS of the Order ID (the store confirms it from their ticket).'
                : 'Ask the CUSTOMER for the 4-digit Delivery OTP shown in their app.'}
            </Text>
            <TextInput
              style={styles.codeInput}
              placeholder="••••"
              placeholderTextColor={COLORS.textMuted}
              value={otpCode}
              onChangeText={(t) =>
                otpType === 'pickup'
                  ? setOtpCode(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4))
                  : setOtpCode(t.replace(/\D/g, '').slice(0, 4))
              }
              maxLength={4}
              keyboardType={otpType === 'pickup' ? 'default' : 'number-pad'}
              autoCapitalize="characters"
              textAlign="center"
            />
            <TouchableOpacity
              style={[styles.confirmBtn, otpCode.length !== 4 && styles.navBtnDisabled]}
              onPress={submitOtp}
              disabled={otpCode.length !== 4 || verifying}
              activeOpacity={0.85}
            >
              {verifying
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.confirmBtnText}>{otpType === 'pickup' ? 'Verify & Pick Up' : 'Verify & Complete'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8e8e8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.sm },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    borderRadius: RADIUS.lg, padding: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  orderText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 10,
  },
  arrivedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, marginBottom: SPACING.md,
  },
  arrivedBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  arrivedDone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.success + '15', borderRadius: RADIUS.md, paddingVertical: 10, marginBottom: SPACING.md,
  },
  arrivedDoneText: { color: COLORS.success, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 14, marginBottom: SPACING.md,
  },
  confirmBtnDeliver: { backgroundColor: COLORS.primary },
  confirmBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  modalContent: { backgroundColor: COLORS.background, borderRadius: RADIUS.xl, padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  modalDesc: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginBottom: SPACING.lg, textAlign: 'center' },
  codeInput: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text, letterSpacing: 8,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navBtnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 8,
  },
  navBtnAlt: { backgroundColor: COLORS.info },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { color: '#fff', fontSize: FONTS.sizes.xs, fontWeight: '700' },
  infoBlock: { alignItems: 'center', flex: 1 },
  infoValue: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  infoLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  infoDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
});

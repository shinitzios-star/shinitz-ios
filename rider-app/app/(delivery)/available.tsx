import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { OrderCard } from '../../src/components/OrderCard';
import { ordersAPI, locationAPI, authAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { deliveryAPI } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExitOnBack } from '../../src/hooks/useExitOnBack';
import { BackgroundAlertSetup } from '../../src/components/BackgroundAlertSetup';
import { haversineKmExport } from '../../src/services/routing';
import { ensureLocationAccess, hasForegroundLocation } from '../../src/delivery/locationConsent';

// A rider only sees orders whose store is within this radius (km).
const RIDER_RADIUS_KM = 3;

export default function AvailableOrdersScreen() {
  useExitOnBack();
  const router = useRouter();
  const { user, updateLocation, login } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);

  // A rider must be admin-verified before they can go online or take orders.
  const isVerified = user?.verified === true;
  // Location is watched and reported only for a rider the SERVER has online.
  // (This screen's own `isOnline` starts at true and is only flipped by its
  // toggle, so it cannot tell an offline rider apart.) refreshUser keeps the
  // stored user current on every focus.
  const riderOnline = user?.is_online === true;
  // Effective availability: online AND verified. Drives the order feed + buzzer.
  const effectiveOnline = isOnline && isVerified;

  // Client-side 3 km filter using the rider's LIVE GPS — orders drop off the
  // list the instant the rider leaves a store's 3 km zone, without waiting for
  // the next server poll. The backend enforces the same radius on accept.
  const visibleOrders = useMemo(() => {
    if (!myLoc) return orders;
    return orders.filter((o) => {
      const k = o.kirana_location;
      if (!k?.lat) return true; // unknown store location → trust server filter
      return haversineKmExport(myLoc.lat, myLoc.lng, k.lat, k.lng) <= RIDER_RADIUS_KM;
    });
  }, [orders, myLoc]);

  // New-delivery alerting (buzzer + full-screen popup) is handled APP-WIDE by
  // OrderAlertCenter in the (delivery) layout — this screen only shows the list.
  // The list itself still only shows offers while the rider is online+verified.
  const feedOrders = useMemo(
    () => (effectiveOnline ? visibleOrders : []),
    [effectiveOnline, visibleOrders],
  );

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        ordersAPI.getAll(),
        deliveryAPI.getStats(),
      ]);

      // Available orders are now in "accepted" status — kirana has confirmed
      // but delivery commitment is required before cooking can start.
      const availableOrders = ordersRes.data.filter(
        // `preparing` is claimable too — the kitchen may start before a rider
        // is found, and the order is still unassigned.
        (o: any) => ['accepted', 'preparing'].includes(o.status)
      );
      setOrders(availableOrders);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleToggleOnline = async () => {
    if (!isVerified) {
      Alert.alert(
        'Verification Pending',
        "Your account is awaiting admin verification. You'll be able to go online once approved.",
      );
      return;
    }
    setToggling(true);
    try {
      const newStatus = !isOnline;
      // Going online is where location starts to matter, so this is where the
      // prominent disclosure and the permission requests happen. The rider can
      // still go online if they decline — they just won't be matched to orders
      // until location is on.
      if (newStatus) await ensureLocationAccess({ background: true, mode: 'explicit' });
      await deliveryAPI.toggleStatus(newStatus);
      setIsOnline(newStatus);
      refreshUser();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to update status. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setToggling(false);
    }
  };

  const updateMyLocation = async () => {
    try {
      // Runs on every focus and pull-to-refresh, so it must never raise the
      // system dialog (that belongs behind the disclosure, in locationConsent),
      // and must not report a position for a rider who is offline.
      if (useAuthStore.getState().user?.is_online !== true || !(await hasForegroundLocation())) return;

      const loc = await Location.getCurrentPositionAsync({});
      setMyLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      await updateLocation(loc.coords.latitude, loc.coords.longitude);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Pull the latest user from the server so an admin's verification/approval
  // shows up live — otherwise the rider would stay "Pending" until re-login.
  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.getMe();
      const token = await AsyncStorage.getItem('auth_token');
      if (res.data && token) await login(res.data, token);
    } catch {}
  }, [login]);

  // Only poll while focused (saves battery; user might be on Active or Earnings tab)
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      updateMyLocation();
      fetchData();
      const interval = setInterval(fetchData, 12000);
      return () => clearInterval(interval);
    }, [fetchData, refreshUser]),
  );

  // ── Live GPS watcher → continuous eligibility re-check ─────────────────────
  // watchPositionAsync streams updates as the rider moves; we update myLoc
  // (instant client-side filtering) and throttle backend pushes to ~8s.
  useFocusEffect(
    useCallback(() => {
      let sub: Location.LocationSubscription | null = null;
      let cancelled = false;
      let lastPush = 0;
      (async () => {
        // Continuous tracking is for an ONLINE rider only — offline, nothing
        // is watched or sent. Restarts when isOnline flips (dependency below).
        if (!riderOnline || !(await hasForegroundLocation())) return;
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 5000 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setMyLoc({ lat: latitude, lng: longitude });
            const now = Date.now();
            if (now - lastPush > 8000) {
              lastPush = now;
              updateLocation(latitude, longitude).catch(() => {});
            }
          },
        );
        if (cancelled) { s.remove(); return; }
        sub = s;
      })();
      return () => { cancelled = true; sub?.remove(); };
    }, [riderOnline]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    updateMyLocation();
    fetchData();
  };

  const handleAcceptDelivery = async (orderId: string) => {
    if (!isVerified) {
      Alert.alert('Verification Pending', 'You can accept orders once an admin verifies your account.');
      return;
    }
    try {
      await ordersAPI.updateStatus(orderId, 'delivery_assigned');
      Alert.alert('Success', 'Delivery accepted! Head to the store for pickup.');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept delivery');
    }
  };

  // Decline the pushed offer → engine re-offers to the next nearest rider. No penalty.
  const handleRejectOffer = async (orderId: string) => {
    try {
      await ordersAPI.rejectOffer(orderId);
    } catch {
      // ignore — the offer may have already expired
    } finally {
      fetchData();
    }
  };

  // Emergency SOS — alerts support with the rider's live location.
  const handleSOS = () => {
    Alert.alert('Emergency SOS', 'Alert support with your live location?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send SOS',
        style: 'destructive',
        onPress: async () => {
          try {
            await deliveryAPI.sos(myLoc?.lat, myLoc?.lng);
            Alert.alert('SOS sent', 'Support has been alerted with your location.');
          } catch {
            Alert.alert('Could not send SOS', 'Please call support directly.');
          }
        },
      },
    ]);
  };

  // Online-time tracker (resets when the rider goes offline) — feeds the
  // "Today's Progress" card like the reference rider app.
  const [onlineSince, setOnlineSince] = useState<number | null>(null);
  const [onlineMins, setOnlineMins] = useState(0);
  useEffect(() => {
    if (effectiveOnline) setOnlineSince((s) => s ?? Date.now());
    else { setOnlineSince(null); setOnlineMins(0); }
  }, [effectiveOnline]);
  useEffect(() => {
    if (!onlineSince) return;
    const tick = () => setOnlineMins(Math.floor((Date.now() - onlineSince) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [onlineSince]);
  const onlineLabel = `${Math.floor(onlineMins / 60)}h ${onlineMins % 60}m`;

  const statusLabel = !isVerified ? 'Pending' : isOnline ? 'Online' : 'Offline';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Quick-action tiles (Swiggy-rider style, in the Shinitz palette).
  const TILES = [
    { key: 'wallet', title: 'Wallet', sub: 'Balance & payouts', icon: 'wallet' as const, tint: COLORS.primary, onPress: () => router.push('/(delivery)/wallet' as any) },
    { key: 'incentive', title: 'Incentives', sub: 'Earn extra', icon: 'gift' as const, tint: COLORS.accentDark, onPress: () => router.push('/(delivery)/earnings' as any) },
    { key: 'history', title: 'Ride History', sub: 'Past deliveries', icon: 'time' as const, tint: COLORS.info, onPress: () => router.push('/(delivery)/history' as any) },
    { key: 'refer', title: 'Refer & Earn', sub: 'Invite friends', icon: 'people' as const, tint: COLORS.success, onPress: () => Alert.alert('Refer & Earn', 'Referrals are coming soon!') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar — Online toggle + Help + SOS */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.onlineToggle, !effectiveOnline && styles.onlineToggleOff]}
          onPress={handleToggleOnline}
          disabled={toggling}
          activeOpacity={0.85}
        >
          {toggling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={[styles.onlineKnob, effectiveOnline ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              <View style={[styles.onlineKnobDot, { backgroundColor: effectiveOnline ? COLORS.success : '#6b7280' }]} />
            </View>
          )}
          <Text style={styles.onlineText}>{statusLabel}</Text>
        </TouchableOpacity>

        <View style={styles.topActions}>
          <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/(delivery)/profile' as any)}>
            <Ionicons name="headset-outline" size={15} color={COLORS.text} />
            <Text style={styles.helpText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
            <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Make sure background order alerts actually reach the rider */}
      <BackgroundAlertSetup />

      <FlatList
        data={feedOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => (
          <OrderCard order={item} userRole="delivery" onAction={() => handleAcceptDelivery(item.id)} />
        )}
        ListHeaderComponent={
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'Partner'} 👋</Text>

            {/* Verification gate banner */}
            {!isVerified && (
              <TouchableOpacity
                style={styles.verifyBanner}
                activeOpacity={0.85}
                onPress={() => router.push('/(delivery)/verification' as any)}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.warning} />
                <Text style={styles.verifyBannerText}>
                  Complete verification to go online — upload documents &amp; add your bank account.
                </Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.warning} />
              </TouchableOpacity>
            )}

            {/* Offline banner */}
            {isVerified && !isOnline && (
              <View style={styles.offlineBanner}>
                <Ionicons name="moon" size={18} color={COLORS.warning} />
                <Text style={styles.offlineBannerText}>You're offline. Go online to receive orders.</Text>
              </View>
            )}

            {/* Today's Progress */}
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>TODAY&apos;S PROGRESS</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressCol}>
                  <Text style={styles.progressValue}>₹{stats?.total_earnings || 0}</Text>
                  <Text style={styles.progressLabel}>Earnings</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressCol}>
                  <Text style={styles.progressValue}>{onlineLabel}</Text>
                  <Text style={styles.progressLabel}>Online time</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressCol}>
                  <Text style={styles.progressValue}>{stats?.completed_deliveries || 0}</Text>
                  <Text style={styles.progressLabel}>Orders</Text>
                </View>
              </View>
            </View>

            {/* Quick-action tiles */}
            <View style={styles.tilesGrid}>
              {TILES.map((tile) => (
                <TouchableOpacity key={tile.key} style={styles.tile} activeOpacity={0.85} onPress={tile.onPress}>
                  <View style={[styles.tileIcon, { backgroundColor: tile.tint + '18' }]}>
                    <Ionicons name={tile.icon} size={22} color={tile.tint} />
                  </View>
                  <Text style={styles.tileTitle}>{tile.title}</Text>
                  <Text style={styles.tileSub}>{tile.sub}</Text>
                  <Ionicons name="arrow-forward-circle" size={22} color={tile.tint} style={styles.tileArrow} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Lifetime summary chips */}
            <View style={styles.lifeRow}>
              <View style={styles.lifeChip}>
                <Ionicons name="bicycle" size={16} color={COLORS.primary} />
                <Text style={styles.lifeChipText}>{stats?.total_deliveries || 0} total</Text>
              </View>
              <View style={styles.lifeChip}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={styles.lifeChipText}>{stats?.completed_deliveries || 0} done</Text>
              </View>
              <View style={styles.lifeChip}>
                <Ionicons name="cash" size={16} color={COLORS.accentDark} />
                <Text style={styles.lifeChipText}>₹{stats?.total_earnings || 0}</Text>
              </View>
            </View>

            <Text style={styles.feedTitle}>
              {!isVerified ? 'Verification pending' : !isOnline ? 'Currently offline' : 'Available deliveries'}
            </Text>

            {feedOrders.length > 0 && (
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={18} color={COLORS.info} />
                <Text style={styles.infoText}>
                  A delivery has been offered to you — accept before it moves to another rider
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={!isVerified ? 'shield-checkmark-outline' : !isOnline ? 'moon-outline' : 'bicycle-outline'}
                size={48}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.emptyText}>
              {!isVerified ? 'Verification pending' : !isOnline ? "You're offline" : 'Waiting for delivery offers'}
            </Text>
            <Text style={styles.emptySubtext}>
              {!isVerified
                ? 'Waiting for admin approval to start delivering'
                : !isOnline
                  ? 'Go online to receive orders'
                  : "You'll be offered the nearest delivery — sit tight"}
            </Text>
          </View>
        }
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
  },
  onlineToggle: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.success, borderRadius: RADIUS.full,
    paddingVertical: 6, paddingHorizontal: 8, minWidth: 132,
  },
  onlineToggleOff: { backgroundColor: '#6b7280' },
  onlineKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  onlineKnobDot: { width: 12, height: 12, borderRadius: 6 },
  onlineText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },

  topActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  helpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.surface,
  },
  helpText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.error + '60', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.error + '12',
  },
  sosText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.error },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  greeting: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xs, marginBottom: SPACING.md },

  // Today's Progress
  progressCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  progressTitle: { fontSize: FONTS.sizes.xs, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1, textAlign: 'center', marginBottom: SPACING.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressCol: { flex: 1, alignItems: 'center', gap: 2 },
  progressValue: { fontSize: FONTS.sizes.xl, fontWeight: '900', color: COLORS.text },
  progressLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  progressDivider: { width: 1, height: 36, backgroundColor: COLORS.border },

  // Tiles
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SPACING.md },
  tile: {
    width: '48.5%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  tileTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
  tileSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 1 },
  tileArrow: { position: 'absolute', top: SPACING.md, right: SPACING.md },

  // Lifetime chips
  lifeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  lifeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  lifeChipText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text },

  feedTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.info + '15',
    padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.md, gap: SPACING.xs,
  },
  infoText: { fontSize: FONTS.sizes.sm, color: COLORS.info, flex: 1 },

  verifyBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warning + '15',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.warning + '40', gap: SPACING.sm, marginBottom: SPACING.md,
  },
  verifyBannerText: { fontSize: FONTS.sizes.sm, color: COLORS.warning, fontWeight: '600', flex: 1 },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warning + '15',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg,
    gap: SPACING.sm, marginBottom: SPACING.md,
  },
  offlineBannerText: { fontSize: FONTS.sizes.sm, color: COLORS.warning, fontWeight: '600', flex: 1 },

  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text, marginTop: SPACING.xs },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

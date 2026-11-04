// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Restaurant — Dashboard (premium merchant redesign).
// Zomato-Partner-grade layout in SHINITZ green/gold: gradient hero with the
// store identity + live online toggle, animated stat counters, quick actions,
// and the 7-day revenue chart. ALL data wiring is unchanged (storeAPI /
// analyticsAPI / payoutAPI / authAPI refresh, optimistic online toggle,
// BackgroundAlertSetup, BusinessHours, VerificationBadge).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert,
  TouchableOpacity, Animated, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, icon, typography, elevation, gradients, hitSlop } from '../../src/constants/designSystem';
import { Card } from '../../src/components/ui';
import { VerificationBadge } from '../../src/components/VerificationBadge';
import { BusinessHours } from '../../src/components/BusinessHours';
import { BackgroundAlertSetup } from '../../src/components/BackgroundAlertSetup';
import { useAuthStore } from '../../src/store/authStore';
import { useExitOnBack } from '../../src/hooks/useExitOnBack';
import { storeAPI, authAPI, analyticsAPI, payoutAPI } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** Counter that animates up to its value — premium "live dashboard" feel. */
function AnimatedNumber({ value, format = (n: number) => String(Math.round(n)), style }: {
  value: number | null | undefined;
  format?: (n: number) => string;
  style?: any;
}) {
  const [text, setText] = useState(value == null ? '—' : format(0));
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (value == null) { setText('—'); return; }
    anim.setValue(0);
    const id = anim.addListener(({ value: p }) => setText(format(p * value)));
    Animated.timing(anim, { toValue: 1, duration: 650, useNativeDriver: false }).start(() => {
      setText(format(value));
    });
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={style} numberOfLines={1}>{text}</Text>;
}

export default function RestaurantDashboard() {
  useExitOnBack();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, login } = useAuthStore();
  const [isOnline, setIsOnline] = useState(true);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [pendingPayout, setPendingPayout] = useState(0);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [refreshing, setRefreshing] = useState(false);

  // Pulsing live dot while online.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isOnline) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.6, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isOnline]);

  const load = useCallback(() => {
    let active = true;
    storeAPI.getOnline()
      .then((r) => { if (active) { setIsOnline(r.data?.is_online !== false); setStatusLoaded(true); } })
      .catch(() => { if (active) setStatusLoaded(true); });
    analyticsAPI.partner()
      .then((r) => { if (active) { setAnalytics(r.data); setRefreshing(false); } })
      .catch(() => setRefreshing(false));
    payoutAPI.summary()
      .then((r) => { if (active) setPendingPayout(r.data?.pending || 0); })
      .catch(() => {});
    // Refresh the user from the server so verification/approval status is LIVE
    // (admin may have approved after login — header badge would otherwise be stale).
    (async () => {
      try {
        const res = await authAPI.getMe();
        const token = await AsyncStorage.getItem('auth_token');
        if (active && res.data && token) await login(res.data, token);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const toggleOnline = async (next: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setToggling(true);
    setIsOnline(next); // optimistic
    try {
      await storeAPI.setOnline(next);
    } catch (e: any) {
      setIsOnline(!next); // revert
      Alert.alert('Error', e.response?.data?.detail || 'Could not update status');
    } finally { setToggling(false); }
  };

  const pLabel = period === 'today' ? 'Today' : period === 'week' ? 'Week' : 'Month';
  const periodOrders = period === 'today' ? analytics?.today_orders : period === 'week' ? analytics?.week_orders : analytics?.month_orders;
  const periodRevenue = period === 'today' ? analytics?.today_revenue : period === 'week' ? analytics?.week_revenue : analytics?.month_revenue;

  const QUICK_ACTIONS: { icon: any; label: string; color: string; route: string }[] = [
    { icon: 'receipt', label: 'Orders', color: '#3b82f6', route: '/(restaurant)/orders' },
    { icon: 'restaurant', label: 'Menu', color: '#f59e0b', route: '/(restaurant)/menu' },
    { icon: 'wallet', label: 'Payouts', color: '#10b981', route: '/(restaurant)/payouts' },
    { icon: 'megaphone', label: 'Campaigns', color: '#8b5cf6', route: '/(restaurant)/campaigns' },
    { icon: 'shield-checkmark', label: 'Verify', color: '#06b6d4', route: '/(restaurant)/verification' },
    { icon: 'person', label: 'Profile', color: '#ec4899', route: '/(restaurant)/profile' },
  ];

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* ── Gradient hero: identity left, live Online/Offline control right ── */}
      <LinearGradient
        colors={gradients.hero as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + space.md }]}
      >
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroGreeting}>Welcome back</Text>
            <Text style={s.heroName} numberOfLines={1}>{user?.restaurant_name || user?.name}</Text>
            <View style={s.heroMetaRow}>
              <View style={[s.verifyPill, { backgroundColor: user?.verified ? 'rgba(212,175,55,0.25)' : 'rgba(245,158,11,0.25)' }]}>
                <Ionicons name={user?.verified ? 'checkmark-circle' : 'time'} size={13}
                  color={user?.verified ? '#efd27a' : '#fcd34d'} />
                <Text style={[s.verifyText, { color: user?.verified ? '#efd27a' : '#fcd34d' }]}>
                  {user?.verified ? 'Verified' : 'Pending'}
                </Text>
              </View>
              <Text style={s.heroStatusCaption} numberOfLines={1}>
                {isOnline ? 'Accepting orders' : 'Not accepting orders'}
              </Text>
            </View>
          </View>

          {/* Online/Offline — instantly reachable the moment the app opens.
              Same wiring as before: optimistic, reverts on API failure,
              spinner (= tap-guard) while the change is in flight. */}
          <View style={[s.togglePill, { backgroundColor: isOnline ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.12)' }]}>
            <View style={s.dotWrap}>
              <Animated.View style={[s.dotPulse, {
                backgroundColor: (isOnline ? '#34d399' : '#f87171') + '55',
                transform: [{ scale: pulse }],
              }]} />
              <View style={[s.dot, { backgroundColor: isOnline ? '#34d399' : '#f87171' }]} />
            </View>
            <Text style={s.toggleLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
            {toggling || !statusLoaded
              ? <ActivityIndicator size="small" color="#fff" />
              : <Switch value={isOnline} onValueChange={toggleOnline}
                  trackColor={{ false: 'rgba(255,255,255,0.25)', true: colors.success }} thumbColor="#fff" />}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg }}>
          {/* Alert readiness + operating hours + verification (unchanged features) */}
          <BackgroundAlertSetup />
          <BusinessHours />
          <VerificationBadge />

          {/* ── Quick actions ── */}
          <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.lg, marginBottom: space.md }]}>
            Quick Actions
          </Text>
          <View style={s.actionsGrid}>
            {QUICK_ACTIONS.map((a) => (
              <TouchableOpacity
                key={a.label}
                style={[s.actionCard, { backgroundColor: colors.card }, elevation(1)]}
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push(a.route as any);
                }}
              >
                <View style={[s.actionIcon, { backgroundColor: a.color + '16' }]}>
                  <Ionicons name={a.icon} size={icon.md} color={a.color} />
                </View>
                <Text style={[typography.caption as any, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Analytics ── */}
          <View style={s.analyticsHead}>
            <Text style={[typography.h3 as any, { color: colors.text }]}>Analytics</Text>
            <View style={[s.periodRow, { backgroundColor: colors.surfaceLight }]}>
              {(['today', 'week', 'month'] as const).map((p) => (
                <TouchableOpacity key={p}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setPeriod(p); }}
                  style={[s.periodPill, period === p && { backgroundColor: colors.primary }]}>
                  <Text style={[s.periodText, { color: period === p ? '#fff' : colors.textSecondary }]}>
                    {p === 'today' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!analytics ? (
            <Card style={{ alignItems: 'center', paddingVertical: space.xxxl }}>
              <ActivityIndicator color={colors.primary} />
            </Card>
          ) : (
            <>
              {/* Headline pair — the two numbers a busy owner checks first */}
              <View style={s.heroStats}>
                <Card style={StyleSheet.flatten([s.heroStat, { borderLeftColor: colors.primary }])}>
                  <Text style={[typography.label as any, { color: colors.textSecondary }]}>{pLabel.toUpperCase()} ORDERS</Text>
                  <AnimatedNumber value={periodOrders ?? 0}
                    style={[typography.display as any, { color: colors.text }]} />
                </Card>
                <Card style={StyleSheet.flatten([s.heroStat, { borderLeftColor: '#D4AF37' }])}>
                  <Text style={[typography.label as any, { color: colors.textSecondary }]}>{pLabel.toUpperCase()} REVENUE</Text>
                  <AnimatedNumber value={periodRevenue ?? 0} format={inr}
                    style={[typography.display as any, { color: colors.text }]} />
                </Card>
              </View>

              {/* Metric grid */}
              <View style={s.grid}>
                <Metric colors={colors} icon="wallet" tint={colors.warning} label="Pending Payout"
                  value={pendingPayout} format={inr} />
                <Metric colors={colors} icon="checkmark-done" tint={colors.success} label="Completed"
                  value={analytics.delivered_orders || 0} />
                <Metric colors={colors} icon="time" tint="#3b82f6" label="Avg Delivery"
                  value={analytics.avg_delivery_minutes} format={(n) => `${Math.round(n)}m`} />
                <Metric colors={colors} icon="star" tint="#D4AF37" label={`Rating (${analytics.reviews_count || 0})`}
                  value={analytics.rating ? Number(analytics.rating) : null} format={(n) => n.toFixed(1)} />
                <Metric colors={colors} icon="trending-up"
                  tint={(analytics.growth_pct || 0) >= 0 ? colors.success : colors.error} label="Weekly Growth"
                  value={analytics.growth_pct || 0}
                  format={(n) => `${n >= 0 ? '+' : ''}${Math.round(n)}%`} />
                <Metric colors={colors} icon="stats-chart" tint={colors.primary} label="Total Revenue"
                  value={analytics.total_revenue} format={inr} />
              </View>

              {/* 7-day revenue chart — gold bar marks the best day */}
              <Card style={{ marginTop: space.md }}>
                <Text style={[typography.bodyStrong as any, { color: colors.text, marginBottom: space.lg }]}>
                  Revenue · last 7 days
                </Text>
                <View style={s.chart}>
                  {(analytics.daily_revenue || []).map((d: any, i: number) => {
                    const seriesMax = Math.max(...(analytics.daily_revenue || []).map((x: any) => x.revenue), 1);
                    const h = Math.max(5, (d.revenue / seriesMax) * 92);
                    const isBest = d.revenue > 0 && d.revenue === seriesMax;
                    return (
                      <View key={i} style={s.barCol}>
                        <View style={[s.bar, {
                          height: h,
                          backgroundColor: isBest ? '#D4AF37' : d.revenue > 0 ? colors.primary : colors.surfaceLight,
                        }]} />
                        <Text style={[s.barDay, { color: isBest ? '#D4AF37' : colors.textMuted, fontWeight: isBest ? '800' : '500' }]}>
                          {d.day}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ colors, icon: ic, tint, label, value, format }: {
  colors: any; icon: any; tint: string; label: string;
  value: number | null | undefined; format?: (n: number) => string;
}) {
  return (
    <Card style={s.metric}>
      <View style={[s.metricIcon, { backgroundColor: tint + '16' }]}>
        <Ionicons name={ic} size={icon.sm} color={tint} />
      </View>
      <AnimatedNumber value={value} format={format}
        style={[typography.h2 as any, { color: colors.text, marginTop: space.sm }]} />
      <Text style={[typography.caption as any, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  hero: {
    paddingHorizontal: space.lg, paddingBottom: space.xl,
    borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  verifyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
  },
  verifyText: { fontSize: 11, fontWeight: '800' },
  heroStatusCaption: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  togglePill: {
    alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.lg,
  },
  toggleLabel: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dotWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  dotPulse: { position: 'absolute', width: 18, height: 18, borderRadius: 9 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  actionCard: {
    width: '30.5%', alignItems: 'center', gap: space.sm,
    borderRadius: radius.lg, paddingVertical: space.lg,
  },
  actionIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  analyticsHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: space.xxl, marginBottom: space.md,
  },
  periodRow: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, gap: 2 },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  periodText: { fontSize: 11, fontWeight: '800' },
  heroStats: { flexDirection: 'row', gap: space.md },
  heroStat: { flex: 1, borderLeftWidth: 3, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  metric: { width: '47.8%', paddingVertical: space.lg },
  metricIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 112 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: '52%', borderRadius: 5, minHeight: 5 },
  barDay: { fontSize: 10 },
});

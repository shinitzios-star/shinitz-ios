// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Rider — Home dashboard.
// Structure/hierarchy inspired by leading rider apps, rebuilt in SHINITZ's own
// green/gold identity. Wired to real data where it exists (online toggle, SOS,
// today's stats, profile); incentive milestones / content / messages are
// presentation placeholders until their backends land (UI-first phase).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, icon, typography, elevation, gradients, hitSlop } from '../../src/constants/designSystem';
import { Card, SectionTitle } from '../../src/components/ui';
import { BackgroundAlertSetup } from '../../src/components/BackgroundAlertSetup';
import { SelfieVerification } from '../../src/components/SelfieVerification';
import { ensureLocationAccess } from '../../src/delivery/locationConsent';
import { deliveryAPI, authAPI } from '../../src/services/api';

const { width } = Dimensions.get('window');

// Placeholder incentive milestones (UI-first — replace with /delivery/incentive).
const MILESTONES = [
  { amount: 365, trips: 23 },
  { amount: 430, trips: 27 },
  { amount: 510, trips: 31 },
  { amount: 615, trips: 36 },
];

export default function RiderHome() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meRes, statsRes] = await Promise.allSettled([authAPI.getMe(), deliveryAPI.getStats()]);
      if (meRes.status === 'fulfilled') {
        const u = meRes.value.data;
        setMe(u);
        setOnline(!!u?.is_online);
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleOnline = async () => {
    if (toggling) return;
    const next = !online;
    setToggling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Going online is where location starts to matter: the prominent
    // disclosure and the permission requests happen here, BEFORE the switch
    // flips (so the screen doesn't claim "online" behind the disclosure). The
    // rider can still go online if they decline — they just won't be matched
    // to nearby orders until location is on.
    if (next) await ensureLocationAccess({ background: true, mode: 'explicit' });
    setOnline(next); // optimistic
    try {
      await deliveryAPI.toggleStatus(next);
      if (next) router.push('/(delivery)/available');
    } catch (e: any) {
      setOnline(!next); // revert
      // 428 = daily identity selfie required BEFORE going online — open the
      // verification flow; on success it retries going online automatically.
      if (next && e?.response?.status === 428) {
        setShowSelfie(true);
      } else {
        Alert.alert('Could not update status', e?.response?.data?.detail || 'Please try again.');
      }
    } finally {
      setToggling(false);
    }
  };

  // Selfie verified → go online for real this time.
  const [showSelfie, setShowSelfie] = useState(false);
  const onSelfieVerified = async () => {
    setShowSelfie(false);
    try {
      await deliveryAPI.toggleStatus(true);
      setOnline(true);
      router.push('/(delivery)/available');
    } catch (e: any) {
      Alert.alert('Could not go online', e?.response?.data?.detail || 'Please try again.');
    }
  };

  const triggerSOS = () => {
    Alert.alert('Emergency SOS', 'Send an emergency alert with your live location to the SHINITZ safety team?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send SOS', style: 'destructive',
        onPress: async () => {
          try {
            let lat, lng;
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const pos = await Location.getCurrentPositionAsync({});
              lat = pos.coords.latitude; lng = pos.coords.longitude;
            }
            await deliveryAPI.sos(lat, lng);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert('SOS sent', 'Our safety team has been alerted and will contact you.');
          } catch {
            Alert.alert('SOS failed', 'Could not send the alert. Call support directly if this is an emergency.');
          }
        },
      },
    ]);
  };

  const s = makeStyles(colors);
  const trips = stats?.completed_deliveries ?? 0;
  const earnings = stats?.total_earnings ?? 0;
  const orders = stats?.completed_deliveries ?? 0;
  const firstName = (me?.name || 'Partner').split(' ')[0];

  if (loading) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {/* ── Hero header ── */}
      <LinearGradient colors={gradients.heroWarm as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + space.sm }]}>
        <View style={s.heroRow}>
          {/* Online / Offline toggle */}
          <TouchableOpacity activeOpacity={0.85} onPress={toggleOnline} disabled={toggling}
            style={[s.togglePill, { backgroundColor: online ? colors.success : 'rgba(0,0,0,0.35)' }]}>
            {toggling ? <ActivityIndicator size="small" color="#fff" />
              : <View style={[s.toggleDot, { backgroundColor: online ? '#fff' : '#cbd5d1', alignSelf: online ? 'flex-end' : 'flex-start' }]} />}
            <Text style={s.toggleText}>{online ? 'Online' : 'Offline'}</Text>
          </TouchableOpacity>

          <View style={s.heroActions}>
            <TouchableOpacity style={s.circleBtn} onPress={() => router.push('/(delivery)/profile')} hitSlop={hitSlop}>
              <Ionicons name="headset" size={16} color={colors.primaryDark} />
              <Text style={s.circleBtnText}>Help</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.circleBtn} onPress={triggerSOS} hitSlop={hitSlop}>
              <MaterialCommunityIcons name="shield-alert" size={16} color={colors.error} />
              <Text style={[s.circleBtnText, { color: colors.error }]}>SOS</Text>
            </TouchableOpacity>
            <TierBadge colors={colors} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        {/* Alert-readiness prompt (notification permission + battery optimization).
            Home is the INITIAL tab — tabs lazy-mount, so a rider who never opens
            Available would otherwise never be asked, and killed-app buzzers
            would silently stay broken on their device. Renders null once set up. */}
        <BackgroundAlertSetup />

        {/* ── Start earning / booking CTA ── */}
        <View style={s.section}>
          <Text style={[typography.h1 as any, { color: colors.text }]}>Start earning,{'\n'}{firstName}!</Text>
          <Text style={[typography.body as any, { color: colors.textSecondary, marginTop: 4 }]}>
            {online ? "You're online — offers will appear shortly" : 'Book a shift and go online to start'}
          </Text>
          <TouchableOpacity activeOpacity={0.9} onPress={toggleOnline} style={{ marginTop: space.lg }}>
            <LinearGradient colors={online ? [colors.success, colors.successDark] as any : gradients.hero as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
              <Text style={s.ctaText}>{online ? 'You are Online' : 'Go Online'}</Text>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Refer strip ── */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(delivery)/refer')} style={s.section}>
          <Card style={s.referStrip} level={1}>
            <MaterialCommunityIcons name="gift-outline" size={22} color={colors.primary} />
            <Text style={[typography.bodyStrong as any, { color: colors.text, flex: 1, marginLeft: space.md }]}>Refer a Friend & Earn</Text>
            <View style={s.amountChip}><Text style={s.amountChipText}>upto ₹20,000</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </TouchableOpacity>

        {/* ── Content slider ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }} style={{ marginBottom: space.sm }}>
          {[
            { t: 'Extra Earnings in Rain', c: gradients.hero, ic: 'weather-pouring' },
            { t: 'Refer & Earn Program', c: ['#123f2e', '#1c6b4a'], ic: 'account-multiple-plus' },
            { t: 'Your SHINITZ Journey', c: ['#6b4a12', '#b8952e'], ic: 'star-four-points' },
          ].map((b, i) => (
            <View key={i} style={s.slide}>
              <LinearGradient colors={b.c as any} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <MaterialCommunityIcons name={b.ic as any} size={30} color="rgba(255,255,255,0.9)" />
              <Text style={s.slideText}>{b.t}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── Daily Incentive tracker ── */}
        <View style={s.section}>
          <Card padded={false} level={2}>
            <View style={s.incHeader}>
              <View>
                <Text style={[typography.h2 as any, { color: colors.text }]}>Daily Incentive</Text>
                <Text style={[typography.caption as any, { color: colors.textSecondary }]}>Earn upto ₹{MILESTONES[MILESTONES.length - 1].amount} extra</Text>
              </View>
              <View style={[s.roundArrow, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="chevron-forward" size={18} color={colors.accentDark} />
              </View>
            </View>
            <IncentiveTrack colors={colors} milestones={MILESTONES} trips={trips} />
            <View style={{ padding: space.lg, paddingTop: space.md }}>
              <Text style={[typography.body as any, { color: colors.text, marginBottom: space.md }]}>Your trips today: <Text style={{ fontWeight: '800' }}>{trips}</Text></Text>
              <TouchableOpacity style={[s.softBtn, { backgroundColor: colors.accentLight }]} onPress={() => router.push('/(delivery)/earnings')}>
                <Text style={[s.softBtnText, { color: colors.primaryDark }]}>See all offers</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* ── Today's progress ── */}
        <View style={s.section}>
          <Card level={1}>
            <SectionTitle>Today's Progress</SectionTitle>
            <View style={s.progressRow}>
              <Progress colors={colors} icon="cash" label="Earnings" value={`₹${earnings}`} />
              <View style={s.vLine} />
              <Progress colors={colors} icon="time-outline" label="Online time" value="0h 0m" />
              <View style={s.vLine} />
              <Progress colors={colors} icon="bag-handle-outline" label="Orders" value={`${orders}`} />
            </View>
          </Card>
        </View>

        {/* ── Shortcut cards (2×2) ── */}
        <View style={[s.section, s.grid]}>
          <BigShortcut colors={colors} title="Benefits & Loans" ic="hand-coin" onPress={() => router.push('/(delivery)/profile')} />
          <BigShortcut colors={colors} title="Refer & Earn" ic="cash-multiple" badge="₹20,000" onPress={() => router.push('/(delivery)/refer')} />
          <BigShortcut colors={colors} title="Rent an EV" ic="motorbike-electric" onPress={() => router.push('/(delivery)/profile')} />
          <BigShortcut colors={colors} title="SHINITZ Store" ic="storefront-outline" onPress={() => router.push('/(delivery)/profile')} />
        </View>

        {/* ── Small shortcuts ── */}
        <View style={s.section}>
          <SectionTitle>Shortcuts</SectionTitle>
          <View style={s.smallRow}>
            <SmallShortcut colors={colors} title="Offers" ic="tag-outline" onPress={() => router.push('/(delivery)/earnings')} />
            <SmallShortcut colors={colors} title="My Zone" ic="map-marker-radius" onPress={() => router.push('/(delivery)/available')} />
            <SmallShortcut colors={colors} title="Insurance" ic="shield-plus" onPress={() => router.push('/(delivery)/profile')} />
          </View>
        </View>

        {/* ── Important messages ── */}
        <View style={s.section}>
          <Card level={1}>
            <SectionTitle>Important Messages</SectionTitle>
            {[
              { t: 'Welcome to SHINITZ, Partner!', d: 'Complete deliveries to unlock daily incentives.' },
              { t: 'Keep your documents updated', d: 'Verified partners get priority order offers.' },
            ].map((m, i) => (
              <View key={i} style={[s.msgRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={[s.msgIcon, { backgroundColor: colors.accentLight }]}>
                  <Ionicons name="megaphone-outline" size={18} color={colors.accentDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong as any, { color: colors.text }]}>{m.t}</Text>
                  <Text style={[typography.caption as any, { color: colors.textSecondary }]}>{m.d}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>

      {/* Daily identity selfie — opened when the server answers 428 on go-online */}
      <SelfieVerification
        visible={showSelfie}
        onVerified={onSelfieVerified}
        onClose={() => setShowSelfie(false)}
      />
    </View>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────
function TierBadge({ colors }: any) {
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient colors={gradients.gold as any} style={tb.circle}>
        <MaterialCommunityIcons name="star-four-points" size={22} color="#fff" />
      </LinearGradient>
      <View style={[tb.label, { backgroundColor: colors.primaryDark }]}>
        <Text style={tb.labelText}>Hero</Text>
      </View>
    </View>
  );
}

function IncentiveTrack({ colors, milestones, trips }: any) {
  const maxTrips = milestones[milestones.length - 1].trips;
  const pct = Math.max(0.04, Math.min(1, trips / maxTrips));
  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: colors.surfaceLight }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: space.sm }}>
        {milestones.map((m: any) => (
          <Text key={m.amount} style={[typography.bodyStrong as any, { color: colors.text }]}>₹{m.amount}</Text>
        ))}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.success }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: space.sm }}>
        {milestones.map((m: any) => (
          <View key={m.amount} style={{ alignItems: 'center' }}>
            <Ionicons name={trips >= m.trips ? 'checkmark-circle' : 'lock-closed'} size={16}
              color={trips >= m.trips ? colors.success : colors.textMuted} />
            <Text style={[typography.caption as any, { color: colors.textSecondary }]}>{m.trips}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Progress({ colors, icon: ic, label, value }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[typography.h2 as any, { color: colors.text }]}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <Ionicons name={ic} size={13} color={colors.textMuted} />
        <Text style={[typography.caption as any, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

function BigShortcut({ colors, title, ic, badge, onPress }: any) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ width: (width - space.lg * 2 - space.md) / 2 }}>
      <Card style={{ minHeight: 116, justifyContent: 'space-between' }}>
        <Text style={[typography.h3 as any, { color: colors.text }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {badge ? <View style={{ backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{badge}</Text></View> : <View />}
          <MaterialCommunityIcons name={ic} size={30} color={colors.accent} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function SmallShortcut({ colors, title, ic, onPress }: any) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <MaterialCommunityIcons name={ic} size={26} color={colors.primary} />
        <Text style={[typography.caption as any, { color: colors.text, fontWeight: '700', marginTop: 6 }]}>{title}</Text>
      </Card>
    </TouchableOpacity>
  );
}

const tb = StyleSheet.create({
  circle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  label: { marginTop: -8, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  labelText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

const makeStyles = (colors: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: space.lg, paddingBottom: space.lg, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  togglePill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 8, minWidth: 116 },
  toggleDot: { width: 22, height: 22, borderRadius: 11 },
  toggleText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  circleBtn: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', flexDirection: 'row', gap: 4, ...elevation(1) },
  circleBtnText: { fontSize: 12, fontWeight: '800', color: '#1a1a2e' },
  section: { paddingHorizontal: space.lg, marginBottom: space.lg },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18, borderRadius: radius.lg, ...elevation(2) },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  referStrip: { flexDirection: 'row', alignItems: 'center' },
  amountChip: { backgroundColor: 'rgba(212,175,55,0.16)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  amountChipText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  slide: { width: width * 0.72, height: 132, borderRadius: radius.lg, overflow: 'hidden', padding: space.lg, justifyContent: 'flex-end', ...elevation(1) },
  slideText: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6 },
  incHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, paddingBottom: space.md },
  roundArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  softBtn: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  softBtnText: { fontSize: 15, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  vLine: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  smallRow: { flexDirection: 'row', gap: space.md },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  msgIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

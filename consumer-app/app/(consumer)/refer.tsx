import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { referralAPI } from '../../src/services/api';

interface Invitee {
  name?: string;
  phone?: string;
  status: 'pending' | 'rewarded';
  reward_amount?: number;
  created_at?: string;
  rewarded_at?: string;
}

interface ReferralData {
  code: string;
  enabled: boolean;
  reward_amount: number;
  invited: number;
  rewarded: number;
  pending: number;
  balance: number;
  invitees: Invitee[];
  history: any[];
}

export default function ReferScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await referralAPI.me();
      setData(res.data);
    } catch (e) {
      if (__DEV__) console.warn('referral load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reward = data?.reward_amount ?? 50;
  const code = data?.code ?? '';

  const onShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message:
          `Join me on Shinitz! 🛵 Order fresh food & groceries delivered fast.\n\n` +
          `Use my referral code *${code}* when you sign up.\n\n` +
          `Download: https://shinitz.com`,
      });
    } catch {
      showToast({ type: 'error', message: 'Could not open share sheet' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Hero */}
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIcon}>
              <Ionicons name="gift" size={30} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Earn ₹{reward.toFixed(0)} per friend</Text>
            <Text style={styles.heroSub}>
              Share your code. When a friend places their first order, you get ₹{reward.toFixed(0)}.
            </Text>

            {/* Code box */}
            <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={styles.codeBox}>
              <Text style={styles.codeText}>{code || '— — — —'}</Text>
              <View style={styles.codeShare}>
                <Ionicons name="share-social" size={16} color={colors.primary} />
                <Text style={styles.codeShareText}>Share</Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{data?.invited ?? 0}</Text>
              <Text style={styles.statLabel}>Invited</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{data?.rewarded ?? 0}</Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.success }]}>₹{(data?.balance ?? 0).toFixed(0)}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </View>

          {/* How it works */}
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <View style={styles.stepsCard}>
            <Step n="1" icon="share-social-outline" text="Share your code with friends" colors={colors} styles={styles} />
            <Step n="2" icon="person-add-outline" text="They sign up using your code" colors={colors} styles={styles} />
            <Step n="3" icon="cash-outline" text={`You earn ₹${reward.toFixed(0)} on their first order`} last colors={colors} styles={styles} />
          </View>

          {/* Invitees */}
          <Text style={styles.sectionLabel}>YOUR INVITES</Text>
          {(data?.invitees?.length ?? 0) === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No invites yet</Text>
              <Text style={styles.emptySub}>Share your code to start earning</Text>
            </View>
          ) : (
            <View style={styles.inviteList}>
              {data!.invitees.map((inv, i) => (
                <View key={i} style={[styles.inviteRow, i === data!.invitees.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.inviteAvatar}>
                    <Text style={styles.inviteInitial}>
                      {(inv.name || 'F').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteName} numberOfLines={1}>{inv.name || 'Friend'}</Text>
                    <Text style={styles.invitePhone}>{inv.phone || ''}</Text>
                  </View>
                  {inv.status === 'rewarded' ? (
                    <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={[styles.badgeText, { color: colors.success }]}>+₹{(inv.reward_amount ?? reward).toFixed(0)}</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: colors.warning + '20' }]}>
                      <Ionicons name="time-outline" size={13} color={colors.warning} />
                      <Text style={[styles.badgeText, { color: colors.warning }]}>Pending</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <Text style={styles.fineprint}>
            Rewards are credited after your friend completes their first order. One reward per friend.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Step({ n, icon, text, last, colors, styles }: any) {
  return (
    <View style={[styles.step, !last && styles.stepBorder]}>
      <View style={styles.stepIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.stepText}>{text}</Text>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },

  hero: {
    borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center',
    marginTop: SPACING.sm, ...SHADOWS.md,
  },
  heroIcon: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  heroTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: '#fff', textAlign: 'center' },
  heroSub: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: 4, lineHeight: 20, paddingHorizontal: SPACING.sm },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg, marginTop: SPACING.lg, alignSelf: 'stretch',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)',
  },
  codeText: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: '#1a1a1a', letterSpacing: 3 },
  codeShare: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeShareText: { color: colors.primary, fontWeight: '800', fontSize: FONTS.sizes.sm },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },

  sectionLabel: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 1, marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  stepsCard: {
    backgroundColor: colors.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: colors.border,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  stepIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  stepText: { flex: 1, fontSize: FONTS.sizes.md, color: colors.text, fontWeight: '500' },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  empty: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text, marginTop: SPACING.sm },
  emptySub: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 2 },

  inviteList: {
    backgroundColor: colors.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: colors.border,
  },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  inviteAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  inviteInitial: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.primary },
  inviteName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text },
  invitePhone: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '800' },

  fineprint: { fontSize: FONTS.sizes.xs, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.lg, lineHeight: 16, paddingHorizontal: SPACING.md },
});

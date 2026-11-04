// SHINITZ Rider — Refer & Earn. Wired to referralAPI.me() (code + stats); falls
// back gracefully when the endpoint has no data yet.
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { Card, SectionTitle } from '../../src/components/ui';
import { referralAPI } from '../../src/services/api';

export default function ReferScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await referralAPI.me(); setData(r.data); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const code = data?.code || data?.referral_code || '—';
  const reward = data?.reward_text || 'upto ₹20,000';
  const referred = data?.referred_count ?? data?.total_referrals ?? 0;
  const earned = data?.total_earned ?? 0;

  const share = async () => {
    try {
      await Share.share({ message: `Join SHINITZ as a delivery partner and earn! Use my code ${code} to sign up.` });
    } catch { /* dismissed */ }
  };

  const s = makeStyles(colors);
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}><Text style={[typography.h1 as any, { color: colors.text }]}>Refer & Earn</Text></View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.hero as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
            <MaterialCommunityIcons name="gift-outline" size={30} color="#fff" />
            <Text style={s.bannerTitle}>Invite friends, earn {reward}</Text>
            <Text style={s.bannerSub}>They get onboarded, you get rewarded for every partner who joins.</Text>
          </LinearGradient>

          <Card style={{ marginTop: space.lg, alignItems: 'center' }} level={2}>
            <Text style={[typography.caption as any, { color: colors.textSecondary }]}>YOUR REFERRAL CODE</Text>
            <Text style={[typography.display as any, { color: colors.primary, letterSpacing: 2, marginVertical: 6 }]}>{code}</Text>
            <TouchableOpacity onPress={share} style={[s.btn, { backgroundColor: colors.primary, marginTop: space.sm, paddingHorizontal: 32 }]}>
              <Ionicons name="share-social" size={18} color="#fff" /><Text style={[s.btnText, { color: '#fff' }]}>Share your code</Text>
            </TouchableOpacity>
          </Card>

          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
            <Card style={{ flex: 1, alignItems: 'center' }}><Text style={[typography.h1 as any, { color: colors.text }]}>{referred}</Text><Text style={[typography.caption as any, { color: colors.textSecondary }]}>Friends joined</Text></Card>
            <Card style={{ flex: 1, alignItems: 'center' }}><Text style={[typography.h1 as any, { color: colors.text }]}>₹{earned}</Text><Text style={[typography.caption as any, { color: colors.textSecondary }]}>Total earned</Text></Card>
          </View>

          <View style={{ marginTop: space.xl }}>
            <SectionTitle>How it works</SectionTitle>
            {['Share your code with a friend', 'They sign up & complete onboarding', 'You both earn rewards'].map((t, i) => (
              <View key={i} style={s.step}>
                <View style={[s.stepNum, { backgroundColor: colors.accentLight }]}><Text style={{ color: colors.primaryDark, fontWeight: '800' }}>{i + 1}</Text></View>
                <Text style={[typography.body as any, { color: colors.text, flex: 1 }]}>{t}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: space.lg, paddingVertical: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: radius.xl, padding: space.xl, ...elevation(2) },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: space.sm },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  btnText: { fontWeight: '800', fontSize: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  stepNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

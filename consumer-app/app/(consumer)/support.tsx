import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supportAPI } from '../../src/services/api';

type SupportConfig = {
  phones: string[];
  whatsapp: string;
  email: string;
  emergency_phone: string;
};

const FALLBACK: SupportConfig = {
  phones: ['9971500988', '8700871677'],
  whatsapp: '919971500988',
  email: 'support@shinitz.com',
  emergency_phone: '9971500988',
};

export default function SupportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cfg, setCfg] = useState<SupportConfig>(FALLBACK);

  useEffect(() => {
    supportAPI.getConfig()
      .then((r) => setCfg({ ...FALLBACK, ...(r.data || {}) }))
      .catch(() => { /* keep fallback */ });
  }, []);

  // Log the contact attempt (best-effort) then open the channel.
  const open = async (
    channel: 'call' | 'whatsapp' | 'email' | 'live_chat' | 'emergency',
    url: string,
    detail?: string,
  ) => {
    supportAPI.contact({ channel, detail }).catch(() => {});
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) { Alert.alert('Unavailable', 'No app available to handle this action.'); return; }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open this option. Please try another.');
    }
  };

  const callRow = (phone: string) => (
    <TouchableOpacity key={phone} style={styles.row} activeOpacity={0.7}
      onPress={() => open('call', `tel:${phone}`, phone)}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primary + '18' }]}>
        <Ionicons name="call" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>Call Support</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>+91 {phone}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Emergency — prominent */}
        <TouchableOpacity activeOpacity={0.9}
          onPress={() => open('emergency', `tel:${cfg.emergency_phone}`, 'emergency order assistance')}>
          <LinearGradient colors={['#e53935', '#b71c1c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emergency}>
            <View style={styles.emergencyIcon}>
              <Ionicons name="alert-circle" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>Emergency Order Assistance</Text>
              <Text style={styles.emergencySub}>Urgent help with an active order — tap to call now</Text>
            </View>
            <Ionicons name="call" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>TALK TO US</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {cfg.phones.map(callRow)}

          <TouchableOpacity style={styles.row} activeOpacity={0.7}
            onPress={() => open('whatsapp', `https://wa.me/${cfg.whatsapp}`, 'whatsapp support')}>
            <View style={[styles.rowIcon, { backgroundColor: '#25D36618' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>WhatsApp Support</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Chat with us on WhatsApp</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} activeOpacity={0.7}
            onPress={() => { supportAPI.contact({ channel: 'live_chat' }).catch(() => {}); router.push('/(consumer)/chat'); }}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Live Chat Support</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Message our support team in-app</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.row, styles.rowLast]} activeOpacity={0.7}
            onPress={() => open('email', `mailto:${cfg.email}`, cfg.email)}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="mail" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Email Support</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{cfg.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Support is available 9 AM – 11 PM. For order emergencies, use the red button above.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  body: { padding: SPACING.lg, paddingTop: SPACING.sm },
  emergency: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.md },
  emergencyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  emergencyTitle: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '900' },
  emergencySub: { color: 'rgba(255,255,255,0.9)', fontSize: FONTS.sizes.xs, marginTop: 2 },
  groupLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 1, marginBottom: SPACING.sm, marginLeft: SPACING.xs },
  group: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  rowSub: { fontSize: FONTS.sizes.xs, marginTop: 2 },
  hint: { fontSize: FONTS.sizes.xs, textAlign: 'center', marginTop: SPACING.lg, paddingHorizontal: SPACING.lg, lineHeight: 18 },
});

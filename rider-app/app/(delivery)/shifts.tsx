// SHINITZ Rider — My Shifts. UI-first shell (booking + upcoming/past) ready for
// the shift-management backend; no fake data is shown as if it were real.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation, gradients } from '../../src/constants/designSystem';
import { Card } from '../../src/components/ui';

const TABS = ['Upcoming', 'Past'] as const;

export default function ShiftsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Upcoming');
  const s = makeStyles(colors);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}><Text style={[typography.h1 as any, { color: colors.text }]}>My Shifts</Text></View>

      <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(delivery)/home')} style={{ paddingHorizontal: space.lg }}>
        <LinearGradient colors={gradients.hero as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.book}>
          <View style={{ flex: 1 }}>
            <Text style={s.bookTitle}>Book a shift</Text>
            <Text style={s.bookSub}>Reserve a slot and go online to start earning</Text>
          </View>
          <Ionicons name="calendar" size={26} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tab, tab === t && { backgroundColor: colors.primary }]}>
            <Text style={[s.tabText, { color: tab === t ? '#fff' : colors.textSecondary }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Card style={{ alignItems: 'center', paddingVertical: space.xxxl }}>
          <MaterialCommunityIcons name={tab === 'Upcoming' ? 'calendar-clock' : 'history'} size={44} color={colors.textMuted} />
          <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.md }]}>
            {tab === 'Upcoming' ? 'No upcoming shifts' : 'No past shifts'}
          </Text>
          <Text style={[typography.caption as any, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: space.lg }]}>
            {tab === 'Upcoming' ? 'Book a shift above to reserve your earning slots.' : 'Your completed shifts will appear here.'}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: space.lg, paddingVertical: space.md },
  book: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: space.xl, ...elevation(2) },
  bookTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bookSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceLight },
  tabText: { fontWeight: '700', fontSize: 14 },
});

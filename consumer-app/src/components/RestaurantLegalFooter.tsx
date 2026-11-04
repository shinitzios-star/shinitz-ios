import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, FONTS } from '../constants/theme';
import api from '../services/api';
import {
  DaySchedule, Availability, WEEK, timingStatus, dayHours, istDayKey,
} from '../utils/restaurantTiming';

/**
 * Legal / compliance footer for a restaurant's menu screen — mirrors the
 * website's section so both surfaces show the same statutory information.
 *
 * Everything is fetched per-restaurant from /restaurants/{id}/info; nothing is
 * hard-coded. Rows without data are omitted rather than rendering an empty
 * label, and the block hides entirely when a restaurant has no compliance data
 * on file yet.
 */

const DISCLAIMERS = [
  'All prices are set directly by the restaurant.',
  'All nutritional information is indicative, values are per serve as shared by the restaurant and may vary depending on the ingredients and portion size.',
  'An average active adult requires 2,000 kcal energy per day, however, calorie needs may vary.',
];

interface Info {
  name?: string | null;
  locality?: string | null;
  address?: string | null;
  fssai_number?: string | null;
  // Operating hours, resolved by the backend from what the admin saved.
  availability?: Availability | null;
  weekly_hours?: Record<string, DaySchedule> | null;
}

export default function RestaurantLegalFooter({
  storeId, fallbackName, info: infoProp,
}: {
  storeId: string;
  fallbackName?: string;
  /** The screen's own /restaurants/{id}/info (refreshed on focus / pull-to-refresh).
   *  When omitted the footer fetches it itself. */
  info?: Info | null;
}) {
  const { colors } = useTheme();
  const [fetched, setFetched] = useState<Info | null>(null);
  const [showWeek, setShowWeek] = useState(false);

  useEffect(() => {
    if (!storeId || infoProp !== undefined) return;
    let alive = true;
    api.get(`/restaurants/${encodeURIComponent(storeId)}/info`)
      .then((r) => { if (alive) setFetched(r.data); })
      .catch(() => { /* non-critical section — fail quietly */ });
    return () => { alive = false; };
  }, [storeId, infoProp]);

  const info = infoProp !== undefined ? infoProp : fetched;
  const name = info?.name || fallbackName;
  const hasCompliance = !!(info?.fssai_number || info?.address);
  const avail = info?.availability;
  const timing = timingStatus(avail);
  // Today's slots ("10:00 AM – 3:00 PM, 6:00 PM – 11:00 PM") — only when real
  // hours are saved, and not for a restaurant that is switched off.
  const todayLine = avail?.has_schedule && avail.state !== 'offline' && avail.today_hours
    && avail.today_hours !== 'Open 24 hours' ? avail.today_hours : null;
  const week = info?.weekly_hours && Object.keys(info.weekly_hours).length ? info.weekly_hours : null;
  if (!name && !hasCompliance && !timing) return null;
  const toneColor = timing?.tone === 'open' ? (colors.success || '#16A34A')
    : timing?.tone === 'closed' ? '#DC2626' : colors.textMuted;
  const today = istDayKey();

  return (
    <View style={[styles.wrap, { borderTopColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Disclaimer</Text>
      {DISCLAIMERS.map((d) => (
        <View key={d} style={styles.bulletRow}>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.bullet, { color: colors.textSecondary }]}>{d}</Text>
        </View>
      ))}

      {!!info?.fssai_number && (
        <View style={[styles.fssaiRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.fssaiMark, { color: colors.textMuted }]}>fssai</Text>
          <Text style={[styles.fssaiNo, { color: colors.textSecondary }]}>
            License No. <Text style={{ color: colors.text }}>{info.fssai_number}</Text>
          </Text>
        </View>
      )}

      {(!!name || !!info?.address) && (
        <View style={[styles.addrBlock, !info?.fssai_number && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.md }]}>
          {!!name && <Text style={[styles.name, { color: colors.text }]}>{name}</Text>}
          {!!info?.locality && <Text style={[styles.locality, { color: colors.textMuted }]}>{info.locality}</Text>}
          {!!info?.address && (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
              <Text style={[styles.addr, { color: colors.textSecondary }]}>{info.address}</Text>
            </View>
          )}
        </View>
      )}

      {/* Operating hours — from the timings saved in the admin panel. */}
      {!!timing && (
        <View style={styles.timeBlock}>
          <View style={styles.addrRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={[styles.addr, { color: colors.textSecondary }]}>
              <Text style={{ color: toneColor, fontWeight: '700' }}>{timing.title}</Text>
              {timing.detail ? ` · ${timing.detail}` : ''}
            </Text>
          </View>
          {!!todayLine && (
            <Text style={[styles.timeSub, { color: colors.textMuted }]}>Today: {todayLine}</Text>
          )}
          {!!week && (
            <TouchableOpacity onPress={() => setShowWeek((v) => !v)} hitSlop={8} activeOpacity={0.7}
              accessibilityRole="button" accessibilityState={{ expanded: showWeek }}>
              <Text style={[styles.timeToggle, { color: colors.primary }]}>
                {showWeek ? 'Hide timings' : 'See all timings'}
              </Text>
            </TouchableOpacity>
          )}
          {!!week && showWeek && (
            <View style={styles.weekList}>
              {WEEK.map(([key, label]) => (
                <View key={key} style={styles.weekRow}>
                  <Text style={[styles.weekDay, { color: key === today ? colors.text : colors.textSecondary },
                    key === today && { fontWeight: '700' }]}>{label}</Text>
                  <Text style={[styles.weekHours, { color: key === today ? colors.text : colors.textSecondary },
                    key === today && { fontWeight: '700' }]}>{dayHours(week[key])}</Text>
                </View>
              ))}
              <Text style={[styles.weekNote, { color: colors.textMuted }]}>Times are in IST.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    marginTop: SPACING.lg,
  },
  heading: { fontSize: FONTS.sizes.lg, fontWeight: '700', marginBottom: SPACING.sm },
  bulletRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xs },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginTop: 8 },
  bullet: { flex: 1, fontSize: FONTS.sizes.sm, lineHeight: 19 },
  fssaiRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.lg, paddingTop: SPACING.md,
  },
  fssaiMark: { fontSize: 22, fontStyle: 'italic', fontWeight: '600', letterSpacing: -0.5 },
  fssaiNo: { fontSize: FONTS.sizes.sm },
  addrBlock: { marginTop: SPACING.md },
  name: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  locality: { fontSize: FONTS.sizes.sm, marginTop: 1 },
  addrRow: { flexDirection: 'row', gap: 6, marginTop: SPACING.sm },
  addr: { flex: 1, fontSize: FONTS.sizes.sm, lineHeight: 19 },
  timeBlock: { marginTop: SPACING.xs },
  timeSub: { fontSize: FONTS.sizes.xs, lineHeight: 17, marginTop: 4, marginLeft: 20 },
  timeToggle: { fontSize: FONTS.sizes.sm, fontWeight: '700', marginTop: SPACING.sm, marginLeft: 20 },
  weekList: { marginTop: SPACING.sm, marginLeft: 20 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 3 },
  weekDay: { fontSize: FONTS.sizes.sm, width: 92 },
  weekHours: { flex: 1, fontSize: FONTS.sizes.sm, textAlign: 'right' },
  weekNote: { fontSize: FONTS.sizes.xs, marginTop: 4 },
});

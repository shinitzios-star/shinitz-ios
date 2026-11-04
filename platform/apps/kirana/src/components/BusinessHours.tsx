/**
 * BusinessHours — restaurant / kirana shift editor.
 *
 * Owners add one or more daily shifts (open + close, IST, HH:MM). The store
 * auto-shows Open/Closed to customers based on these; no shifts = always open.
 * Used on the store dashboard.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { Card } from './Card';
import { storeAPI } from '../services/api';

interface Shift { open: string; close: string; }

// Mask free text into HH:MM as the user types.
function maskTime(t: string): string {
  const d = t.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}
function validTime(t: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return false;
  const h = +m[1], mi = +m[2];
  return h >= 0 && h < 24 && mi >= 0 && mi < 60;
}

export function BusinessHours() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [status, setStatus] = useState<{ open: boolean; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await storeAPI.getShifts();
      setShifts(res.data?.shifts || []);
      setStatus({ open: res.data?.open, label: res.data?.label });
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addShift = () => { setShifts((s) => [...s, { open: '09:00', close: '22:00' }]); setDirty(true); };
  const removeShift = (i: number) => { setShifts((s) => s.filter((_, idx) => idx !== i)); setDirty(true); };
  const editShift = (i: number, key: 'open' | 'close', val: string) => {
    setShifts((s) => s.map((sh, idx) => (idx === i ? { ...sh, [key]: maskTime(val) } : sh)));
    setDirty(true);
  };

  const save = async () => {
    for (const s of shifts) {
      if (!validTime(s.open) || !validTime(s.close)) {
        Alert.alert('Check times', 'Each shift needs a valid open and close time (HH:MM).');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await storeAPI.setShifts(shifts);
      setShifts(res.data?.shifts || []);
      setStatus({ open: res.data?.open, label: res.data?.label });
      setDirty(false);
      Alert.alert('Saved', 'Your business hours are updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not save hours.');
    } finally { setSaving(false); }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Ionicons name="time-outline" size={20} color={COLORS.primary} />
          <Text style={styles.title}>Business Hours</Text>
        </View>
        {status && (
          <View style={[styles.statusPill, { backgroundColor: (status.open ? COLORS.success : COLORS.error) + '20' }]}>
            <View style={[styles.dot, { backgroundColor: status.open ? COLORS.success : COLORS.error }]} />
            <Text style={[styles.statusText, { color: status.open ? COLORS.success : COLORS.error }]}>{status.label}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
      ) : (
        <>
          {shifts.length === 0 && (
            <Text style={styles.hint}>No shifts set — your store stays open 24/7. Add a shift to auto-close outside hours.</Text>
          )}
          {shifts.map((s, i) => (
            <View key={i} style={styles.shiftRow}>
              <Text style={styles.shiftLabel}>Shift {i + 1}</Text>
              <TextInput style={styles.timeInput} value={s.open} onChangeText={(t) => editShift(i, 'open', t)}
                keyboardType="number-pad" maxLength={5} placeholder="09:00" placeholderTextColor={COLORS.textMuted} />
              <Text style={styles.dash}>—</Text>
              <TextInput style={styles.timeInput} value={s.close} onChangeText={(t) => editShift(i, 'close', t)}
                keyboardType="number-pad" maxLength={5} placeholder="22:00" placeholderTextColor={COLORS.textMuted} />
              <TouchableOpacity onPress={() => removeShift(i)} hitSlop={8} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.addBtn} onPress={addShift}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addText}>Add shift</Text>
            </TouchableOpacity>
            {dirty && (
              <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Save hours</Text>}
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.tz}>Times are in IST (24-hour). Example: 09:00 — 14:00, 17:00 — 23:00.</Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACING.md, marginTop: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  title: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 17 },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  shiftLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, width: 56 },
  timeInput: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm, paddingVertical: 8, color: COLORS.text, fontSize: FONTS.sizes.md,
    fontWeight: '700', textAlign: 'center', minWidth: 70,
  },
  dash: { color: COLORS.textMuted },
  removeBtn: { marginLeft: 'auto' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
  addText: { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
  saveBtn: { marginLeft: 'auto', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: SPACING.lg },
  saveText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.sm },
  tz: { fontSize: 10, color: COLORS.textMuted, marginTop: SPACING.sm },
});

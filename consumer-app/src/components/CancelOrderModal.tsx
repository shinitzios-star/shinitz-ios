import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { cancellationAPI } from '../services/api';

interface Props {
  visible: boolean;
  orderId: string;
  onClose: () => void;
  onSubmitted: (result: { status: string; auto: boolean; message: string }) => void;
}

/** Mandatory cancellation-reason picker. "Other" requires a typed explanation. */
export function CancelOrderModal({ visible, orderId, onClose, onSubmitted }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true); setSelected(null); setCustom('');
    cancellationAPI.reasons()
      .then((r) => setReasons((r.data?.reasons || []).map((x: any) => x.reason_name)))
      .catch(() => setReasons([
        'Order taking too long to accept', 'Restaurant taking too long to prepare',
        'Delivery delayed', 'Wrong items ordered', 'Need to change order',
        'Missing items', 'Duplicate order placed', 'Found a better option', 'Other',
      ]))
      .finally(() => setLoading(false));
  }, [visible]);

  const isOther = (selected || '').toLowerCase() === 'other';
  const canSubmit = !!selected && (!isOther || custom.trim().length > 0) && !submitting;

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const r = await cancellationAPI.request(orderId, { reason: selected, custom_reason: custom.trim() });
      onSubmitted(r.data);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not submit', e.response?.data?.detail || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Select a cancellation reason</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {reasons.map((r) => {
                const active = selected === r;
                return (
                  <TouchableOpacity key={r} style={styles.row} activeOpacity={0.7} onPress={() => setSelected(r)}>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[styles.rowText, active && { color: colors.text, fontWeight: '700' }]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
              {isOther && (
                <TextInput
                  style={styles.input}
                  placeholder="Please describe your reason"
                  placeholderTextColor={colors.textMuted}
                  value={custom}
                  onChangeText={setCustom}
                  multiline
                  maxLength={500}
                />
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canSubmit ? colors.primary : colors.border }]}
            disabled={!canSubmit}
            onPress={submit}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Request</Text>}
          </TouchableOpacity>
          <Text style={styles.note}>Cancellations are reviewed by our team unless the order can't proceed (no acceptance / no rider / payment failed).</Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.text },
  loader: { paddingVertical: SPACING.xl, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, fontSize: FONTS.sizes.md, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md, color: colors.text, minHeight: 80, textAlignVertical: 'top', fontSize: FONTS.sizes.md },
  submitBtn: { borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: SPACING.lg },
  submitText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '800' },
  note: { fontSize: FONTS.sizes.xs, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 16 },
});

/**
 * CollectPaymentModal — rider collects Cash-on-Delivery payment.
 *
 * Shows a merchant UPI QR the customer scans to pay, OR a "cash collected"
 * path. The rider only marks it collected AFTER the customer confirms payment.
 * On success the order is marked paid (server-side) and the rider can deliver.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { paymentAPI, ordersAPI } from '../services/api';

interface Props {
  visible: boolean;
  order: { id: string; total_amount: number; tip_amount?: number } | null;
  onClose: () => void;
  onCollected: () => void;
}

export function CollectPaymentModal({ visible, order, onClose, onCollected }: Props) {
  const [merchant, setMerchant] = useState<{ vpa: string; name: string; configured: boolean } | null>(null);
  const [mode, setMode] = useState<'upi' | 'cash'>('upi');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Collect the order total + any tip the customer added.
  const amount = (order?.total_amount ?? 0) + (order?.tip_amount ?? 0);
  const ref4 = order?.id?.slice(-4).toUpperCase() || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentAPI.merchantUpi();
      setMerchant(res.data);
    } catch {
      setMerchant({ vpa: 'shinitz.test@upi', name: 'Shinitz', configured: false });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (visible) { setMode('upi'); setReference(''); load(); }
  }, [visible, load]);

  // Standard UPI deep-link / QR payload
  const upiString = merchant
    ? `upi://pay?pa=${encodeURIComponent(merchant.vpa)}&pn=${encodeURIComponent(merchant.name)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Shinitz Order ' + ref4)}`
    : '';

  const collect = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      await ordersAPI.collectPayment(order.id, mode, mode === 'upi' ? reference.trim() : undefined);
      onCollected();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not record payment.');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Collect Payment</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Amount to collect</Text>
              <Text style={styles.amount}>₹{amount.toFixed(2)}</Text>
              <Text style={styles.codTag}>Cash on Delivery</Text>
            </View>

            {/* Mode switch */}
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, mode === 'upi' && styles.modeBtnActive]} onPress={() => setMode('upi')}>
                <Ionicons name="qr-code" size={16} color={mode === 'upi' ? '#fff' : COLORS.textSecondary} />
                <Text style={[styles.modeText, mode === 'upi' && styles.modeTextActive]}>UPI / QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === 'cash' && styles.modeBtnActive]} onPress={() => setMode('cash')}>
                <Ionicons name="cash" size={16} color={mode === 'cash' ? '#fff' : COLORS.textSecondary} />
                <Text style={[styles.modeText, mode === 'cash' && styles.modeTextActive]}>Cash</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.xl }} />
            ) : mode === 'upi' ? (
              <View style={styles.qrSection}>
                <Text style={styles.scanHint}>Ask the customer to scan &amp; pay</Text>
                <View style={styles.qrBox}>
                  {!!upiString && <QRCode value={upiString} size={210} backgroundColor="#fff" />}
                </View>
                <TouchableOpacity onPress={() => Linking.openURL(upiString).catch(() => {})} style={styles.vpaRow}>
                  <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.vpa}>{merchant?.vpa}</Text>
                </TouchableOpacity>
                {merchant && !merchant.configured && (
                  <Text style={styles.testNote}>⚠️ Test mode — placeholder UPI ID. Set MERCHANT_UPI_VPA for live collection.</Text>
                )}
                <TextInput
                  style={styles.refInput}
                  placeholder="UPI reference / txn ID (optional)"
                  placeholderTextColor={COLORS.textMuted}
                  value={reference}
                  onChangeText={setReference}
                  autoCapitalize="characters"
                />
              </View>
            ) : (
              <View style={styles.cashSection}>
                <Ionicons name="cash-outline" size={48} color={COLORS.success} />
                <Text style={styles.cashText}>Collect ₹{amount.toFixed(2)} in cash from the customer.</Text>
              </View>
            )}

            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
              <Text style={styles.warnText}>Only mark collected after the customer confirms payment.</Text>
            </View>

            <TouchableOpacity style={[styles.collectBtn, submitting && { opacity: 0.6 }]} onPress={collect} disabled={submitting}>
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.collectText}>Mark Payment Collected</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  amountBox: { alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md },
  amountLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  amount: { fontSize: 34, fontWeight: '800', color: COLORS.primary, marginVertical: 2 },
  codTag: { fontSize: FONTS.sizes.xs, color: COLORS.warning, fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  modeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { fontWeight: '700', color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  modeTextActive: { color: '#fff' },
  qrSection: { alignItems: 'center', marginBottom: SPACING.sm },
  scanHint: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  qrBox: { backgroundColor: '#fff', padding: SPACING.md, borderRadius: RADIUS.lg },
  vpaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm },
  vpa: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '700' },
  testNote: { fontSize: FONTS.sizes.xs, color: COLORS.warning, marginTop: SPACING.xs, textAlign: 'center', paddingHorizontal: SPACING.md },
  refInput: { alignSelf: 'stretch', marginTop: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 11, color: COLORS.text, fontSize: FONTS.sizes.sm },
  cashSection: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg },
  cashText: { fontSize: FONTS.sizes.md, color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.warning + '15', borderRadius: RADIUS.md, padding: SPACING.sm, marginVertical: SPACING.md },
  warnText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.warning, fontWeight: '600' },
  collectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 15, marginBottom: SPACING.md },
  collectText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
});

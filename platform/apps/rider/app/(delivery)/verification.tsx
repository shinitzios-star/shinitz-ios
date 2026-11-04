import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Image, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { deliveryAPI, verificationAPI, authAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOCS: { key: string; label: string; camera?: boolean }[] = [
  { key: 'aadhaar_front', label: 'Aadhaar — Front' },
  { key: 'aadhaar_back', label: 'Aadhaar — Back' },
  { key: 'pan_card', label: 'PAN Card' },
  { key: 'selfie', label: 'Selfie Photo', camera: true },
];

export default function RiderVerificationScreen() {
  const router = useRouter();
  const { user, login } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activation, setActivation] = useState<any>(null);
  const [vstatus, setVstatus] = useState<any>(null);
  // Locally-picked doc images (base64 data URLs) not yet submitted
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [submittingDocs, setSubmittingDocs] = useState(false);
  // Bank form
  const [bank, setBank] = useState({ account_name: '', account_number: '', ifsc: '' });
  const [savingBank, setSavingBank] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, v] = await Promise.all([
        deliveryAPI.getActivationStatus(),
        verificationAPI.status(),
      ]);
      setActivation(a.data);
      setVstatus(v.data);
      const b = v.data?.bank;
      if (b?.account_name) {
        setBank((prev) => prev.account_number ? prev : {
          account_name: b.account_name || '', account_number: '', ifsc: b.ifsc || '',
        });
      }
      // Refresh the cached user so the gate elsewhere updates
      try {
        const me = await authAPI.getMe();
        const token = await AsyncStorage.getItem('auth_token');
        if (me.data && token) await login(me.data, token);
      } catch {}
    } catch (e) {
      // best-effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [login]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickDoc = async (key: string, camera?: boolean) => {
    try {
      const perm = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to add this photo.'); return; }
      const res = camera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.5, base64: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (!asset.base64) { Alert.alert('Error', 'Could not read image'); return; }
      if (asset.base64.length > 1_800_000) { Alert.alert('Too large', 'Please pick a smaller photo (under ~1.3 MB).'); return; }
      setPicked((p) => ({ ...p, [key]: `data:image/jpeg;base64,${asset.base64}` }));
    } catch {
      Alert.alert('Error', 'Could not pick the image.');
    }
  };

  const submitDocs = async () => {
    if (Object.keys(picked).length === 0) { Alert.alert('Nothing to upload', 'Add at least one document photo first.'); return; }
    setSubmittingDocs(true);
    try {
      await verificationAPI.submitDocuments(picked);
      setPicked({});
      await load();
      Alert.alert('Uploaded', 'Documents submitted for admin review.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not submit documents.');
    } finally { setSubmittingDocs(false); }
  };

  const saveBank = async () => {
    if (!bank.account_name.trim() || bank.account_number.trim().length < 6 || bank.ifsc.trim().length < 4) {
      Alert.alert('Check details', 'Enter the account holder name, a valid account number and IFSC.');
      return;
    }
    setSavingBank(true);
    try {
      await verificationAPI.submitBank({
        account_name: bank.account_name.trim(),
        account_number: bank.account_number.trim(),
        ifsc: bank.ifsc.trim().toUpperCase(),
      });
      await load();
      Alert.alert('Saved', 'Bank details submitted. The admin will verify with a ₹1 deposit.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not save bank details.');
    } finally { setSavingBank(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const submitted = vstatus?.documents_submitted || {};
  const bankStatus = vstatus?.bank?.verification_status || 'not_submitted';
  const canGoOnline = activation?.can_go_online;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Verified</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {canGoOnline ? (
          <View style={[styles.statusCard, { borderColor: COLORS.success }]}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <Text style={styles.statusOk}>You&apos;re verified — you can go online and accept deliveries.</Text>
          </View>
        ) : (
          <Text style={styles.intro}>Complete every step below. An admin reviews your documents and verifies your bank with a ₹1 deposit before you can go online.</Text>
        )}

        {activation?.rejection_reason ? (
          <View style={styles.rejectCard}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.rejectText}>{activation.rejection_reason}</Text>
          </View>
        ) : null}

        {/* Checklist */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activation checklist</Text>
          {(activation?.checklist || []).map((c: any) => (
            <View key={c.key} style={styles.checkRow}>
              <Ionicons
                name={c.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={c.done ? COLORS.success : COLORS.textMuted}
              />
              <Text style={[styles.checkLabel, c.done && { color: COLORS.text }]}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Documents */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Documents</Text>
          <Text style={styles.cardSub}>Aadhaar (front &amp; back), PAN and a selfie. Clear photos only.</Text>
          <View style={styles.docGrid}>
            {DOCS.map((d) => {
              const local = picked[d.key];
              const done = !!submitted[d.key];
              return (
                <TouchableOpacity key={d.key} style={styles.docTile} activeOpacity={0.85} onPress={() => pickDoc(d.key, d.camera)}>
                  {local ? (
                    <Image source={{ uri: local }} style={styles.docImg} />
                  ) : done ? (
                    <View style={[styles.docImg, styles.docDone]}>
                      <Ionicons name="checkmark-circle" size={26} color={COLORS.success} />
                      <Text style={styles.docDoneText}>Submitted</Text>
                    </View>
                  ) : (
                    <View style={[styles.docImg, styles.docEmpty]}>
                      <Ionicons name={d.camera ? 'camera' : 'cloud-upload-outline'} size={24} color={COLORS.textMuted} />
                    </View>
                  )}
                  <Text style={styles.docLabel}>{d.label}</Text>
                  {(local || done) && <Text style={styles.docRetake}>{local ? 'Tap to change' : 'Tap to replace'}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, (submittingDocs || Object.keys(picked).length === 0) && styles.btnDisabled]}
            onPress={submitDocs}
            disabled={submittingDocs || Object.keys(picked).length === 0}
          >
            {submittingDocs ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Submit Documents</Text>}
          </TouchableOpacity>
        </View>

        {/* Bank */}
        <View style={styles.card}>
          <View style={styles.bankHead}>
            <Text style={styles.cardTitle}>Bank account</Text>
            <View style={[styles.bankPill, bankStatus === 'verified' ? styles.pillOk : bankStatus === 'failed' ? styles.pillErr : styles.pillPend]}>
              <Text style={styles.bankPillText}>{bankStatus.replace(/_/g, ' ')}</Text>
            </View>
          </View>
          <Text style={styles.cardSub}>Your payout account. The admin verifies it with a ₹1 deposit.</Text>
          <TextInput
            style={styles.input}
            placeholder="Account holder name"
            placeholderTextColor={COLORS.textMuted}
            value={bank.account_name}
            onChangeText={(t) => setBank((b) => ({ ...b, account_name: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Account number"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            value={bank.account_number}
            onChangeText={(t) => setBank((b) => ({ ...b, account_number: t.replace(/\D/g, '') }))}
          />
          <TextInput
            style={styles.input}
            placeholder="IFSC code"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            value={bank.ifsc}
            onChangeText={(t) => setBank((b) => ({ ...b, ifsc: t.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
          />
          <TouchableOpacity style={[styles.primaryBtn, savingBank && styles.btnDisabled]} onPress={saveBank} disabled={savingBank}>
            {savingBank ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Save Bank Details</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.footNote}>After you submit everything, an admin reviews and approves your account. You&apos;ll get a notification when you&apos;re cleared to go online.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  intro: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 20 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.success + '12', borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  statusOk: { flex: 1, color: COLORS.success, fontWeight: '700', fontSize: FONTS.sizes.sm },
  rejectCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.error + '12', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
  rejectText: { flex: 1, color: COLORS.error, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, marginBottom: SPACING.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
  checkLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, flex: 1 },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  docTile: { width: '47%', alignItems: 'center' },
  docImg: { width: '100%', height: 96, borderRadius: RADIUS.md, marginBottom: 4 },
  docEmpty: { backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  docDone: { backgroundColor: COLORS.success + '12', justifyContent: 'center', alignItems: 'center', gap: 4 },
  docDoneText: { color: COLORS.success, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  docLabel: { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: '600' },
  docRetake: { fontSize: 10, color: COLORS.textMuted },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 13, alignItems: 'center', marginTop: SPACING.xs },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.md },
  btnDisabled: { opacity: 0.5 },
  bankHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  pillOk: { backgroundColor: COLORS.success + '20' },
  pillErr: { backgroundColor: COLORS.error + '20' },
  pillPend: { backgroundColor: COLORS.warning + '20' },
  bankPillText: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'capitalize' },
  input: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, fontSize: FONTS.sizes.md },
  footNote: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, marginTop: SPACING.sm },
});

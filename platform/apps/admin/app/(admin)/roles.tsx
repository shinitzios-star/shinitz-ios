import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { adminAPI } from '../../src/services/api';

const roleLabel = (r: string) => (r || '').replace('_', ' ');

export default function AdminRolesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [roles, setRoles] = useState<string[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    Promise.all([adminAPI.listRoles(), adminAPI.listAdmins()])
      .then(([rr, ra]) => {
        setRoles(rr.data?.roles || ['super_admin', 'admin']);
        setAdmins(ra.data?.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!phone.trim()) return;
    setAdding(true);
    try {
      await adminAPI.addAdmin(phone.trim(), newRole);
      showToast({ type: 'success', message: 'Admin added' });
      setPhone('');
      load();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.detail || 'Could not add' });
    } finally { setAdding(false); }
  };

  const changeRole = async (uid: string, role: string) => {
    try { await adminAPI.setAdminRole(uid, role); load(); }
    catch { showToast({ type: 'error', message: 'Could not update' }); }
  };

  const remove = (a: any) => {
    Alert.alert('Remove admin', `Remove admin access for ${a.name || a.phone}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { await adminAPI.removeAdmin(a.id); load(); }
          catch (e: any) { showToast({ type: 'error', message: e?.response?.data?.detail || 'Could not remove' }); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Roles & Access</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Add admin */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add admin</Text>
            <Text style={styles.hint}>The person must already have an account in the app.</Text>
            <TextInput
              style={styles.input} value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
              keyboardType="phone-pad" placeholder="10-digit phone" placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.chips}>
              {roles.map((r) => (
                <TouchableOpacity key={r} onPress={() => setNewRole(r)}
                  style={[styles.chip, newRole === r && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Text style={[styles.chipText, { color: newRole === r ? '#fff' : colors.textSecondary }]}>{roleLabel(r)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.addBtn, adding && { opacity: 0.6 }]} onPress={add} disabled={adding}>
              {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addText}>Add admin</Text>}
            </TouchableOpacity>
          </View>

          {/* Admins list */}
          <Text style={styles.section}>ADMINS</Text>
          {admins.map((a) => (
            <View key={a.id} style={styles.adminCard}>
              <View style={styles.adminTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminName}>{a.name || 'Admin'}</Text>
                  <Text style={styles.adminPhone}>{a.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => remove(a)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.chips}>
                {roles.map((r) => (
                  <TouchableOpacity key={r} onPress={() => changeRole(a.id, r)}
                    style={[styles.chipSm, a.admin_role === r && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[styles.chipTextSm, { color: a.admin_role === r ? '#fff' : colors.textSecondary }]}>{roleLabel(r)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.note}>2FA: admin sign-in requires an OTP to the registered phone. Roles &amp; access are shared with the website admin panel.</Text>
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text },
  hint: { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: 2, marginBottom: SPACING.sm },
  input: { backgroundColor: colors.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: FONTS.sizes.md },
  fieldLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textSecondary, marginTop: SPACING.md, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontSize: FONTS.sizes.sm, fontWeight: '700', textTransform: 'capitalize' },
  addBtn: { marginTop: SPACING.md, backgroundColor: colors.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  addText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  section: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  adminCard: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.sm },
  adminTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  adminName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text },
  adminPhone: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  chipSm: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipTextSm: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  note: { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: SPACING.md, lineHeight: 17 },
});

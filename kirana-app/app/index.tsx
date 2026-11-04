import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

// This app serves ONLY the "kirana" role. A session for any other role is sent
// to login (platform separation).
const APP_ROLE = 'kirana';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [stuck, setStuck] = useState(false);

  const target = (!isAuthenticated || !user || user.role !== APP_ROLE)
    ? '/(auth)/login?role=kirana'
    : '/(kirana)/dashboard';

  useEffect(() => {
    // ROOT-CAUSE FIX (green-screen incident): expo-router v6's router.replace()
    // SILENTLY NO-OPS when the navigation tree isn't mounted yet (it does NOT
    // throw). The earlier version marked itself "done" after the first call and
    // stopped retrying — so if that first call no-op'd, the app was stuck on
    // this brand-green screen forever. Fix: NEVER mark done; just keep calling
    // replace() every 300ms. It's idempotent, and the moment navigation
    // actually succeeds this component UNMOUNTS and the cleanup clears the
    // interval. Guaranteed to escape even if early calls no-op.
    let cancelled = false;
    const tick = () => { if (!cancelled) { try { router.replace(target as any); } catch {} } };
    tick();
    const id = setInterval(tick, 300);
    const stuckId = setTimeout(() => setStuck(true), 3500);
    return () => { cancelled = true; clearInterval(id); clearTimeout(stuckId); };
  }, [target]);

  return (
    <View style={s.wrap}>
      <Text style={s.brand}>Shinitz</Text>
      <ActivityIndicator color="#D4AF37" style={{ marginTop: 18 }} />
      {stuck && (
        <TouchableOpacity style={s.btn} onPress={() => { try { router.replace(target as any); } catch {} }}>
          <Text style={s.btnText}>Tap to continue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0F3D2E', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  btn: {
    marginTop: 28, borderWidth: 1.5, borderColor: '#D4AF37',
    borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12,
  },
  btnText: { color: '#D4AF37', fontWeight: '800', fontSize: 15 },
});

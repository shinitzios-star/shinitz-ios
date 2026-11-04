// ─────────────────────────────────────────────────────────────────────────────
// SelfieVerification — daily identity check before going online (Swiggy/Uber
// model). Full-screen front-camera capture with a circular face guide; the
// image goes straight from the in-app camera to the server (there is NO
// gallery path, so photo-library spoofing is impossible by design). Server
// stores it with device/GPS context for the admin audit trail and unlocks
// going online for the rest of the (IST) day.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator,
  Image, Dimensions, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { useTheme } from '../contexts/ThemeContext';
import { space, radius, typography } from '../constants/designSystem';
import { deliveryAPI } from '../services/api';

const { width } = Dimensions.get('window');
const GUIDE = Math.min(width * 0.72, 300);

type Phase = 'camera' | 'preview' | 'uploading' | 'done' | 'error';

export function SelfieVerification({ visible, onVerified, onClose }: {
  visible: boolean;
  onVerified: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retriesRef = useRef(0);

  const reset = () => { setPhase('camera'); setPhoto(null); setError(null); };

  const capture = async () => {
    if (!camRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // Capture at good quality WITHOUT base64 (the raw sensor image on modern
      // phones is 10-16MP; base64-ing it here was the root cause of the
      // "Selfie too large" 413s). No skipProcessing → EXIF rotation is applied,
      // so selfies are never sideways.
      const pic = await camRef.current.takePictureAsync({ quality: 0.9 });
      if (!pic?.uri) { setError('Could not capture — please retake.'); return; }
      // Normalize for upload: 720px wide (plenty for identity review), JPEG
      // ~0.55 → ~60-120 KB payload, far under the server's 2 MB cap on any
      // device. Re-encoding also strips EXIF metadata (GPS etc.).
      const small = await ImageManipulator.manipulateAsync(
        pic.uri,
        [{ resize: { width: 720 } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!small?.base64) { setError('Could not process the photo — please retake.'); return; }
      setPhoto(`data:image/jpeg;base64,${small.base64}`);
      setPhase('preview');
    } catch {
      setError('Could not capture — please retake.');
    }
  };

  const submit = async () => {
    if (!photo || phase === 'uploading') return;   // duplicate-tap guard
    setPhase('uploading');
    setError(null);
    // Best-effort audit context — never blocks the verification itself.
    let lat: number | null = null, lng: number | null = null;
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status === 'granted') {
        const pos = await Location.getLastKnownPositionAsync();
        lat = pos?.coords.latitude ?? null;
        lng = pos?.coords.longitude ?? null;
      }
    } catch {}

    // Up to 3 attempts with backoff — but ONLY for transient failures
    // (network drop / 5xx). A 4xx means retrying the same payload can't help.
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1500));
      try {
        await deliveryAPI.submitSelfie({
          image: photo, lat, lng,
          device: `${Device.brand || ''} ${Device.modelName || ''} · ${Platform.OS} ${Device.osVersion || ''}`.trim(),
          retry_count: retriesRef.current + attempt,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPhase('done');
        setTimeout(() => { onVerified(); reset(); }, 1400);
        return;
      } catch (e: any) {
        lastErr = e;
        const status = e?.response?.status;
        if (status && status < 500) break;   // client error — don't hammer
      }
    }
    retriesRef.current += 1;
    const status = lastErr?.response?.status;
    const detail = lastErr?.response?.data?.detail;
    let msg: string;
    if (status === 401) msg = 'Session expired — please log in again.';
    else if (status === 413) msg = 'Photo could not be optimized on this device — please retake.';
    else if (status && status < 500) msg = detail || 'Upload rejected — please retake and try again.';
    else if (status >= 500) msg = 'Server unavailable right now — please retry in a moment.';
    else msg = 'Unable to upload — check your internet connection and try again.';
    setError(msg);
    setPhase('preview');
  };

  const renderBody = () => {
    if (!permission) return <ActivityIndicator color="#fff" style={{ marginTop: 120 }} />;

    if (!permission.granted) {
      return (
        <View style={s.centerFill}>
          <Ionicons name="camera-outline" size={54} color="rgba(255,255,255,0.8)" />
          <Text style={s.stateTitle}>Camera permission required</Text>
          <Text style={s.stateSub}>We need the camera for a quick identity selfie before you go online.</Text>
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={s.primaryText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'done') {
      return (
        <View style={s.centerFill}>
          <View style={[s.doneIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={46} color="#fff" />
          </View>
          <Text style={s.stateTitle}>Identity Verified</Text>
          <Text style={s.stateSub}>Welcome back! Taking you online…</Text>
        </View>
      );
    }

    if (phase === 'preview' || phase === 'uploading') {
      return (
        <View style={s.centerFill}>
          <Image source={{ uri: photo! }} style={s.previewImg} />
          {phase === 'uploading' ? (
            <>
              <ActivityIndicator color="#fff" size="large" style={{ marginTop: space.xl }} />
              <Text style={s.stateSub}>Checking your selfie…</Text>
            </>
          ) : (
            <>
              {error ? <Text style={s.errText}>{error}</Text> : (
                <Text style={s.stateSub}>Face clearly visible? Submit to continue.</Text>
              )}
              <View style={s.previewActions}>
                <TouchableOpacity style={s.ghostBtn} onPress={reset}>
                  <Ionicons name="refresh" size={17} color="#fff" />
                  <Text style={s.ghostText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={submit}>
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={s.primaryText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      );
    }

    // phase === 'camera'
    return (
      <View style={s.centerFill}>
        <View style={s.guideWrap}>
          <CameraView
            ref={camRef}
            style={s.camera}
            facing="front"
            animateShutter={false}
          />
          <View pointerEvents="none" style={[s.guideRing, { borderColor: colors.primary }]} />
        </View>
        <View style={s.tips}>
          {[['sunny-outline', 'Find good lighting'], ['happy-outline', 'Look straight at the camera'], ['glasses-outline', 'Remove helmet & sunglasses']].map(([ic, t]) => (
            <View key={t as string} style={s.tipRow}>
              <Ionicons name={ic as any} size={15} color="rgba(255,255,255,0.75)" />
              <Text style={s.tipText}>{t}</Text>
            </View>
          ))}
        </View>
        {error ? <Text style={s.errText}>{error}</Text> : null}
        <TouchableOpacity style={[s.shutter, { borderColor: colors.primary }]} onPress={capture} activeOpacity={0.8}>
          <View style={[s.shutterInner, { backgroundColor: colors.primary }]} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Verify Your Identity</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={s.subtitle}>Take a clear selfie to continue. This keeps every delivery account secure.</Text>
        {renderBody()}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1512', paddingTop: 54 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: {
    color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center',
    marginTop: space.sm, paddingHorizontal: space.xxl, lineHeight: 19,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  guideWrap: { width: GUIDE, height: GUIDE, borderRadius: GUIDE / 2, overflow: 'hidden' },
  camera: { width: GUIDE, height: GUIDE },
  guideRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: GUIDE / 2, borderWidth: 3,
  },
  tips: { marginTop: space.xl, gap: 7 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '600' },
  shutter: {
    width: 74, height: 74, borderRadius: 37, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', marginTop: space.xxl,
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28 },
  previewImg: { width: GUIDE, height: GUIDE, borderRadius: GUIDE / 2 },
  previewActions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 13,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  ghostText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stateTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: space.lg, textAlign: 'center' },
  stateSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13.5, textAlign: 'center', marginTop: space.sm, lineHeight: 20 },
  errText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', marginTop: space.md, paddingHorizontal: space.lg },
  doneIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});

export default SelfieVerification;

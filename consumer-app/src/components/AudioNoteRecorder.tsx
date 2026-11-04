import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

export type AudioNote = { uri: string; duration: number };

interface Props {
  value: AudioNote | null;
  onChange: (v: AudioNote | null) => void;
}

const MAX_SECONDS = 60;
const BARS = 7;

/** Record a delivery voice note (≤60s) with playback, delete and re-record. */
export function AudioNoteRecorder({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bars = useRef([...Array(BARS)].map(() => new Animated.Value(0.3))).current;

  // Animate the waveform bars while recording.
  useEffect(() => {
    if (!isRecording) return;
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 300 + i * 60, useNativeDriver: false }),
          Animated.timing(b, { toValue: 0.3, duration: 300 + i * 60, useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [isRecording]);

  useEffect(() => () => { // cleanup on unmount
    if (timerRef.current) clearInterval(timerRef.current);
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    soundRef.current?.unloadAsync().catch(() => {});
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone needed', 'Please allow microphone access to record a voice note.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      onChange(null);
      setElapsed(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS; }
          return e + 1;
        });
      }, 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      const status = await rec.getStatusAsync();
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      const dur = Math.round((status.durationMillis || elapsed * 1000) / 1000);
      recordingRef.current = null;
      if (uri) onChange({ uri, duration: Math.max(1, dur) });
    } catch {
      recordingRef.current = null;
    }
  };

  const togglePlay = async () => {
    if (!value) return;
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: value.uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { setIsPlaying(false); sound.unloadAsync().catch(() => {}); }
      });
      setIsPlaying(true);
      await sound.playAsync();
    } catch {
      setIsPlaying(false);
    }
  };

  const remove = async () => {
    if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
    setIsPlaying(false);
    onChange(null);
    setElapsed(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Ionicons name="mic-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>Voice instructions for the rider (optional)</Text>
      </View>

      {/* Idle (no recording yet) */}
      {!isRecording && !value && (
        <TouchableOpacity style={styles.recordBtn} activeOpacity={0.85} onPress={startRecording}>
          <Ionicons name="mic" size={20} color="#fff" />
          <Text style={styles.recordText}>Record a voice note</Text>
        </TouchableOpacity>
      )}

      {/* Recording in progress */}
      {isRecording && (
        <View style={styles.recordingRow}>
          <View style={styles.waveform}>
            {bars.map((b, i) => (
              <Animated.View key={i} style={[styles.bar, {
                backgroundColor: colors.primary,
                height: b.interpolate({ inputRange: [0, 1], outputRange: [6, 30] }),
              }]} />
            ))}
          </View>
          <Text style={styles.timer}>{fmt(elapsed)} / 1:00</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.85}>
            <Ionicons name="stop" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Recorded — playback + delete */}
      {!isRecording && value && (
        <View style={styles.playbackRow}>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay} activeOpacity={0.85}>
            <Ionicons name={isPlaying ? 'stop' : 'play'} size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.playInfo}>
            <Text style={styles.playLabel}>Voice note recorded</Text>
            <Text style={styles.playDur}>{fmt(value.duration)}</Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={remove} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteText}>Re-record</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.md, marginTop: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingVertical: 12 },
  recordText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.md },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, height: 32 },
  bar: { width: 4, borderRadius: 2 },
  timer: { fontSize: FONTS.sizes.sm, color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stopBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },
  playbackRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  playInfo: { flex: 1 },
  playLabel: { fontSize: FONTS.sizes.sm, color: colors.text, fontWeight: '700' },
  playDur: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteText: { fontSize: FONTS.sizes.xs, color: colors.error, fontWeight: '700' },
});

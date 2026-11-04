import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getAudioNoteSource } from '../services/api';

interface Props {
  orderId: string;
  hasNote?: boolean;
  durationSec?: number;
  compact?: boolean;
}

/**
 * Plays the customer's voice delivery note for an order (rider / store / admin).
 * Streams the encrypted audio from the backend with the caller's auth header —
 * the server decrypts and gates access by role.
 */
export function AudioNotePlayer({ orderId, hasNote, durationSec, compact }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  if (hasNote === false) return null;

  const toggle = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.stopAsync();
        setPlaying(false);
        return;
      }
      setLoading(true);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const src = await getAudioNoteSource(orderId);
      const { sound } = await Audio.Sound.createAsync(src as any);
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { setPlaying(false); sound.unloadAsync().catch(() => {}); }
      });
      setLoading(false);
      setPlaying(true);
      await sound.playAsync();
    } catch {
      setLoading(false);
      setPlaying(false);
    }
  };

  const fmt = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : null);

  return (
    <TouchableOpacity style={[styles.container, compact && styles.compact]} activeOpacity={0.85} onPress={toggle}>
      <View style={styles.iconWrap}>
        {loading ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name={playing ? 'stop' : 'play'} size={18} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Customer voice note</Text>
        <Text style={styles.sub}>{playing ? 'Playing…' : `Tap to play${fmt(durationSec) ? `  ·  ${fmt(durationSec)}` : ''}`}</Text>
      </View>
      <Ionicons name="mic" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: colors.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.md },
  compact: { padding: SPACING.sm },
  iconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: colors.text },
  sub: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },
});

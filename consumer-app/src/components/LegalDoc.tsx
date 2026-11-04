import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

export type LegalSection = { heading: string; body: string[] };

interface Props {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

/** Shared scrollable legal-document layout (Privacy Policy, Terms, etc.). */
export function LegalDoc({ title, updated, intro, sections }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.updated}>Last updated: {updated}</Text>
        {!!intro && <Text style={styles.intro}>{intro}</Text>}

        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.heading}>{`${i + 1}. ${s.heading}`}</Text>
            {s.body.map((p, j) => (
              <Text key={j} style={styles.para}>{p}</Text>
            ))}
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.disclaimerText}>
            This document is provided for transparency. For legal queries, contact
            grievance@shinitz.com.
          </Text>
        </View>
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.text },
  body: { padding: SPACING.lg },
  docTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '900', color: colors.text, marginBottom: 4 },
  updated: { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginBottom: SPACING.md },
  intro: { fontSize: FONTS.sizes.md, color: colors.textSecondary, lineHeight: 22, marginBottom: SPACING.lg },
  section: { marginBottom: SPACING.lg },
  heading: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text, marginBottom: SPACING.sm },
  para: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, lineHeight: 21, marginBottom: SPACING.sm },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm },
  disclaimerText: { flex: 1, fontSize: FONTS.sizes.xs, color: colors.textMuted, lineHeight: 18 },
});

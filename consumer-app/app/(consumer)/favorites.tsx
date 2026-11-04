import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProductCard } from '../../src/components/ProductCard';
import { useFavoritesStore } from '../../src/store/favoritesStore';

export default function FavoritesScreen() {
  const { favorites, loadFromStorage } = useFavoritesStore();
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => { loadFromStorage(); }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('wishlist')}</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.countText}>{favorites.length}</Text>
        </View>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ProductCard product={{ ...item, stock: 10 }} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('noFavoritesYet')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {t('favoritesHint')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '700' },
  countBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#ffffff' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  row: { justifyContent: 'space-between' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyText: { fontSize: FONTS.sizes.xl, fontWeight: '700', marginBottom: SPACING.sm },
  emptySubtext: { fontSize: FONTS.sizes.md, textAlign: 'center', lineHeight: 22 },
});

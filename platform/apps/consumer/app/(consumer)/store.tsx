import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProductCard } from '../../src/components/ProductCard';
import { productsAPI } from '../../src/services/api';

/**
 * A single restaurant / kirana store's OWN menu. Reached by tapping a store
 * name on a product card or a restaurant card. Shows only this store's items
 * (server filters by store_id — no cross-restaurant leakage).
 */
export default function StoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { storeId, storeName, storeType } = useLocalSearchParams<{ storeId: string; storeName: string; storeType: string }>();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await productsAPI.getAll({ store_id: storeId });
      setItems(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isFood = storeType === 'restaurant';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.storeName, { color: colors.text }]} numberOfLines={1}>{storeName || 'Store'}</Text>
          <Text style={[styles.storeMeta, { color: colors.textSecondary }]}>
            {isFood ? 'Restaurant' : 'Kirana Store'}{items.length ? ` · ${items.length} items` : ''}
          </Text>
        </View>
        <View style={[styles.typePill, { backgroundColor: (isFood ? '#f59e0b' : colors.success) + '22' }]}>
          <Ionicons name={isFood ? 'restaurant' : 'storefront'} size={14} color={isFood ? '#f59e0b' : colors.success} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          renderItem={({ item }) => <ProductCard product={item} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="fast-food-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.empty, { color: colors.textSecondary }]}>No items available right now</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  storeName: { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  storeMeta: { fontSize: FONTS.sizes.sm, marginTop: 1 },
  typePill: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 120, paddingTop: SPACING.sm },
  row: { justifyContent: 'space-between' },
  empty: { fontSize: FONTS.sizes.md },
});

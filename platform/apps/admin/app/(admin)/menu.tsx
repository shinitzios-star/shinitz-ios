import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import api from '../../src/services/api';

/**
 * Admin Menu — VIEW ONLY.
 *
 * Menu creation/editing/deletion was removed from the admin panel: restaurant
 * owners manage their own menus from the restaurant app. Admins can only review
 * menu content here (read-only) and monitor restaurants.
 */
export default function MenuViewScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.get('/restaurant/menu');
      setItems(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.viewOnlyPill}>
          <Ionicons name="eye-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.viewOnlyText}>View only</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMenu(); }} tintColor={COLORS.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.available && styles.cardDisabled]}>
            <View style={styles.cardTop}>
              <View style={[styles.vegBadge, { borderColor: item.is_veg ? '#22c55e' : '#ef4444' }]}>
                <View style={[styles.vegDot, { backgroundColor: item.is_veg ? '#22c55e' : '#ef4444' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.tagRow}>
                  <View style={styles.tag}><Text style={styles.tagText}>{item.category}</Text></View>
                  <View style={styles.tag}>
                    <Ionicons name="time-outline" size={10} color={COLORS.textSecondary} />
                    <Text style={styles.tagText}>{item.prep_time || 20} min</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: (item.available ? COLORS.success : COLORS.error) + '18' }]}>
                    <Text style={[styles.tagText, { color: item.available ? COLORS.success : COLORS.error, fontWeight: '700' }]}>
                      {item.available ? 'Available' : 'Hidden'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.price}>₹{item.price}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No menu items</Text>
              <Text style={styles.emptySub}>Restaurant owners add items from their own app</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  viewOnlyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.full },
  viewOnlyText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecondary },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  cardDisabled: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', gap: SPACING.sm },
  vegBadge: { width: 18, height: 18, borderWidth: 2, borderRadius: 3, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  itemName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  itemDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  tagText: { fontSize: 10, color: COLORS.textSecondary },
  price: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primary },
  empty: { justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl * 2, paddingHorizontal: SPACING.lg },
  emptyText: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md },
  emptySub: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
});

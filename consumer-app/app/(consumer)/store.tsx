import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProductCard } from '../../src/components/ProductCard';
import { RestaurantReviews } from '../../src/components/RestaurantReviews';
import RestaurantLegalFooter from '../../src/components/RestaurantLegalFooter';
import api, { productsAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

/**
 * A single restaurant / kirana store's OWN menu. Reached by tapping a store
 * name on a product card or a restaurant card. Shows only this store's items
 * (server filters by store_id — no cross-restaurant leakage).
 *
 * Menu browsing (Swiggy-grade): sticky in-menu search (client-side over the
 * loaded menu — instant, no extra requests), veg / non-veg filter, category
 * chips derived from the menu itself, and price/rating sorting. All filtering
 * is memoized so large menus stay at 60fps.
 */

type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating';
const SORTS: { key: SortKey; label: string; icon: any }[] = [
  { key: 'recommended', label: 'Recommended', icon: 'sparkles-outline' },
  { key: 'rating', label: 'Top Rated', icon: 'star-outline' },
  { key: 'price_asc', label: 'Price ↑', icon: 'arrow-up-outline' },
  { key: 'price_desc', label: 'Price ↓', icon: 'arrow-down-outline' },
];

export default function StoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { storeId, storeName, storeType } = useLocalSearchParams<{ storeId: string; storeName: string; storeType: string }>();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  // Serviceability for the CURRENT delivery location. Search can surface a
  // restaurant outside the delivery radius, so this page has to be able to say
  // so and switch ordering off — the backend refuses the order either way, but
  // the customer should learn it here, not at checkout.
  const [info, setInfo] = useState<any>(null);
  const outOfArea = info?.serviceable === false;
  // Open / closed, worded by the backend from the saved operating hours (IST),
  // the manual online switch and approval — this screen never reads the phone's
  // clock. "Open until 11:00 PM" | "Currently Closed" + "Opens today at 10:00 AM".
  const avail = info?.availability || null;
  const closedNow = !outOfArea && info?.accepting_orders === false;
  // customer_title/detail come from the current backend; the fallbacks keep an
  // older API response readable.
  const statusTitle: string | null = avail
    ? (avail.customer_title
      || (avail.state === 'online' ? 'Open' : avail.state === 'closed' ? 'Currently Closed' : 'Currently unavailable'))
    : null;
  const statusDetail: string | null = avail
    ? (avail.customer_detail || (avail.state === 'closed' ? avail.next_opening?.label || null : null))
    : null;

  // ── Browse state ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');            // instant input value
  const [search, setSearch] = useState('');          // debounced applied value
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recommended');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    // Serviceability is recomputed from the CURRENT delivery location every
    // time, so changing address flips this without any cached state.
    const loc = useAuthStore.getState().user?.location;
    api.get(`/restaurants/${encodeURIComponent(String(storeId))}/info`, {
      params: loc ? { lat: loc.lat, lng: loc.lng } : undefined,
    })
      .then((r) => setInfo(r.data))
      .catch(() => setInfo(null));
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

  const onSearch = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(v.trim().toLowerCase()), 250);
  };

  // Category chips come from the menu itself — zero config for store owners.
  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const it of items) {
      const c = (it.category || '').trim();
      if (c) set.set(c, (set.get(c) || 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [items]);

  const filtered = useMemo(() => {
    let out = items;
    if (search) out = out.filter((i) => (i.name || '').toLowerCase().includes(search) || (i.category || '').toLowerCase().includes(search));
    if (vegOnly) out = out.filter((i) => i.is_veg === true);
    if (nonVegOnly) out = out.filter((i) => i.is_veg === false);
    if (category) out = out.filter((i) => (i.category || '').trim() === category);
    switch (sort) {
      case 'price_asc': out = [...out].sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price_desc': out = [...out].sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'rating': out = [...out].sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      default: break; // server order = recommended
    }
    return out;
  }, [items, search, vegOnly, nonVegOnly, category, sort]);

  const resetScroll = () => listRef.current?.scrollToOffset({ offset: 0, animated: false });
  const isFood = storeType === 'restaurant';
  const filtersActive = !!(search || vegOnly || nonVegOnly || category);

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
            {rating && rating.count > 0 ? `★ ${rating.average.toFixed(1)} (${rating.count}) · ` : ''}
            {isFood ? 'Restaurant' : 'Kirana Store'}{items.length ? ` · ${items.length} items` : ''}
          </Text>
          {statusTitle ? (
            <Text style={styles.storeStatus} numberOfLines={1}>
              <Text style={{ color: avail.state === 'online' ? (colors.success || '#2D5016') : '#DC2626', fontWeight: '700' }}>
                {statusTitle}
              </Text>
              {statusDetail ? (
                <Text style={{ color: colors.textSecondary }}>{` · ${statusDetail}`}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>
        <View style={[styles.typePill, { backgroundColor: (isFood ? '#f59e0b' : colors.success) + '22' }]}>
          <Ionicons name={isFood ? 'restaurant' : 'storefront'} size={14} color={isFood ? '#f59e0b' : colors.success} />
        </View>
      </View>

      {/* Sticky search */}
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={`Search in ${storeName || 'menu'}…`}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={onSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setSearch(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter / sort rail */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail} style={{ flexGrow: 0 }}>
          {/* Veg / non-veg (mutually exclusive) */}
          <TouchableOpacity
            style={[styles.chip, { borderColor: vegOnly ? '#0f8a45' : colors.border, backgroundColor: vegOnly ? '#0f8a4518' : colors.card }]}
            onPress={() => { setVegOnly(!vegOnly); setNonVegOnly(false); resetScroll(); }}
          >
            <View style={[styles.vegSquare, { borderColor: '#0f8a45' }]}><View style={[styles.vegDot, { backgroundColor: '#0f8a45' }]} /></View>
            <Text style={[styles.chipText, { color: vegOnly ? '#0f8a45' : colors.textSecondary }]}>Veg</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { borderColor: nonVegOnly ? '#b91c1c' : colors.border, backgroundColor: nonVegOnly ? '#b91c1c18' : colors.card }]}
            onPress={() => { setNonVegOnly(!nonVegOnly); setVegOnly(false); resetScroll(); }}
          >
            <View style={[styles.vegSquare, { borderColor: '#b91c1c' }]}><View style={[styles.vegDot, { backgroundColor: '#b91c1c' }]} /></View>
            <Text style={[styles.chipText, { color: nonVegOnly ? '#b91c1c' : colors.textSecondary }]}>Non-veg</Text>
          </TouchableOpacity>

          {/* Sort */}
          {SORTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.chip, {
                borderColor: sort === s.key ? colors.primary : colors.border,
                backgroundColor: sort === s.key ? colors.primary + '15' : colors.card,
              }]}
              onPress={() => { setSort(s.key); resetScroll(); }}
            >
              <Ionicons name={s.icon} size={13} color={sort === s.key ? colors.primary : colors.textSecondary} />
              <Text style={[styles.chipText, { color: sort === s.key ? colors.primary : colors.textSecondary }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category chips (from the menu's own categories) */}
        {categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail} style={{ flexGrow: 0 }}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, {
                  borderColor: category === c ? colors.primary : colors.border,
                  backgroundColor: category === c ? colors.primary + '15' : colors.card,
                }]}
                onPress={() => { setCategory(category === c ? null : c); resetScroll(); }}
              >
                <Text style={[styles.chipText, { color: category === c ? colors.primary : colors.textSecondary }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Outside the delivery area — a calm, informative state, not an error.
          The menu stays fully browsable; only ordering is switched off. */}
      {outOfArea && (
        <View style={[styles.outBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
          <View style={styles.outBannerBody}>
            <Text style={[styles.outBannerTitle, { color: colors.text }]}>
              Outside your delivery area
            </Text>
            <Text style={[styles.outBannerText, { color: colors.textSecondary }]}>
              {info?.out_of_area_message
                || 'This restaurant is currently outside your delivery range.'}
              {info?.distance_km != null ? ` It's about ${info.distance_km} km away.` : ''}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(consumer)/home' as any)}>
              <Text style={[styles.outBannerLink, { color: colors.primary }]}>
                Explore nearby restaurants
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Closed or not accepting orders — say so up front with the next opening
          time, instead of letting the customer find out at checkout. The menu
          stays browsable; only ordering is switched off. */}
      {closedNow && (
        <View style={[styles.outBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <View style={styles.outBannerBody}>
            <Text style={[styles.outBannerTitle, { color: colors.text }]}>
              {statusTitle || 'Currently unavailable'}
            </Text>
            <Text style={[styles.outBannerText, { color: colors.textSecondary }]}>
              {statusDetail
                ? `${statusDetail}. You can browse the menu, but ordering is unavailable right now.`
                : 'This restaurant isn’t accepting orders right now. You can still browse the menu.'}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          renderItem={({ item }) => <ProductCard product={item} browseOnly={outOfArea || closedNow} />}
          ListFooterComponent={storeId ? (
            <>
              {isFood ? <RestaurantReviews storeId={storeId} onSummary={setRating} /> : null}
              {/* Statutory info (FSSAI, registered address, disclaimer) — mirrors the website */}
              <RestaurantLegalFooter storeId={storeId} fallbackName={storeName} info={info} />
            </>
          ) : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name={filtersActive ? 'search-outline' : 'fast-food-outline'} size={56} color={colors.textMuted} />
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                {filtersActive ? 'Nothing matches — try clearing filters' : 'No items available right now'}
              </Text>
              {filtersActive && (
                <TouchableOpacity
                  style={[styles.clearBtn, { borderColor: colors.primary }]}
                  onPress={() => { setQuery(''); setSearch(''); setVegOnly(false); setNonVegOnly(false); setCategory(null); }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outBanner: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
  },
  outBannerBody: { flex: 1, minWidth: 0 },
  outBannerTitle: { fontSize: 14, fontWeight: '700' },
  outBannerText: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  outBannerLink: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  storeName: { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  storeMeta: { fontSize: FONTS.sizes.sm, marginTop: 1 },
  storeStatus: { fontSize: FONTS.sizes.sm, marginTop: 2 },
  typePill: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: FONTS.sizes.md, paddingVertical: 0 },
  chipRail: { paddingHorizontal: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, height: 32,
  },
  chipText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  vegSquare: { width: 12, height: 12, borderWidth: 1.5, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 120, paddingTop: SPACING.sm },
  row: { justifyContent: 'space-between' },
  empty: { fontSize: FONTS.sizes.md },
  clearBtn: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, marginTop: SPACING.sm },
});

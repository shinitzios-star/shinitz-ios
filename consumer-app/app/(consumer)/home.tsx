import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
// `router` (the module-level imperative API) is used by StoreResultRow, which is
// defined outside the screen component and so cannot call useRouter().
import { useRouter, useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProductCard } from '../../src/components/ProductCard';
import { SearchField } from '../../src/components/SearchField';
import { getPosition, getQuickFix, getPermissionState } from '../../src/utils/location';
import { ProductDetailModal } from '../../src/components/ProductDetailModal';
import { isStoreClosed, closedVeil, orderableFirst } from '../../src/utils/storeStatus';
import { FoodLoader } from '../../src/components/FoodLoader';
import { LocationPickerModal, type SavedAddress } from '../../src/components/LocationPickerModal';
import { OfferAlert } from '../../src/components/OfferAlert';
import { RestaurantUnavailable } from '../../src/components/RestaurantUnavailable';
import { KiranaComingSoon } from '../../src/components/KiranaComingSoon';
import { useToast } from '../../src/components/Toast';
import { useAddressStore } from '../../src/store/addressStore';
import { useContentStore } from '../../src/store/contentStore';
import { currentLocationAddress } from '../../src/utils/address';
import { productsAPI, ordersAPI, serviceAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { useCartStore } from '../../src/store/cartStore';
import { useFavoritesStore } from '../../src/store/favoritesStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { derivePreferences, buildRecommended, buildOffers, searchFallback } from '../../src/utils/recommend';
import { useExitOnBack } from '../../src/hooks/useExitOnBack';

// Accents come from the active theme (colors.primary / primaryLight) so the
// whole consumer surface follows the brand green/gold palette in light AND dark.
const VEG_GREEN = '#0E8A4F';
const NONVEG_RED = '#E23744';

// Quick price-filter chips for the home grid.
const PRICE_FILTERS: { label: string; max: number }[] = [
  { label: 'Under ₹49', max: 49 },
  { label: 'Under ₹79', max: 79 },
  { label: 'Under ₹99', max: 99 },
  { label: 'Under ₹199', max: 199 },
];

// Best-effort icon for a free-form category name. Category chips are data-driven
// (the exact strings vary by store), so we map by keyword and fall back to a tag.
const CATEGORY_ICON_RULES: { re: RegExp; icon: keyof typeof Ionicons.glyphMap }[] = [
  { re: /pizza|burger|fries|fast|snack/i, icon: 'fast-food' },
  { re: /biryani|rice|thali|meal|lunch|dinner|north|south|tandoor/i, icon: 'restaurant' },
  { re: /chinese|noodle|hakka|momo/i, icon: 'restaurant' },
  { re: /dessert|sweet|cake|ice|mithai|bakery|bread/i, icon: 'ice-cream' },
  { re: /beverage|drink|juice|tea|coffee|shake|water/i, icon: 'cafe' },
  { re: /dairy|milk|curd|cheese|paneer/i, icon: 'water' },
  { re: /veg|fruit|fresh|produce/i, icon: 'leaf' },
  { re: /personal|care|beauty|hygiene/i, icon: 'body' },
  { re: /house|home|clean/i, icon: 'home' },
  { re: /cook|oil|spice|masala|essential|atta|flour|grain|pulse/i, icon: 'flame' },
];
function iconForCategory(name: string): keyof typeof Ionicons.glyphMap {
  for (const r of CATEGORY_ICON_RULES) if (r.re.test(name)) return r.icon;
  return 'pricetag';
}

// Veg / non-veg square indicator (Swiggy/Zomato style)
function VegMark({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? VEG_GREEN : NONVEG_RED;
  return (
    <View style={[styles.vegBox, { borderColor: c }]}>
      {isVeg
        ? <View style={[styles.vegDot, { backgroundColor: c }]} />
        : <View style={[styles.nonVegTri, { borderBottomColor: c }]} />}
    </View>
  );
}

/**
 * One restaurant row in search results.
 *
 * Out-of-range restaurants stay tappable — the customer can open the menu and
 * see what the place offers; ordering is refused by the backend and the store
 * page disables the controls. The badge is a calm neutral state, not an error:
 * the restaurant is a legitimate result, just not deliverable right now.
 */
const StoreResultRow = React.memo(({ store, colors }: { store: any; colors: any }) => {
  const out = store.serviceable === false;
  // Closed / switched off, per the backend's resolved availability (IST hours +
  // manual switch) — the badge must not read "Available" for a closed store.
  const shut = !out && store.accepting_orders === false;
  const muted = out || shut;
  return (
    <TouchableOpacity
      style={[styles.storeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={() => router.push({
        pathname: '/(consumer)/store' as any,
        params: {
          storeId: store.store_id, storeName: store.store_name,
          storeType: store.store_type || 'restaurant',
        },
      })}
    >
      <View style={[styles.storeThumb, { backgroundColor: colors.background }, out && { opacity: 0.55 }]}>
        {store.image ? (
          <ExpoImage source={store.image} style={styles.storeThumbImg} contentFit="cover"
            cachePolicy="memory-disk" transition={200} recyclingKey={store.store_id} />
        ) : (
          <Ionicons name="restaurant" size={22} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.storeRowBody}>
        <Text style={[styles.storeRowName, { color: colors.text }, out && { opacity: 0.7 }]} numberOfLines={1}>
          {store.store_name}
        </Text>

        <View style={styles.storeRowMeta}>
          {typeof store.rating === 'number' && (
            <>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={[styles.storeRowMetaText, { color: colors.textSecondary }]}>
                {store.rating.toFixed(1)}
              </Text>
              <Text style={[styles.storeRowMetaText, { color: colors.textMuted }]}>·</Text>
            </>
          )}
          <Text style={[styles.storeRowMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {store.item_count ? `${store.item_count} items` : 'Menu coming soon'}
            {store.distance != null ? ` · ${store.distance} km` : ''}
          </Text>
        </View>

        {out ? (
          <Text style={[styles.storeRowOut, { color: colors.textSecondary }]} numberOfLines={2}>
            Outside your delivery area — this restaurant isn&apos;t delivering to your location.
          </Text>
        ) : store.accepting_orders === false ? (
          <Text style={[styles.storeRowOut, { color: colors.textSecondary }]} numberOfLines={1}>
            {store.availability?.customer_label || 'Currently unavailable'}
          </Text>
        ) : null}
      </View>

      <View style={[
        styles.storeBadge,
        muted
          ? { backgroundColor: colors.textMuted + '1A' }
          : { backgroundColor: (colors.success || '#2D5016') + '1A' },
      ]}>
        <Text style={[
          styles.storeBadgeText,
          { color: muted ? colors.textSecondary : (colors.success || '#2D5016') },
        ]}>
          {out ? 'Outside range'
            : shut ? (store.availability?.state === 'closed' ? 'Closed' : 'Unavailable')
              : 'Available'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});
StoreResultRow.displayName = 'StoreResultRow';

// Compact horizontal "Meals under ₹99" card. Reuses the cart store so the + / −
// controls behave exactly like the main grid cards.
const MealCard = React.memo(({ product }: { product: any }) => {
  const { colors } = useTheme();
  // Narrow subscriptions — this card re-renders when ITS quantity changes,
  // not when any other card touches the cart.
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const quantity = useCartStore(
    (s) => s.items.find((i) => i.product_id === product.id)?.quantity ?? 0);
  const hasDiscount = typeof product.mrp === 'number' && product.mrp > product.price;
  const popular = (product.rating ?? 0) >= 4;
  // Restaurant closed / switched off (backend-resolved) → no Add, say when it opens.
  const veil = isStoreClosed(product) ? closedVeil(product) : null;
  // Tapping the card (image or details) opens the same detail sheet as the grid.
  const [showDetail, setShowDetail] = useState(false);
  const openDetail = () => setShowDetail(true);

  return (
    <View style={styles.mealCard}>
      <View style={styles.mealImgWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openDetail}
          style={[styles.mealImgClip, { backgroundColor: colors.surface }]}
        >
          {product.image ? (
            <ExpoImage
              source={product.image}
              style={styles.mealImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={product.id}
            />
          ) : (
            <View style={styles.mealImgEmpty}>
              <Ionicons name="fast-food-outline" size={34} color={colors.textMuted} />
            </View>
          )}
          {popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
          {typeof product.rating === 'number' && (
            <View style={styles.mealRating}>
              <Ionicons name="star" size={10} color="#fff" />
              <Text style={styles.mealRatingText}>{product.rating.toFixed(1)}</Text>
            </View>
          )}
          {veil && (
            <View style={styles.mealVeil} pointerEvents="none">
              <Text style={styles.mealVeilTitle}>{veil.title}</Text>
              {veil.detail ? <Text style={styles.mealVeilDetail}>{veil.detail}</Text> : null}
            </View>
          )}
        </TouchableOpacity>

        {veil ? null : quantity > 0 ? (
          <View style={[styles.mealQty, { borderColor: colors.primary }]}>
            <TouchableOpacity
              onPress={() => (quantity > 1 ? updateQuantity(product.id, quantity - 1) : removeItem(product.id))}
              hitSlop={6}
            >
              <Ionicons name="remove" size={16} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.mealQtyText, { color: colors.primary }]}>{quantity}</Text>
            <TouchableOpacity onPress={() => updateQuantity(product.id, quantity + 1)} hitSlop={6}>
              <Ionicons name="add" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.mealAdd, { borderColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={() =>
              addItem({
                product_id: product.id, name: product.name, price: product.price,
                image: product.image, store_name: product.store_name, store_id: product.store_id,
              })
            }
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={openDetail} style={styles.mealInfo}>
        {!!product.store_name && (
          <Text style={[styles.mealStore, { color: colors.textSecondary }]} numberOfLines={1}>
            {product.store_name}
          </Text>
        )}
        <View style={styles.mealNameRow}>
          {typeof product.is_veg === 'boolean' && <VegMark isVeg={!!product.is_veg} />}
          <Text style={[styles.mealName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
        </View>
        <View style={styles.mealPriceRow}>
          {hasDiscount && <Text style={[styles.mealMrp, { color: colors.textMuted }]}>₹{product.mrp}</Text>}
          <Text style={[styles.mealPrice, { color: hasDiscount ? colors.primary : colors.text }]}>₹{product.price}</Text>
        </View>
      </TouchableOpacity>

      <ProductDetailModal
        productId={product.id}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        initial={product}
      />
    </View>
  );
});
MealCard.displayName = 'MealCard';

export default function HomeScreen() {
  useExitOnBack();
  const { user } = useAuthStore();
  const { getItemCount, getTotal } = useCartStore();
  const { loadFromStorage: loadFavorites, favorites } = useFavoritesStore();
  const { selected: selAddr, setSelected: setSelAddr, ensureSelected } = useAddressStore();
  const { content, load: loadContent } = useContentStore();
  // Backend copy with i18n fallback — admin can override without an app update.
  const cx = (key: string, fallback: string) => content[key] || fallback;
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Exact height of the bottom tab bar (incl. safe-area inset) so the floating
  // "View Cart" bar sits right above the nav bar on every device.
  const tabBarHeight = useBottomTabBarHeight();

  // (Category chips are derived from the live catalogue — see `dynamicCategories`.)

  // Top-level section: which kind of store the user wants to order from.
  //   'all'        → everything   |  'restaurant' → Food  |  'kirana' → Grocery
  const SECTIONS = useMemo(() => [
    { id: 'restaurant', label: t('sectionFood'),   icon: 'restaurant' as const },
    { id: 'kirana',     label: t('sectionKirana'), icon: 'storefront' as const },
  ], [t]);

  // 'all' kept in the union for existing logic comparisons, but it's no longer a
  // selectable tab — the home now opens on Food and toggles Food ⇄ Kirana.
  const [section, setSection] = useState<'all' | 'restaurant' | 'kirana'>('restaurant');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  // The search text lives inside <SearchField> (see below): keeping it here
  // re-rendered this entire screen on every keystroke. Home only ever sees the
  // debounced query, which is what actually drives the fetch.
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState(t('detectingLocation'));
  // null = unknown yet, true = stores nearby, false = no store within 5 km
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [serviceReason, setServiceReason] = useState<string | null>(null);
  // true while the catalogue fetch is FAILING (network/cold start) — an empty
  // list then means "couldn't load", never "nothing in your area".
  const [fetchFailed, setFetchFailed] = useState(false);
  const [notified, setNotified] = useState(false);
  const [showRefer, setShowRefer] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // Gate the first product fetch until location is resolved (avoids a flickery
  // double-load) and reveal the page only once data + images are warmed.
  const [locationTried, setLocationTried] = useState(false);
  // Monotonic id for product fetches — only the newest response is applied.
  const fetchSeqRef = useRef(0);
  const firstLoadRef = useRef(true);
  // Per-section catalogue cache (keyed by store_type). Lets a Food⇄Kirana toggle
  // swap instantly from memory while a background refetch refreshes it — and we
  // prefetch the *other* section up-front so even the first toggle is <1s.
  const sectionCacheRef = useRef<Record<string, any[]>>({});
  // Cached catalogues are keyed by section AND location (to ~110 m). Keyed by
  // section alone, a catalogue fetched in one place was served after the
  // customer moved: the explicit address-change handlers cleared it, but the GPS
  // refinement path (last-known fix -> precise fix) changes location without
  // clearing, so old-area restaurants could reappear. With location in the key,
  // ANY change of location is a cache miss, whichever code path caused it.
  const cacheKey = (sec: string, loc: { lat: number; lng: number } | null) =>
    loc ? `${sec}@${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}` : `${sec}@none`;

  // Veg Mode (from profile settings) hides explicit non-veg items.
  const vegMode = useSettingsStore((s) => s.vegMode);
  const setVegMode = useSettingsStore((s) => s.setVegMode);

  // ── Personalization + filters ──────────────────────────────────────────────
  // catalogue = the full section list (no category/search filter); it powers the
  // category chips, recommendations, offers and the search fallback independent
  // of the filtered grid. orders/history feed the progressive personalization.
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const { searches, viewed, addSearch, loadFromStorage: loadHistory } = useHistoryStore();

  // Service availability is STORE-based (any restaurant/kirana within 5 km),
  // not product-based — so a restaurant in range never shows "Not Available".
  const checkServiceAvailability = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await productsAPI.serviceAvailability(lat, lng);
      setServiceAvailable(!!res.data?.available);
      setServiceReason(res.data?.reason ?? null);
      if (res.data?.available) setNotified(false); // back in service → reset
    } catch {
      setServiceAvailable(null); // unknown → don't block the UI
      setServiceReason(null);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    // Location first. Without a delivery location there is nothing correct to
    // show: this used to fetch with no coordinates, and the backend answered
    // with every restaurant in the catalogue — which is how a customer who
    // denied location (or whose GPS failed) was shown Delhi restaurants from
    // anywhere in India. The screen asks them to choose a location instead.
    if (!location) {
      setProducts([]);
      setFetchFailed(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params: any = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (section !== 'all') params.store_type = section;
      if (searchQuery) params.search = searchQuery;
      if (location) { params.lat = location.lat; params.lng = location.lng; }

      const myRequest = ++fetchSeqRef.current;
      const response = await productsAPI.getAll(params);
      // A slower EARLIER request must never overwrite a newer one: switching
      // Food -> Kirana (or typing a new search) while the first is in flight
      // used to repaint the previous section's products over the new ones.
      if (myRequest !== fetchSeqRef.current) return;
      const data = response.data || [];
      setFetchFailed(false);
      setProducts(data);

      // Warm the first few remote images in the background — fire-and-forget so
      // the page reveals the instant data arrives (no artificial hold).
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        data
          .map((p: any) => p.image)
          .filter((u: any) => typeof u === 'string' && /^https?:/.test(u))
          .slice(0, 8)
          .forEach((u: string) => { ExpoImage.prefetch(u).catch(() => {}); });
      }
    } catch (error) {
      // A FAILED fetch is not an EMPTY area: without this flag, a timeout /
      // Render cold start / network blip left products=[] and the home showed
      // a false "Not Available In Your Area" — the shop just disappeared.
      setFetchFailed(true);
      if (__DEV__) console.warn('Error fetching products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, section, searchQuery, location]);

  // Self-heal: while the catalogue fetch is failing (typically a Render
  // cold-start ~30-60s), retry every 6s — the app recovers by itself the
  // moment the backend is reachable, no user action needed.
  useEffect(() => {
    if (!fetchFailed) return;
    const id = setTimeout(() => { fetchProducts(); }, 6000);
    return () => clearTimeout(id);
  }, [fetchFailed, fetchProducts]);

  const getLocation = async () => {
    try {
      // Paint whatever we already know straight away — the device's cached fix
      // or the last one we stored — so the feed is never blank while GPS
      // works. Discovery needs SOME valid location far more than it needs a
      // perfect one.
      const quick = await getQuickFix();
      if (quick) {
        setLocation({ lat: quick.lat, lng: quick.lng });
        setLocationTried(true);
        checkServiceAvailability(quick.lat, quick.lng);
      }

      // Then the real thing: bounded wait, validated, with its own fallbacks.
      const fix = await getPosition({ timeoutMs: 10000 });
      if (!fix) {
        // Nothing usable anywhere — say which wall we hit, so the customer
        // knows whether to turn something on or just pick a place.
        const { granted, servicesEnabled } = await getPermissionState();
        setLocationName(
          !granted ? t('locationNotAvailable')
            : !servicesEnabled ? 'Location is off'
              : t('locationUnavailable'));
        return;
      }
      setLocation({ lat: fix.lat, lng: fix.lng });
      checkServiceAvailability(fix.lat, fix.lng);
      const [address] = await Location.reverseGeocodeAsync({
        latitude: fix.lat, longitude: fix.lng,
      });
      if (address) {
        const label = `${address.district || address.city}, ${address.postalCode || ''}`;
        // A remembered position is not where they are standing — say so rather
        // than labelling it as the live one.
        setLocationName(fix.source === 'stored' ? `${label} (last known)` : label);
      }
    } catch {
      setLocationName(t('locationUnavailable'));
    } finally {
      setLocationTried(true);
    }
  };

  useEffect(() => {
    loadFavorites();
    loadContent();
    // Prefer the user's chosen delivery address (persisted / server default) so
    // Home, Cart and Checkout all center on the same place. Only fall back to
    // raw GPS when no address has been chosen yet.
    (async () => {
      const sel = await ensureSelected();
      if (sel && sel.lat != null && sel.lng != null) {
        setLocation({ lat: sel.lat, lng: sel.lng });
        setLocationName(sel.full_address || sel.label || '');
        checkServiceAvailability(sel.lat, sel.lng);
        setLocationTried(true);
      } else {
        getLocation();
      }
    })();
    // Safety net for a GPS request that never answers, so the loader can't stick
    // forever. It used to fire at 1.5 s and fetch WITHOUT a location — which
    // returned every restaurant everywhere. Discovery now needs a location, so
    // on expiry the customer is asked to choose one; the wait is long enough
    // that an ordinary slow GPS fix doesn't flash that prompt first. (A denied
    // permission resolves immediately and never waits for this.)
    const safety = setTimeout(() => setLocationTried(true), 8000);
    return () => clearTimeout(safety);
  }, []);

  // Fetch only AFTER location is resolved (or timed out) so the first load is
  // location-aware — then on later filter/search changes it refetches normally.
  useEffect(() => {
    if (locationTried) fetchProducts();
  }, [fetchProducts, locationTried]);

  // Load on-device history (searches + views) once.
  useEffect(() => { loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Record each committed search for personalization.
  useEffect(() => { if (searchQuery) addSearch(searchQuery); }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full section catalogue — refetched only when the section or location changes
  // (NOT on every keystroke/category), so recommendations + fallback stay stable
  // while the user searches or filters.
  useEffect(() => {
    if (!locationTried) return;
    // No location, no catalogue — see fetchProducts.
    if (!location) { setCatalogue([]); return; }
    const params: any = { lat: location.lat, lng: location.lng };
    if (section !== 'all') params.store_type = section;
    const key = cacheKey(section, location);
    productsAPI.getAll(params).then((r) => {
      const data = r.data || [];
      setCatalogue(data);
      sectionCacheRef.current[key] = data; // warm the cache for instant re-entry
    }).catch(() => setCatalogue([]));
  }, [section, location, locationTried]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch the OTHER section's catalogue in the background so the very first
  // Food⇄Kirana toggle is instant (no network wait on Render's cold start).
  useEffect(() => {
    if (!locationTried || section === 'all' || !location) return;
    const other = section === 'kirana' ? 'restaurant' : 'kirana';
    const key = cacheKey(other, location);
    if (sectionCacheRef.current[key]) return; // already warm FOR THIS LOCATION
    const params: any = { store_type: other, lat: location.lat, lng: location.lng };
    productsAPI.getAll(params)
      .then((r) => { sectionCacheRef.current[key] = r.data || []; })
      .catch(() => {});
  }, [section, location, locationTried]); // eslint-disable-line react-hooks/exhaustive-deps

  // Orders power "Recommended For You" — refetch on focus so picks refresh after
  // a purchase (the user returns to Home from checkout).
  useFocusEffect(
    useCallback(() => {
      ordersAPI.getAll().then((r) => setOrders(r.data || [])).catch(() => setOrders([]));
    }, []),
  );


  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  // Instant Food⇄Kirana switch: paint the cached section immediately (no
  // full-screen loader), reset filters, and let the effects refetch in the
  // background. Only the very first visit to an un-prefetched section shows the
  // loader; after that every toggle is sub-second.
  const switchSection = useCallback((next: 'restaurant' | 'kirana') => {
    if (next === section) return;
    setSelectedCategory('all');
    setPriceMax(null);
    if (searchQuery) setSearchQuery('');   // SearchField clears with its key
    const cached = sectionCacheRef.current[cacheKey(next, location)];
    if (cached) {
      setProducts(cached);
      setCatalogue(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setSection(next);
  }, [section, searchQuery, location]);

  // Pick a saved address from the location sheet. Addresses don't store
  // coordinates, so geocode the text to recenter the feed; show the address
  // immediately for responsiveness while the geocode resolves.
  const handlePickAddress = useCallback(async (addr: SavedAddress) => {
    let lat = addr.lat ?? null;
    let lng = addr.lng ?? null;
    if (lat == null || lng == null) {
      try {
        const geo = await Location.geocodeAsync(addr.full_address);
        if (geo && geo[0]) { lat = geo[0].latitude; lng = geo[0].longitude; }
      } catch {
        // handled below
      }
    }
    if (lat == null || lng == null) {
      // The address couldn't be placed on the map. Previously the header still
      // switched to the NEW address while the list stayed on the OLD location —
      // so a customer could read "Jaipur" above a list of Delhi restaurants.
      // Keep everything on the location we can actually vouch for instead.
      Alert.alert(
        "Couldn't find that address",
        'We could not place this address on the map. Please edit it, or choose your location on the map.',
      );
      return;
    }
    // Label, selection, list and cache all move together, or not at all.
    setLocationName(addr.full_address);
    // Publish as the selected delivery address so Cart/Checkout reuse it.
    await setSelAddr({ id: addr.id, label: addr.label, full_address: addr.full_address, lat, lng });
    // New area → drop cached sections so they re-warm for this location.
    sectionCacheRef.current = {};
    setLocation({ lat, lng });
    checkServiceAvailability(lat, lng);
  }, [checkServiceAvailability, setSelAddr]);

  // "Use current location" from the home sheet — set it as the delivery address
  // and recenter discovery on it.
  const handleUseCurrentLocation = useCallback(async () => {
    const cur = await currentLocationAddress();
    if (!cur) { getLocation(); return; }
    await setSelAddr(cur);
    setLocationName(cur.full_address);
    if (cur.lat != null && cur.lng != null) {
      sectionCacheRef.current = {};
      setLocation({ lat: cur.lat, lng: cur.lng });
      checkServiceAvailability(cur.lat, cur.lng);
      setLocationTried(true);
    }
  }, [checkServiceAvailability, setSelAddr]);

  // "Notify me when available" → join the waiting list for this area.
  const handleNotify = useCallback(async () => {
    try {
      await productsAPI.notifyService({
        address: selAddr?.full_address || locationName,
        lat: location?.lat ?? selAddr?.lat ?? null,
        lng: location?.lng ?? selAddr?.lng ?? null,
        pincode: null,
      });
      setNotified(true);
    } catch {
      // best-effort; the button stays tappable so the user can retry
    }
  }, [selAddr, locationName, location]);

  // Kirana waitlist — notify me when grocery stores launch in this area.
  const [kiranaNotified, setKiranaNotified] = useState(false);
  const handleNotifyKirana = useCallback(async () => {
    try {
      await productsAPI.notifyService({
        address: selAddr?.full_address || locationName,
        lat: location?.lat ?? selAddr?.lat ?? null,
        lng: location?.lng ?? selAddr?.lng ?? null,
        pincode: null,
        category: 'kirana',
      });
      setKiranaNotified(true);
    } catch {
      // best-effort; button stays tappable so the user can retry
    }
  }, [selAddr, locationName, location]);

  // Restaurant waitlist + "Browse Menu" view-only mode (delivery unavailable).
  const [restaurantNotified, setRestaurantNotified] = useState(false);
  const [browseOnly, setBrowseOnly] = useState(false);
  const handleNotifyRestaurant = useCallback(async () => {
    try {
      await productsAPI.notifyService({
        address: selAddr?.full_address || locationName,
        lat: location?.lat ?? selAddr?.lat ?? null,
        lng: location?.lng ?? selAddr?.lng ?? null,
        pincode: null,
        category: 'restaurant',
      });
      setRestaurantNotified(true);
    } catch {
      // best-effort
    }
  }, [selAddr, locationName, location]);
  const handleBrowseMenu = useCallback(() => { setBrowseOnly(true); fetchProducts(); }, [fetchProducts]);

  // Re-check serviceability at the current location (Refresh / pull-to-refresh).
  const recheckService = useCallback(() => {
    setRefreshing(true);
    const ll = location || (selAddr?.lat != null && selAddr?.lng != null ? { lat: selAddr.lat, lng: selAddr.lng } : null);
    if (ll) checkServiceAvailability(ll.lat, ll.lng);
    fetchProducts();
  }, [location, selAddr, checkServiceAvailability, fetchProducts]);

  const cartCount = getItemCount();
  const cartTotal = getTotal();

  // No store within the 5 km service radius → show the full-screen
  // "Service Not Available" state. STORE-based (any restaurant/kirana in range),
  // not product-based — a restaurant in range never triggers this, even if it
  // hasn't added items yet.
  const noService = !!location && serviceAvailable === false;

  // Kirana vertical has no stores/products in range yet → show the animated
  // "Coming Soon" page instead of an empty grocery grid. Auto-clears the moment
  // kirana products load (products becomes non-empty).
  // A CONFIRMED empty area only — never while the fetch is failing, or a cold
  // start / network blip would masquerade as "Not Available In Your Area".
  const kiranaEmpty = section === 'kirana' && !!location && !fetchFailed && !loading && !refreshing && !searchQuery && products.length === 0;

  // Restaurant vertical has no restaurants in range → premium "Not Available"
  // splash (unless the user chose Browse Menu to view-only).
  // No delivery location yet (permission denied, GPS failed, or nothing chosen).
  // This is NOT "not available in your area" — we don't know the area — so it
  // gets its own screen asking the customer to choose one.
  const needsLocation = locationTried && !location && !loading;
  const restaurantEmpty = section === 'restaurant' && !needsLocation && !!location && !browseOnly && !fetchFailed && !loading && !refreshing && !searchQuery && products.length === 0;

  // Fetch failing with nothing cached → honest "connecting" state (auto-retries).
  const connectionTrouble = fetchFailed && !loading && !refreshing && products.length === 0;

  const shownProducts = useMemo(
    () => (vegMode ? products.filter((p) => p.is_veg !== false) : products),
    [products, vegMode],
  );

  // "Meals under ₹99" rail — featured slice of the catalogue (also stays in the
  // full grid below, the way Zomato surfaces a highlights row + full list).
  const cheapMeals = useMemo(
    () => orderableFirst(shownProducts.filter((p) => typeof p.price === 'number' && p.price <= 99)).slice(0, 12),
    [shownProducts],
  );

  // Price-filter chips apply to the main grid in real time.
  const gridProducts = useMemo(
    () => (priceMax == null ? shownProducts : shownProducts.filter((p) => typeof p.price === 'number' && p.price <= priceMax)),
    [shownProducts, priceMax],
  );

  // Category chips derived from the section's REAL catalogue → Food shows only
  // food categories, Kirana only grocery; no cross-section leakage, and tapping
  // a chip always returns results (the value exists in the data).
  const dynamicCategories = useMemo(() => {
    const seen = new Set<string>();
    const cats: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
      { id: 'all', label: t('catAll'), icon: 'grid' },
    ];
    for (const p of catalogue) {
      const c = (p.category || '').trim();
      const key = c.toLowerCase();
      if (c && key !== 'general' && !seen.has(key)) {
        seen.add(key);
        cats.push({ id: c, label: c, icon: iconForCategory(c) });
      }
    }
    return cats;
  }, [catalogue, t]);

  // Progressive personalization: cold start ranks by default (joined-first +
  // rating); rails shift to tailored picks as orders/searches/views accumulate.
  const vegCatalogue = useMemo(
    () => (vegMode ? catalogue.filter((p) => p.is_veg !== false) : catalogue),
    [catalogue, vegMode],
  );
  const prefs = useMemo(
    () => derivePreferences({ orders, favorites, viewed, searches, products: catalogue }),
    [orders, favorites, viewed, searches, catalogue],
  );
  // Rails lead with dishes that can be ordered right now; a closed restaurant's
  // dishes stay visible (greyed, with its opening time) after them.
  const recommended = useMemo(() => orderableFirst(buildRecommended(vegCatalogue, prefs, 12)), [vegCatalogue, prefs]);
  const offers = useMemo(() => orderableFirst(buildOffers(vegCatalogue, prefs, 12)), [vegCatalogue, prefs]);
  const fallbackItems = useMemo(() => searchFallback(vegCatalogue, 12), [vegCatalogue]);

  // Discovery rails only on the clean default view — hidden while searching,
  // price-filtering, or browsing a specific category (then the grid is focused).
  // Stable across renders: an inline closure here makes FlatList re-render its
  // cells every time anything on this screen changes.
  const renderProduct = useCallback(
    ({ item }: { item: any }) => <ProductCard product={item} browseOnly={browseOnly} />,
    [browseOnly],
  );

  const showRails = !searchQuery && priceMax == null && selectedCategory === 'all';

  // Nearby restaurants (each with its own menu) — restaurant-first browsing.
  // Nearby restaurants for the rails, AND restaurant matches while searching.
  // Search used to clear this list, which is why searching a restaurant by name
  // never showed the restaurant itself. The backend returns out-of-range matches
  // too (flagged serviceable:false) but only for an explicit search.
  const [stores, setStores] = useState<any[]>([]);
  useEffect(() => {
    if (!location || section === 'kirana') { setStores([]); return; }
    productsAPI
      .getStores({
        lat: location.lat, lng: location.lng, store_type: 'restaurant',
        ...(searchQuery ? { search: searchQuery } : {}),
      })
      .then((r) => setStores(r.data?.data || []))
      .catch(() => setStores([]));
  }, [location, section, searchQuery]);

  // Deliverable matches first; the backend already sorts this way, but the split
  // is what the search UI renders as two distinct groups.
  const searchStores = useMemo(
    () => (searchQuery ? stores : []),
    [searchQuery, stores],
  );
  const inRangeStores = useMemo(
    () => searchStores.filter((s) => s.serviceable !== false),
    [searchStores],
  );
  const outOfRangeStores = useMemo(
    () => searchStores.filter((s) => s.serviceable === false),
    [searchStores],
  );

  const cityShort = (locationName || '').split(',')[0] || locationName;
  // Pill shows the chosen delivery address when there is one, else the GPS label.
  const pillTitle = selAddr?.label || cityShort;
  const pillAddr = selAddr?.full_address || locationName;

  // ─── Pink gradient header (location + search + promo) — always on top ────────
  const Header = (
    <LinearGradient
      colors={[colors.primary, colors.primaryLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.pinkHeader, { paddingTop: insets.top + SPACING.sm }]}
    >
      {/* Location pill + hamburger */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.locPill} activeOpacity={0.8} onPress={() => setShowLocationPicker(true)}>
          <View style={styles.locIcon}>
            <Ionicons name="location" size={22} color="#1a1a1a" />
          </View>
          <View style={styles.locTextCol}>
            <View style={styles.locRowTop}>
              <Text style={styles.locTitle} numberOfLines={1}>{pillTitle}</Text>
              <Ionicons name="chevron-down" size={18} color="#fff" />
            </View>
            <Text style={styles.locAddr} numberOfLines={1}>{pillAddr}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hamburger} onPress={() => router.push('/(consumer)/notifications' as any)}>
          <Ionicons name="notifications-outline" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.hamburger} onPress={() => router.push('/(consumer)/profile')}>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search + VEG toggle */}
      <View style={styles.searchRow}>
        {/* `key` remounts the field when the section changes, which is how the
            box clears itself when Food/Kirana is switched. */}
        <SearchField
          key={section}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor={colors.primary}
          placeholder={t('searchProducts')}
          onSearch={setSearchQuery}
        />

        <TouchableOpacity
          style={styles.vegToggle}
          activeOpacity={0.85}
          onPress={() => setVegMode(!vegMode)}
        >
          <Text style={styles.vegLabel}>VEG</Text>
          <View style={[styles.vegSwitch, { backgroundColor: vegMode ? VEG_GREEN : '#cfd3d7', alignItems: vegMode ? 'flex-end' : 'flex-start' }]}>
            <View style={styles.vegKnob} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Premium tagline — backend-controlled, falls back to the i18n string */}
      <Text style={styles.lowestPrice}>{cx('home_tagline', t('lowestPriceGuaranteed'))}</Text>
    </LinearGradient>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      {Header}

      {loading ? (
        <View style={styles.fullLoader}>
          <FoodLoader size={58} label={t('gettingFreshFood')} />
        </View>
      ) : needsLocation ? (
        // Never assume a city. The customer chooses where they want delivery,
        // and every list on this screen is then built from that location.
        <View style={styles.fullLoader}>
          <View style={[styles.locPromptIcon, { backgroundColor: colors.primary + '14' }]}>
            <Ionicons name="location-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.locPromptTitle, { color: colors.text }]}>
            Select your delivery location
          </Text>
          <Text style={[styles.locPromptBody, { color: colors.textSecondary }]}>
            Choose a location to see restaurants available for delivery near you.
          </Text>
          <TouchableOpacity
            onPress={() => setShowLocationPicker(true)}
            style={[styles.locPromptBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.locPromptBtnText}>Choose location</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => getLocation()} style={{ marginTop: 14 }} activeOpacity={0.7}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13.5 }}>
              Use my current location
            </Text>
          </TouchableOpacity>
        </View>
      ) : connectionTrouble ? (
        // Backend unreachable (cold start / network) — keep retrying, never
        // pretend the area is unserviceable.
        <View style={styles.fullLoader}>
          <Ionicons name="cloud-offline-outline" size={54} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 14, textAlign: 'center' }}>
            Connecting to Shinitz…
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13.5, marginTop: 6, textAlign: 'center', paddingHorizontal: 36 }}>
            Waking the kitchen up — this can take up to a minute. We’ll keep retrying automatically.
          </Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); fetchProducts(); }}
            style={{ marginTop: 18, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 11 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14.5 }}>Retry now</Text>
          </TouchableOpacity>
        </View>
      ) : restaurantEmpty ? (
        <RestaurantUnavailable
          areaName={pillAddr || locationName}
          refreshing={refreshing}
          notified={restaurantNotified}
          onBrowseMenu={handleBrowseMenu}
          onNotify={handleNotifyRestaurant}
          onRefresh={recheckService}
          onChangeAddress={() => setShowLocationPicker(true)}
        />
      ) : kiranaEmpty ? (
        <KiranaComingSoon
          areaName={pillAddr || locationName}
          refreshing={refreshing}
          notified={kiranaNotified}
          onNotify={handleNotifyKirana}
          onRefresh={recheckService}
          onBackToFood={() => switchSection('restaurant')}
          onChangeAddress={() => setShowLocationPicker(true)}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {browseOnly && (
            <View style={styles.browseBanner}>
              <Ionicons name="information-circle" size={16} color="#1a1a1a" />
              <Text style={styles.browseBannerText}>Delivery service is not yet available in your area.</Text>
            </View>
          )}
          {/* Food animation while pulling to refresh (replaces the default circle) */}
          {refreshing && (
            <View style={styles.refreshOverlay} pointerEvents="none">
              <FoodLoader size={38} />
            </View>
          )}
          <FlatList
            data={gridProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.productsRow}
            contentContainerStyle={[
              styles.productsList,
              // Clear the tab bar + the floating cart bar so the last row of
              // products is never hidden behind them.
              { paddingBottom: tabBarHeight + (cartCount > 0 ? 96 : 24) },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="transparent"
                colors={['transparent']}
                progressBackgroundColor="transparent"
              />
            }
            renderItem={renderProduct}
            ListHeaderComponent={
              <>
                {/* Section toggle — Food vs Kirana vs everything */}
                <View style={styles.sectionRow}>
                  {SECTIONS.map((s) => {
                    const active = section === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.85}
                        onPress={() => switchSection(s.id as 'restaurant' | 'kirana')}
                        style={[
                          styles.sectionTab,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons name={s.icon} size={16} color={active ? '#fff' : colors.primary} />
                        <Text style={[styles.sectionTabText, { color: active ? '#fff' : colors.text }]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Quick price filters */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.priceRow}
                >
                  {PRICE_FILTERS.map((f) => {
                    const active = priceMax === f.max;
                    return (
                      <TouchableOpacity
                        key={f.max}
                        activeOpacity={0.85}
                        onPress={() => setPriceMax(active ? null : f.max)}
                        style={[styles.priceChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                      >
                        <Text style={[styles.priceChipText, { color: active ? '#fff' : colors.text }]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Category circles (data-driven per section) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.catRow}
                >
                  {dynamicCategories.map((cat) => {
                    const active = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.catItem}
                        activeOpacity={0.8}
                        onPress={() => setSelectedCategory(cat.id)}
                      >
                        <View
                          style={[
                            styles.catCircle,
                            { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
                          ]}
                        >
                          <Ionicons name={cat.icon} size={26} color={active ? '#fff' : colors.primary} />
                        </View>
                        <Text
                          style={[styles.catLabel, { color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '800' : '600' }]}
                          numberOfLines={1}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Recommended For You — personalized, with a sensible cold-start default */}
                {showRails && recommended.length > 0 && (
                  <View style={styles.railSection}>
                    <View style={styles.sectionHead}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>{cx('rail_recommended', t('recommendedForYou'))}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealsRow}>
                      {recommended.map((m) => <MealCard key={m.id} product={m} />)}
                    </ScrollView>
                  </View>
                )}

                {/* Personalized Offers — discounted items, preference-ranked */}
                {showRails && offers.length > 0 && (
                  <View style={styles.railSection}>
                    <View style={styles.sectionHead}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>{cx('rail_offers', t('personalizedOffers'))}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealsRow}>
                      {offers.map((m) => <MealCard key={m.id} product={m} />)}
                    </ScrollView>
                  </View>
                )}

                {/* Meals under ₹99 */}
                {showRails && cheapMeals.length > 0 && (
                  <View style={styles.railSection}>
                    <View style={styles.sectionHead}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>{cx('rail_cheap', t('mealsUnder99'))}</Text>
                      <TouchableOpacity
                        style={styles.seeAll}
                        onPress={() => setSelectedCategory('all')}
                      >
                        <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('seeAll')}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealsRow}>
                      {cheapMeals.map((m) => <MealCard key={m.id} product={m} />)}
                    </ScrollView>
                  </View>
                )}

                {/* ── Restaurants matching the search ──────────────────────
                    Shown for an explicit search only. Out-of-range matches are
                    listed after the deliverable ones and clearly labelled, so a
                    customer who searched a restaurant by name learns it exists
                    but doesn't deliver here — instead of concluding Shinitz
                    doesn't have it. */}
                {searchQuery.length > 0 && searchStores.length > 0 && (
                  <View style={styles.railSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }]}>
                      {t('restaurants') || 'Restaurants'}
                    </Text>

                    {inRangeStores.map((s) => (
                      <StoreResultRow key={s.store_id} store={s} colors={colors} />
                    ))}

                    {outOfRangeStores.length > 0 && (
                      <>
                        <Text style={[styles.outOfAreaHeading, { color: colors.textSecondary }]}>
                          {t('outsideDeliveryArea') || 'Outside your delivery area'}
                        </Text>
                        {outOfRangeStores.map((s) => (
                          <StoreResultRow key={s.store_id} store={s} colors={colors} />
                        ))}
                        {inRangeStores.length === 0 && (
                          <Text style={[styles.outOfAreaHint, { color: colors.textMuted }]}>
                            {t('exploreNearbyHint')
                              || 'These restaurants are outside your delivery range. Explore restaurants available near you below.'}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Popular Brands (nearby restaurants) */}
                {showRails && stores.length > 0 && (
                  <View style={styles.railSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }]}>
                      {cx('rail_brands', t('popularBrands'))}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandsRow}>
                      {stores.map((s) => (
                        <TouchableOpacity
                          key={s.store_id}
                          style={styles.brandItem}
                          activeOpacity={0.85}
                          onPress={() => router.push({
                            pathname: '/(consumer)/store' as any,
                            params: { storeId: s.store_id, storeName: s.store_name, storeType: s.store_type || 'restaurant' },
                          })}
                        >
                          <View style={[styles.brandCircle, { backgroundColor: colors.surface, borderColor: colors.border }, s.open_now === false && { opacity: 0.5 }]}>
                            {s.image ? (
                              <ExpoImage
                                source={s.image}
                                style={styles.brandImg}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={200}
                                recyclingKey={s.store_id}
                              />
                            ) : (
                              <Ionicons name="restaurant" size={26} color={colors.textMuted} />
                            )}
                          </View>
                          <Text style={[styles.brandName, { color: colors.textSecondary }]} numberOfLines={1}>{s.store_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Full catalogue header */}
                {gridProducts.length > 0 && (
                  <View style={styles.listHeaderRow}>
                    <Text style={[styles.itemCount, { color: colors.text }]}>
                      {priceMax != null
                        ? t('underPriceCount', { count: gridProducts.length, price: priceMax })
                        : t('allItemsCount', { count: gridProducts.length })}
                    </Text>
                    {vegMode && (
                      <View style={[styles.vegPill, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="leaf" size={12} color={colors.success} />
                        <Text style={[styles.vegPillText, { color: colors.success }]}>{t('vegOnly')}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            }
            ListEmptyComponent={
              searchQuery && fallbackItems.length > 0 ? (
                // Smart fallback — never a blank search page.
                <View style={styles.fallbackWrap}>
                  <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                  <Text style={[styles.fallbackTitle, { color: colors.text }]}>
                    No {searchQuery} available near your location
                  </Text>
                  <Text style={[styles.fallbackSub, { color: colors.textSecondary }]}>
                    Try another dish or change your delivery location. Available near you:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.fallbackScroll}
                    contentContainerStyle={styles.fallbackRow}
                  >
                    {fallbackItems.map((m) => <MealCard key={m.id} product={m} />)}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name={searchQuery ? 'search-outline' : 'basket-outline'} size={64} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    {searchQuery
                      ? `No ${searchQuery} available near your location`
                      : priceMax != null ? t('nothingUnder', { price: priceMax }) : t('noProductsFound')}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    {searchQuery
                      ? 'Try another dish or change your delivery location.'
                      : t('tryDifferentCategory')}
                  </Text>
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setShowLocationPicker(true)} style={{ marginTop: 14 }} activeOpacity={0.7}>
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>Change delivery location</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            }
          />
        </View>
      )}

      {/* Animated promotional offer alert (self-gating) */}
      {!noService && <OfferAlert />}

      {/* Location selector bottom sheet */}
      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
        onPickAddress={handlePickAddress}
        onAddNew={() => router.push('/(consumer)/addresses')}
      />

      {/* Refer & Earn floating badge */}
      {showRefer && !noService && (
        <View style={[styles.referWrap, { bottom: tabBarHeight + (cartCount > 0 ? 84 : 12) }]}>
          <TouchableOpacity style={styles.referClose} onPress={() => setShowRefer(false)} hitSlop={8}>
            <Ionicons name="close" size={14} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.referCircle}
            activeOpacity={0.85}
            onPress={() => router.push('/(consumer)/refer' as any)}
          >
            <Text style={styles.referTop}>{cx('refer_badge_title', 'REFER & EARN')}</Text>
            <Ionicons name="gift" size={20} color="#fff" />
            <Text style={styles.referBottom}>{cx('refer_badge_subtitle', 'EARN ₹50')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Footer */}
      {cartCount > 0 && (
        <View style={[styles.cartFooter, { backgroundColor: colors.primary, bottom: tabBarHeight + SPACING.sm }]}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartCount}>
              {t(cartCount === 1 ? 'itemsCountOne' : 'itemsCount', { count: cartCount })}
            </Text>
            <Text style={styles.cartTotal}>₹{cartTotal}</Text>
          </View>
          <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/(consumer)/cart')}>
            <Text style={styles.cartBtnText}>{t('viewCart')}</Text>
            <Ionicons name="arrow-forward" size={18} color={'#ffffff'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Pink header ──────────────────────────────────────────────
  pinkHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locPill: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  locIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFD54A', justifyContent: 'center', alignItems: 'center',
  },
  locTextCol: { flex: 1 },
  locRowTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locTitle: { color: '#fff', fontWeight: '900', fontSize: FONTS.sizes.xl, maxWidth: '80%' },
  locAddr: { color: 'rgba(255,255,255,0.9)', fontSize: FONTS.sizes.xs, marginTop: 1 },
  hamburger: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'stretch', gap: SPACING.sm, marginTop: SPACING.md },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, height: 52, gap: SPACING.sm, ...SHADOWS.sm,
  },
  searchInput: { flex: 1, fontSize: FONTS.sizes.md, color: '#1a1a1a' },
  vegToggle: {
    width: 64, backgroundColor: '#fff', borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center', gap: 4, ...SHADOWS.sm,
  },
  vegLabel: { fontSize: 11, fontWeight: '900', color: '#1a1a1a', letterSpacing: 0.5 },
  vegSwitch: { width: 34, height: 18, borderRadius: 9, padding: 2, justifyContent: 'center' },
  vegKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },

  lowestPrice: {
    color: '#fff', fontWeight: '900', fontSize: FONTS.sizes.lg,
    textAlign: 'center', letterSpacing: 1, marginTop: SPACING.md,
  },
  promoRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  promoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  promoStrong: { color: '#fff', fontSize: 12, fontWeight: '900' },
  promoTagText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Section toggle ───────────────────────────────────────────
  sectionRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.xs },
  sectionTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.lg, borderWidth: 1.5,
  },
  sectionTabText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },

  // ── Category circles ─────────────────────────────────────────
  catRow: { paddingHorizontal: SPACING.md, gap: SPACING.lg, paddingVertical: SPACING.sm },
  catItem: { alignItems: 'center', width: 66, gap: 6 },
  catCircle: { width: 64, height: 64, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  catLabel: { fontSize: 11, textAlign: 'center' },

  // ── Price filter chips ───────────────────────────────────────
  priceRow: { paddingHorizontal: SPACING.md, gap: SPACING.sm, paddingTop: SPACING.xs, paddingBottom: SPACING.xs },
  priceChip: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5 },
  priceChipText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },

  // ── Search fallback ──────────────────────────────────────────
  fallbackWrap: { paddingTop: SPACING.xl, alignItems: 'center' },
  fallbackTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', marginTop: SPACING.sm },
  fallbackSub: { fontSize: FONTS.sizes.sm, marginBottom: SPACING.md },
  fallbackScroll: { alignSelf: 'stretch' },
  fallbackRow: { paddingHorizontal: SPACING.md, gap: SPACING.md, paddingTop: SPACING.sm },

  // ── Horizontal rails (Meals / Brands) ────────────────────────
  railSection: { marginTop: SPACING.md },
  locPromptIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  locPromptTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  locPromptBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 28 },
  locPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 999 },
  locPromptBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // ── Restaurant rows in search results ──
  storeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    padding: SPACING.sm, borderRadius: 14, borderWidth: 1,
  },
  storeThumb: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  storeThumbImg: { width: '100%', height: '100%' },
  storeRowBody: { flex: 1, minWidth: 0 },
  storeRowName: { fontSize: 15, fontWeight: '700' },
  storeRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  storeRowMetaText: { fontSize: 12 },
  storeRowOut: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  storeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  storeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  outOfAreaHeading: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.3,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs, marginBottom: SPACING.xs,
  },
  outOfAreaHint: {
    fontSize: 11, lineHeight: 16,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONTS.sizes.xl, fontWeight: '900' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontWeight: '800', fontSize: FONTS.sizes.sm },
  mealsRow: { paddingHorizontal: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xs },

  // ── Meal card ────────────────────────────────────────────────
  mealCard: { width: 168 },
  mealImgWrap: { width: '100%', height: 150 },
  mealImgClip: { flex: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  mealImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  mealImgEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  popularBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#fff', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, ...SHADOWS.sm },
  popularText: { fontSize: 11, fontWeight: '800', color: '#16a34a' },
  mealRating: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#16a34a', borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  mealRatingText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  mealVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8,
  },
  mealVeilTitle: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  mealVeilDetail: { color: '#fff', fontWeight: '600', fontSize: 11, marginTop: 3, textAlign: 'center' },
  mealAdd: {
    position: 'absolute', right: 10, bottom: -16,
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 2, justifyContent: 'center', alignItems: 'center', ...SHADOWS.md,
  },
  mealQty: {
    position: 'absolute', right: 10, bottom: -16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 20, borderWidth: 2,
    paddingHorizontal: 8, paddingVertical: 6, ...SHADOWS.md,
  },
  mealQtyText: { fontWeight: '800', minWidth: 14, textAlign: 'center' },
  mealInfo: { marginTop: SPACING.lg },
  mealStore: { fontSize: 12 },
  mealNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  mealName: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  mealPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  mealMrp: { fontSize: 12, textDecorationLine: 'line-through' },
  mealPrice: { fontSize: FONTS.sizes.md, fontWeight: '800' },

  // Veg mark (shared)
  vegBox: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  vegDot: { width: 7, height: 7, borderRadius: 4 },
  nonVegTri: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent' },

  // ── Popular Brands ───────────────────────────────────────────
  brandsRow: { paddingHorizontal: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xs },
  brandItem: { alignItems: 'center', width: 76, gap: 6 },
  brandCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  brandImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandName: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // ── Grid ─────────────────────────────────────────────────────
  productsList: { paddingHorizontal: SPACING.md, paddingBottom: 120 },
  productsRow: { justifyContent: 'space-between' },
  fullLoader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  refreshOverlay: { position: 'absolute', top: SPACING.sm, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  browseBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFC107', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  browseBannerText: { flex: 1, color: '#1a1a1a', fontSize: FONTS.sizes.xs, fontWeight: '700' },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md, marginTop: SPACING.lg },
  itemCount: { fontSize: FONTS.sizes.xl, fontWeight: '800' },
  vegPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  vegPillText: { fontSize: 11, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: '600', marginTop: SPACING.md },
  emptySubtext: { fontSize: FONTS.sizes.sm, marginTop: SPACING.xs },

  // ── No service ───────────────────────────────────────────────
  noServiceWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xxl },
  noServiceIcon: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
  noServiceTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', textAlign: 'center', marginBottom: SPACING.sm },
  noServiceSub: { fontSize: FONTS.sizes.md, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  noServiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: 14, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.lg, width: '100%', marginBottom: SPACING.sm },
  noServiceBtnText: { color: '#ffffff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  noServiceBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: 14, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.lg, borderWidth: 1.5, width: '100%' },
  noServiceBtnOutlineText: { fontSize: FONTS.sizes.md, fontWeight: '700' },

  // ── Refer & Earn badge ───────────────────────────────────────
  referWrap: { position: 'absolute', right: SPACING.md },
  referCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#0E5A2E', justifyContent: 'center', alignItems: 'center', gap: 2, ...SHADOWS.lg },
  referTop: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  referBottom: { color: '#FFD54A', fontSize: 11, fontWeight: '900' },
  referClose: { position: 'absolute', top: -4, right: -4, zIndex: 2, backgroundColor: '#fff', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', ...SHADOWS.sm },

  // ── Cart footer ──────────────────────────────────────────────
  cartFooter: { position: 'absolute', bottom: 90, left: SPACING.md, right: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.lg },
  cartInfo: { gap: 2 },
  cartCount: { fontSize: FONTS.sizes.sm, color: '#ffffff', opacity: 0.85 },
  cartTotal: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: '#ffffff' },
  cartBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  cartBtnText: { fontSize: FONTS.sizes.md, fontWeight: '600', color: '#ffffff' },
});

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
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProductCard } from '../../src/components/ProductCard';
import { ProductDetailModal } from '../../src/components/ProductDetailModal';
import { FoodLoader } from '../../src/components/FoodLoader';
import { LocationPickerModal, type SavedAddress } from '../../src/components/LocationPickerModal';
import { OfferAlert } from '../../src/components/OfferAlert';
import { UnserviceableScreen } from '../../src/components/UnserviceableScreen';
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

// Compact horizontal "Meals under ₹99" card. Reuses the cart store so the + / −
// controls behave exactly like the main grid cards.
const MealCard = React.memo(({ product }: { product: any }) => {
  const { colors } = useTheme();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const cartItem = items.find((i) => i.product_id === product.id);
  const quantity = cartItem?.quantity || 0;
  const hasDiscount = typeof product.mrp === 'number' && product.mrp > product.price;
  const popular = (product.rating ?? 0) >= 4;
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
        </TouchableOpacity>

        {quantity > 0 ? (
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
                image: product.image, store_name: product.store_name,
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
  // inputText updates on every keystroke (drives the TextInput);
  // searchQuery is the debounced value that drives the actual API call.
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState(t('detectingLocation'));
  // null = unknown yet, true = stores nearby, false = no store within 5 km
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [serviceReason, setServiceReason] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);
  const [showRefer, setShowRefer] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gate the first product fetch until location is resolved (avoids a flickery
  // double-load) and reveal the page only once data + images are warmed.
  const [locationTried, setLocationTried] = useState(false);
  const firstLoadRef = useRef(true);
  // Per-section catalogue cache (keyed by store_type). Lets a Food⇄Kirana toggle
  // swap instantly from memory while a background refetch refreshes it — and we
  // prefetch the *other* section up-front so even the first toggle is <1s.
  const sectionCacheRef = useRef<Record<string, any[]>>({});

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
    try {
      const params: any = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (section !== 'all') params.store_type = section;
      if (searchQuery) params.search = searchQuery;
      if (location) { params.lat = location.lat; params.lng = location.lng; }

      const response = await productsAPI.getAll(params);
      const data = response.data || [];
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
      if (__DEV__) console.warn('Error fetching products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, section, searchQuery, location]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName(t('locationNotAvailable'));
        return;
      }
      // Instant first fix from the OS cache unblocks the product fetch right
      // away; the precise fix below then refines distance/sorting in the
      // background instead of making the user wait on GPS.
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
        setLocationTried(true);
        checkServiceAvailability(last.coords.latitude, last.coords.longitude);
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      checkServiceAvailability(loc.coords.latitude, loc.coords.longitude);
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (address) {
        setLocationName(`${address.district || address.city}, ${address.postalCode || ''}`);
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
    // Safety: if GPS hangs, fetch anyway quickly (location-less) so the loader
    // never sticks — the fetch re-runs automatically once a fix arrives.
    const safety = setTimeout(() => setLocationTried(true), 1500);
    return () => clearTimeout(safety);
  }, []);

  // Fetch only AFTER location is resolved (or timed out) so the first load is
  // location-aware — then on later filter/search changes it refetches normally.
  useEffect(() => {
    if (locationTried) fetchProducts();
  }, [fetchProducts, locationTried]);

  // Debounce inputText → searchQuery so we API-call only after the user
  // stops typing for 400ms.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(inputText), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [inputText]);

  // Load on-device history (searches + views) once.
  useEffect(() => { loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Record each committed search for personalization.
  useEffect(() => { if (searchQuery) addSearch(searchQuery); }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full section catalogue — refetched only when the section or location changes
  // (NOT on every keystroke/category), so recommendations + fallback stay stable
  // while the user searches or filters.
  useEffect(() => {
    if (!locationTried) return;
    const params: any = {};
    if (section !== 'all') params.store_type = section;
    if (location) { params.lat = location.lat; params.lng = location.lng; }
    productsAPI.getAll(params).then((r) => {
      const data = r.data || [];
      setCatalogue(data);
      sectionCacheRef.current[section] = data; // warm the cache for instant re-entry
    }).catch(() => setCatalogue([]));
  }, [section, location, locationTried]);

  // Prefetch the OTHER section's catalogue in the background so the very first
  // Food⇄Kirana toggle is instant (no network wait on Render's cold start).
  useEffect(() => {
    if (!locationTried || section === 'all') return;
    const other = section === 'kirana' ? 'restaurant' : 'kirana';
    if (sectionCacheRef.current[other]) return; // already warm
    const params: any = { store_type: other };
    if (location) { params.lat = location.lat; params.lng = location.lng; }
    productsAPI.getAll(params)
      .then((r) => { sectionCacheRef.current[other] = r.data || []; })
      .catch(() => {});
  }, [section, location, locationTried]);

  // Orders power "Recommended For You" — refetch on focus so picks refresh after
  // a purchase (the user returns to Home from checkout).
  useFocusEffect(
    useCallback(() => {
      ordersAPI.getAll().then((r) => setOrders(r.data || [])).catch(() => setOrders([]));
    }, []),
  );

  const handleSearchChange = (text: string) => setInputText(text);

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
    if (inputText) { setInputText(''); setSearchQuery(''); }
    const cached = sectionCacheRef.current[next];
    if (cached) {
      setProducts(cached);
      setCatalogue(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setSection(next);
  }, [section, inputText]);

  // Pick a saved address from the location sheet. Addresses don't store
  // coordinates, so geocode the text to recenter the feed; show the address
  // immediately for responsiveness while the geocode resolves.
  const handlePickAddress = useCallback(async (addr: SavedAddress) => {
    setLocationName(addr.full_address);
    let lat = addr.lat ?? null;
    let lng = addr.lng ?? null;
    if (lat == null || lng == null) {
      try {
        const geo = await Location.geocodeAsync(addr.full_address);
        if (geo && geo[0]) { lat = geo[0].latitude; lng = geo[0].longitude; }
      } catch {
        // Geocode failed — keep the label shown; feed stays on the last fix.
      }
    }
    // Publish as the selected delivery address so Cart/Checkout reuse it.
    await setSelAddr({ id: addr.id, label: addr.label, full_address: addr.full_address, lat, lng });
    if (lat != null && lng != null) {
      // New area → drop cached sections so they re-warm for this location.
      sectionCacheRef.current = {};
      setLocation({ lat, lng });
      checkServiceAvailability(lat, lng);
    }
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

  const shownProducts = useMemo(
    () => (vegMode ? products.filter((p) => p.is_veg !== false) : products),
    [products, vegMode],
  );

  // "Meals under ₹99" rail — featured slice of the catalogue (also stays in the
  // full grid below, the way Zomato surfaces a highlights row + full list).
  const cheapMeals = useMemo(
    () => shownProducts.filter((p) => typeof p.price === 'number' && p.price <= 99).slice(0, 12),
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
  const recommended = useMemo(() => buildRecommended(vegCatalogue, prefs, 12), [vegCatalogue, prefs]);
  const offers = useMemo(() => buildOffers(vegCatalogue, prefs, 12), [vegCatalogue, prefs]);
  const fallbackItems = useMemo(() => searchFallback(vegCatalogue, 12), [vegCatalogue]);

  // Discovery rails only on the clean default view — hidden while searching,
  // price-filtering, or browsing a specific category (then the grid is focused).
  const showRails = !searchQuery && priceMax == null && selectedCategory === 'all';

  // Nearby restaurants (each with its own menu) — restaurant-first browsing.
  const [stores, setStores] = useState<any[]>([]);
  useEffect(() => {
    if (!location || section === 'kirana' || searchQuery) { setStores([]); return; }
    productsAPI
      .getStores({ lat: location.lat, lng: location.lng, store_type: 'restaurant' })
      .then((r) => setStores(r.data?.data || []))
      .catch(() => setStores([]));
  }, [location, section, searchQuery]);

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

        <TouchableOpacity style={styles.hamburger} onPress={() => router.push('/(consumer)/profile')}>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search + VEG toggle */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchProducts')}
            placeholderTextColor="#9aa0a6"
            value={inputText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {inputText.length > 0 && (
            <TouchableOpacity onPress={() => { setInputText(''); setSearchQuery(''); }}>
              <Ionicons name="close-circle" size={20} color="#9aa0a6" />
            </TouchableOpacity>
          )}
        </View>

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

      {noService ? (
        <UnserviceableScreen
          areaName={pillAddr || locationName}
          reason={serviceReason}
          refreshing={refreshing}
          notified={notified}
          onChangeAddress={() => setShowLocationPicker(true)}
          onRefresh={recheckService}
          onNotify={handleNotify}
        />
      ) : loading ? (
        <View style={styles.fullLoader}>
          <FoodLoader size={58} label={t('gettingFreshFood')} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
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
            renderItem={({ item }) => <ProductCard product={item} />}
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
                  <Text style={[styles.fallbackTitle, { color: colors.text }]}>{t('noExactMatches')}</Text>
                  <Text style={[styles.fallbackSub, { color: colors.textSecondary }]}>{t('youMayLike')}</Text>
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
                  <Ionicons name="basket-outline" size={64} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    {priceMax != null ? t('nothingUnder', { price: priceMax }) : t('noProductsFound')}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{t('tryDifferentCategory')}</Text>
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

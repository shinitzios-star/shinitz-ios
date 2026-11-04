import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SPACING, FONTS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useCartStore } from '../store/cartStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { ProductDetailModal } from './ProductDetailModal';
import { isStoreClosed, closedVeil } from '../utils/storeStatus';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  stock: number;
  available?: boolean;     // false → out of stock / unavailable
  store_id?: string;
  store_type?: string;
  store_name?: string;
  distance?: number;
  rating?: number;
  is_veg?: boolean;
  item_type?: string;
  mrp?: number;            // optional original price → strikethrough
  store_open?: boolean;    // backend: may this restaurant take orders right now
  store_status?: { state?: string; title?: string; detail?: string | null };
}

interface ProductCardProps {
  product: Product;
  // View-only mode (Browse Menu when delivery isn't available yet): hides the
  // add-to-cart / quantity controls. Details, price, image, rating stay visible.
  browseOnly?: boolean;
}

// Swiggy/Zomato-style veg / non-veg square indicator (green/red are fixed —
// theme-independent by design).
function VegMark({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? COLORS.success : COLORS.error;
  return (
    <View style={[styles.vegBox, { borderColor: c }]}>
      {isVeg
        ? <View style={[styles.vegDot, { backgroundColor: c }]} />
        : <View style={[styles.nonVegTri, { borderBottomColor: c }]} />}
    </View>
  );
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, browseOnly }) => {
  const router = useRouter();
  const { colors } = useTheme();
  // Narrow subscriptions: this card re-renders when ITS OWN quantity (or
  // favourite flag) changes, not when any other card touches the cart. The
  // unselected form of these hooks subscribes to the whole store, so one tap
  // re-rendered every card in the grid.
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const quantity = useCartStore(
    (s) => s.items.find((i) => i.product_id === product.id)?.quantity ?? 0);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const liked = useFavoritesStore((s) => s.favorites.some((f) => f.id === product.id));

  const openStore = () => {
    if (!product.store_id) return;
    router.push({
      pathname: '/(consumer)/store' as any,
      params: { storeId: product.store_id, storeName: product.store_name || 'Store', storeType: product.store_type || '' },
    });
  };
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Big detail popup (image, store row, reviews + stars)
  const [showDetail, setShowDetail] = useState(false);

  const bump = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  const handleAdd = () => {
    bump();
    addItem({
      product_id: product.id, name: product.name, price: product.price,
      image: product.image, store_name: product.store_name, store_id: product.store_id,
    });
  };
  const handleIncrease = () => updateQuantity(product.id, quantity + 1);
  const handleDecrease = () =>
    quantity > 1 ? updateQuantity(product.id, quantity - 1) : removeItem(product.id);

  const handleToggleFavorite = () =>
    toggleFavorite({
      id: product.id, name: product.name, price: product.price,
      category: product.category, image: product.image, store_name: product.store_name,
    });

  const hasDiscount = typeof product.mrp === 'number' && product.mrp > product.price;
  const showVeg = typeof product.is_veg === 'boolean';
  // Out of stock: explicitly unavailable, or a grocery item with no stock left.
  const soldOut = product.available === false || (product.item_type === 'grocery' && (product.stock ?? 1) <= 0);
  // Restaurant closed (outside its hours) or switched off — no Add, and say when
  // it opens, instead of letting the customer find out at checkout.
  const storeClosed = !soldOut && isStoreClosed(product);
  const veil = storeClosed ? closedVeil(product) : null;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      {/* ── Image (tap → big detail popup) ───────────────────────────────── */}
      <View style={[styles.imageWrap, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={0.9}
          onPress={() => setShowDetail(true)}
        >
          {product.image ? (
            <Image
              source={product.image}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={product.id}
            />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
              <Ionicons name="fast-food-outline" size={40} color={colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>

        {/* Favorite (subtle) */}
        <TouchableOpacity onPress={handleToggleFavorite} style={styles.favBtn} hitSlop={8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#ef4444' : '#fff'} />
        </TouchableOpacity>

        {/* Rating badge (bottom-left) */}
        {typeof product.rating === 'number' && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={COLORS.success} />
            <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
          </View>
        )}

        {/* Out of stock veil */}
        {soldOut && (
          <View style={styles.soldOut}><Text style={styles.soldOutText}>Out of stock</Text></View>
        )}
        {veil && (
          <View style={styles.soldOut} pointerEvents="none">
            <Text style={styles.soldOutText}>{veil.title}</Text>
            {veil.detail ? <Text style={styles.veilDetail}>{veil.detail}</Text> : null}
          </View>
        )}

        {/* Add / quantity control (bottom-right, overlapping). Hidden when sold
            out, when the restaurant is closed, or in view-only Browse Menu mode. */}
        {!soldOut && !storeClosed && !browseOnly && (
          <View style={styles.addWrap}>
            {quantity > 0 ? (
              <View style={[styles.qtyControl, { borderColor: colors.primary }]}>
                <TouchableOpacity onPress={handleDecrease} style={styles.qtyBtn} hitSlop={6}>
                  <Ionicons name="remove" size={16} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.qtyText, { color: colors.primary }]}>{quantity}</Text>
                <TouchableOpacity onPress={handleIncrease} style={styles.qtyBtn} hitSlop={6}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handleAdd} style={[styles.addCircle, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Details (tap → big detail popup) ─────────────────────────────── */}
      <View style={styles.content}>
        {!!product.store_name && (
          <TouchableOpacity onPress={openStore} hitSlop={6}>
            <Text style={[styles.storeName, { color: colors.textSecondary }]} numberOfLines={1}>{product.store_name} ›</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowDetail(true)}>
          <View style={styles.nameRow}>
            {showVeg && <VegMark isVeg={!!product.is_veg} />}
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
          </View>

          <View style={styles.priceRow}>
            {hasDiscount && <Text style={[styles.mrp, { color: colors.textMuted }]}>₹{product.mrp}</Text>}
            <Text style={[styles.price, { color: hasDiscount ? colors.primary : colors.text }]}>₹{product.price}</Text>
            {product.distance !== undefined && (
              <Text style={[styles.distance, { color: colors.textSecondary }]}>· {product.distance}km</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Big YouTube-style detail popup: store row + reviews + stars */}
      <ProductDetailModal
        productId={product.id}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        initial={product}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginBottom: SPACING.lg,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.lg + 4,
    position: 'relative',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  favBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff', paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.sm,
    ...SHADOWS.sm,
  },
  ratingText: { fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  soldOutText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  veilDetail: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 3, textAlign: 'center', paddingHorizontal: 6 },
  addWrap: { position: 'absolute', bottom: 8, right: 8 },
  addCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff', ...SHADOWS.md,
  },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 22, borderWidth: 2,
    ...SHADOWS.md,
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 9 },
  qtyText: { fontSize: FONTS.sizes.md, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  content: { paddingTop: SPACING.sm, paddingHorizontal: 2 },
  storeName: { fontSize: 12, marginBottom: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  name: { flex: 1, fontSize: FONTS.sizes.md, fontWeight: '700', lineHeight: 20 },
  vegBox: {
    width: 16, height: 16, borderRadius: 3, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  nonVegTri: {
    width: 0, height: 0,
    borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  mrp: { fontSize: FONTS.sizes.sm, textDecorationLine: 'line-through' },
  price: { fontSize: FONTS.sizes.md, fontWeight: '800' },
  distance: { fontSize: 11 },
});

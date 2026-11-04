/**
 * ProductDetailModal — item bottom-sheet.
 *
 * Tap any product card → a rounded bottom sheet (dimmed backdrop, centered
 * close button) with a compact header (thumb + title + bookmark + share), the
 * owning store row, a full review system (rating summary with a star
 * distribution, add/edit-your-review, and the reviews list) and a green
 * quantity + "Add item" footer.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Dimensions, Pressable, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { RADIUS, SPACING, FONTS, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useCartStore } from '../store/cartStore';
import { isStoreClosed, closedVeil } from '../utils/storeStatus';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useHistoryStore } from '../store/historyStore';
import { productsAPI } from '../services/api';

const { height: SCREEN_H } = Dimensions.get('window');
const GREEN = '#1BA672';        // footer / accents — matches the reference
const GREEN_SOFT = '#E8F6EE';   // quantity-box fill

interface Props {
  productId: string | null;
  visible: boolean;
  onClose: () => void;
  /** The card's product — shown instantly while the full detail loads */
  initial?: any;
}

function Stars({ value, size = 16, color = '#f59e0b', onRate }: { value: number; size?: number; color?: string; onRate?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} disabled={!onRate} onPress={() => onRate?.(s)} hitSlop={4}>
          <Ionicons
            name={value >= s ? 'star' : value >= s - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={color}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ProductDetailModal({ productId, visible, onClose, initial }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();

  const [detail, setDetail] = useState<any>(initial || null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Write-review state
  const [myStars, setMyStars] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  // Footer quantity selector (local — the user picks, then taps Add)
  const [selectQty, setSelectQty] = useState(1);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        productsAPI.getOne(productId),
        productsAPI.getReviews(productId),
      ]);
      setDetail(d.data);
      setReviews(r.data || []);
      const mine = (r.data || []).find((rv: any) => rv.consumer_id === user?.id);
      if (mine) { setMyStars(mine.rating); setMyComment(mine.comment || ''); setEditing(false); }
    } catch {} finally { setLoading(false); }
  }, [productId, user?.id]);

  useEffect(() => {
    if (visible) {
      setDetail(initial || null);
      setMyStars(0);
      setMyComment('');
      setEditing(false);
      setSelectQty(1);
      // Record the view as a personalization signal (no re-render via getState).
      if (initial?.id) {
        useHistoryStore.getState().addView({
          id: initial.id, category: initial.category, store_name: initial.store_name,
        });
      }
      load();
    }
  }, [visible, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = detail || initial || {};
  const store = p.store || {};
  const cartItem = items.find((i) => i.product_id === p.id);
  const inCart = cartItem?.quantity || 0;
  const soldOut = p.available === false || (p.item_type === 'grocery' && (p.stock ?? 1) <= 0);
  // Restaurant closed / switched off right now (backend-resolved, IST hours).
  const closed = !soldOut && isStoreClosed(p) ? closedVeil(p) : null;
  const isConsumer = user?.role === 'consumer';
  const liked = isFavorite(p.id);

  // ── Review summary (average + count + 5→1 distribution) ────────────────────
  const reviewCount = reviews.length;
  const avgRating = reviewCount
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount
    : (typeof p.rating === 'number' ? p.rating : 0);
  const dist = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => Math.round(r.rating || 0) === star).length);
  const myExisting = reviews.find((rv: any) => rv.consumer_id === user?.id);

  const openStore = () => {
    const sid = store.id || p.store_id;
    if (!sid) return;
    onClose();
    router.push({
      pathname: '/(consumer)/store' as any,
      params: { storeId: sid, storeName: store.name || p.store_name || 'Store', storeType: store.store_type || p.store_type || '' },
    });
  };

  const submitReview = async () => {
    if (!p.id) return;
    if (myStars < 1) { Alert.alert('Rating needed', 'Tap the stars to rate this item.'); return; }
    setSubmitting(true);
    try {
      await productsAPI.addReview(p.id, myStars, myComment.trim());
      await load();
      Alert.alert('Thanks!', 'Your review has been posted.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not post your review.');
    } finally { setSubmitting(false); }
  };

  const onShare = () => {
    if (!p.name) return;
    Share.share({ message: `Check out ${p.name} (₹${p.price}) on Shinitz` }).catch(() => {});
  };

  const onAddToCart = () => {
    if (!p.id) return;
    if (inCart === 0) {
      addItem({ product_id: p.id, name: p.name, price: p.price, image: p.image, store_name: p.store_name, store_id: p.store_id });
      if (selectQty > 1) updateQuantity(p.id, selectQty);
    } else {
      updateQuantity(p.id, inCart + selectQty);
    }
    onClose();
  };

  const total = (Number(p.price) || 0) * selectQty;
  // Show the write/edit form when the user has no review yet, or taps "Edit".
  const showForm = isConsumer && (!myExisting || editing);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { height: SCREEN_H * 0.9 }]}>
          {/* Centered close button overlapping the sheet's top edge */}
          <View style={styles.closeWrap} pointerEvents="box-none">
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetInner}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              {/* ── Header: thumb + title + bookmark + share ─────────────── */}
              <View style={styles.header}>
                <View style={styles.thumbWrap}>
                  {p.image ? (
                    <Image source={p.image} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Ionicons name="fast-food-outline" size={26} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                <Text style={styles.title} numberOfLines={2}>{p.name}</Text>
                <TouchableOpacity style={styles.headIcon} onPress={() => p.id && toggleFavorite({ id: p.id, name: p.name, price: p.price, category: p.category, image: p.image, store_name: p.store_name })} hitSlop={6}>
                  <Ionicons name={liked ? 'bookmark' : 'bookmark-outline'} size={20} color={liked ? GREEN : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headIcon} onPress={onShare} hitSlop={6}>
                  <Ionicons name="share-social-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Price + rating + veg */}
                <View style={styles.metaRow}>
                  {typeof p.is_veg === 'boolean' && (
                    <View style={[styles.vegBox, { borderColor: p.is_veg ? GREEN : colors.error }]}>
                      {p.is_veg
                        ? <View style={[styles.vegDot, { backgroundColor: GREEN }]} />
                        : <View style={[styles.nonVegTri, { borderBottomColor: colors.error }]} />}
                    </View>
                  )}
                  <Text style={styles.price}>₹{p.price}</Text>
                  {avgRating > 0 && (
                    <View style={styles.ratingPill}>
                      <Ionicons name="star" size={12} color="#fff" />
                      <Text style={styles.ratingPillText}>{avgRating.toFixed(1)}</Text>
                    </View>
                  )}
                  {p.item_type === 'grocery' && typeof p.stock === 'number' && p.stock > 0 && p.stock <= 10 && (
                    <Text style={styles.lowStock}>Only {p.stock} left</Text>
                  )}
                </View>

                {/* Store row */}
                <TouchableOpacity style={styles.channelRow} onPress={openStore} activeOpacity={0.8}>
                  {store.avatar_url ? (
                    <Image source={store.avatar_url} style={styles.channelAvatar} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                  ) : (
                    <View style={[styles.channelAvatar, styles.channelAvatarEmpty]}>
                      <Ionicons name={p.store_type === 'kirana' ? 'storefront' : 'restaurant'} size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.channelNameRow}>
                      <Text style={styles.channelName} numberOfLines={1}>{store.name || p.store_name || 'Store'}</Text>
                      {store.verified && <Ionicons name="checkmark-circle" size={15} color={colors.info} />}
                    </View>
                    <Text style={styles.channelMeta}>
                      {p.store_type === 'kirana' ? 'Kirana store' : 'Restaurant'}
                      {store.is_online === false ? ' · Closed now' : ''}
                    </Text>
                  </View>
                  <Text style={styles.viewStore}>View ›</Text>
                </TouchableOpacity>

                {/* About */}
                {!!p.description && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About this item</Text>
                    <Text style={styles.description}>{p.description}</Text>
                  </View>
                )}

                {/* ── Ratings & Reviews ─────────────────────────────────── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ratings &amp; Reviews</Text>

                  {/* Summary card: average + star distribution */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryLeft}>
                      <Text style={styles.avgNum}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
                      <Stars value={avgRating} size={14} />
                      <Text style={styles.summaryCount}>
                        {reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
                      </Text>
                    </View>
                    <View style={styles.summaryBars}>
                      {[5, 4, 3, 2, 1].map((star, idx) => {
                        const pct = reviewCount ? (dist[idx] / reviewCount) * 100 : 0;
                        return (
                          <View key={star} style={styles.barRow}>
                            <Text style={styles.barStar}>{star}</Text>
                            <Ionicons name="star" size={9} color="#f59e0b" />
                            <View style={styles.barTrack}>
                              <View style={[styles.barFill, { width: `${pct}%` }]} />
                            </View>
                            <Text style={styles.barCount}>{dist[idx]}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Write / edit your review */}
                  {isConsumer && (
                    showForm ? (
                      <View style={styles.writeBox}>
                        <Text style={styles.writeLabel}>{myExisting ? 'Update your review' : 'Rate this item'}</Text>
                        <Stars value={myStars} size={30} onRate={setMyStars} />
                        <TextInput
                          style={styles.commentInput}
                          placeholder="Share your experience (optional)"
                          placeholderTextColor={colors.textMuted}
                          value={myComment}
                          onChangeText={setMyComment}
                          multiline
                          maxLength={300}
                        />
                        <View style={styles.writeActions}>
                          {myExisting && (
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setMyStars(myExisting.rating); setMyComment(myExisting.comment || ''); }}>
                              <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.submitBtn, (submitting || myStars < 1) && { opacity: 0.5 }]}
                            onPress={submitReview}
                            disabled={submitting || myStars < 1}
                          >
                            {submitting
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={styles.submitText}>{myExisting ? 'Update Review' : 'Post Review'}</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.yourReviewPill} onPress={() => setEditing(true)}>
                        <Ionicons name="create-outline" size={16} color={GREEN} />
                        <Text style={styles.yourReviewText}>Edit your review</Text>
                      </TouchableOpacity>
                    )
                  )}

                  {/* Reviews list */}
                  {loading && reviewCount === 0 ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.md }} />
                  ) : reviewCount === 0 ? (
                    <Text style={styles.noReviews}>No reviews yet — be the first!</Text>
                  ) : (
                    reviews.map((rv) => {
                      const mine = rv.consumer_id === user?.id;
                      return (
                        <View key={rv.id || `${rv.consumer_id}`} style={styles.reviewRow}>
                          <View style={[styles.reviewAvatar, mine && { backgroundColor: GREEN + '22' }]}>
                            <Text style={[styles.reviewInitial, mine && { color: GREEN }]}>
                              {(rv.consumer_name || 'C').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.reviewHead}>
                              <Text style={styles.reviewName}>{mine ? 'You' : (rv.consumer_name || 'Customer')}</Text>
                              <Stars value={rv.rating || 0} size={12} />
                            </View>
                            {!!rv.comment && <Text style={styles.reviewComment}>{rv.comment}</Text>}
                            {!!rv.created_at && (
                              <Text style={styles.reviewDate}>{new Date(rv.created_at).toLocaleDateString()}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>

              {/* ── Footer: quantity selector + Add item ─────────────────── */}
              {isConsumer && (
                <View style={styles.footer}>
                  {soldOut ? (
                    <View style={[styles.addBtn, { backgroundColor: colors.textMuted, flex: 1 }]}>
                      <Text style={styles.addBtnText}>Out of stock</Text>
                    </View>
                  ) : closed ? (
                    <View style={[styles.addBtn, { backgroundColor: colors.textMuted, flex: 1 }]}>
                      <Text style={styles.addBtnText} numberOfLines={1}>
                        {closed.title === 'Closed' ? 'Restaurant closed' : 'Not accepting orders'}
                        {closed.detail ? ` · ${closed.detail}` : ''}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.qtyBox}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => setSelectQty((q) => Math.max(1, q - 1))} hitSlop={6}>
                          <Ionicons name="remove" size={20} color={GREEN} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{selectQty}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => setSelectQty((q) => q + 1)} hitSlop={6}>
                          <Ionicons name="add" size={20} color={GREEN} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.addBtn} onPress={onAddToCart} activeOpacity={0.9}>
                        <Text style={styles.addBtnText}>
                          {inCart > 0 ? 'Add more' : 'Add item'} ₹{total}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { overflow: 'visible' },
  closeWrap: { position: 'absolute', top: -52, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  closeBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#2b2b2b',
    justifyContent: 'center', alignItems: 'center', ...SHADOWS.md,
  },
  sheetInner: {
    flex: 1, backgroundColor: colors.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  thumbWrap: { ...SHADOWS.sm },
  thumb: { width: 54, height: 54, borderRadius: 12 },
  thumbEmpty: { backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.text, lineHeight: 23 },
  headIcon: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xl },

  // Meta
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  vegBox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  nonVegTri: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  price: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: colors.text },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: GREEN, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  ratingPillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  lowStock: { fontSize: FONTS.sizes.xs, color: colors.warning, fontWeight: '700' },

  // Store row
  channelRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border,
    padding: SPACING.sm, marginTop: SPACING.md,
  },
  channelAvatar: { width: 44, height: 44, borderRadius: 22 },
  channelAvatarEmpty: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  channelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  channelName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  channelMeta: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  viewStore: { fontSize: FONTS.sizes.sm, color: colors.primary, fontWeight: '700' },

  section: { marginTop: SPACING.lg },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text, marginBottom: SPACING.sm },
  description: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, lineHeight: 20 },

  // Review summary
  summaryCard: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'center',
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  summaryLeft: { alignItems: 'center', gap: 4, paddingRight: SPACING.md, borderRightWidth: 1, borderRightColor: colors.border, minWidth: 96 },
  avgNum: { fontSize: 34, fontWeight: '900', color: colors.text, lineHeight: 38 },
  summaryCount: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  summaryBars: { flex: 1, gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barStar: { fontSize: 11, color: colors.textSecondary, width: 8, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceLight, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: '#f59e0b' },
  barCount: { fontSize: 10, color: colors.textMuted, width: 16 },

  // Write review
  writeBox: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border,
    padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm, alignItems: 'flex-start',
  },
  writeLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.text },
  commentInput: {
    alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: colors.border, padding: SPACING.sm,
    color: colors.text, minHeight: 60, textAlignVertical: 'top', fontSize: FONTS.sizes.sm,
  },
  writeActions: { flexDirection: 'row', gap: SPACING.sm, alignSelf: 'stretch' },
  cancelBtn: { paddingVertical: 11, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '700', fontSize: FONTS.sizes.sm },
  submitBtn: { flex: 1, backgroundColor: GREEN, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.sm },
  yourReviewPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: GREEN, marginBottom: SPACING.md,
  },
  yourReviewText: { color: GREEN, fontWeight: '700', fontSize: FONTS.sizes.sm },
  noReviews: { color: colors.textMuted, fontSize: FONTS.sizes.sm, marginVertical: SPACING.sm },

  // Review rows
  reviewRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' },
  reviewInitial: { color: colors.primary, fontWeight: '800' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  reviewName: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.text },
  reviewComment: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, marginTop: 3, lineHeight: 19 },
  reviewDate: { fontSize: 10, color: colors.textMuted, marginTop: 3 },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : SPACING.md,
  },
  qtyBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: GREEN_SOFT, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: GREEN,
  },
  qtyBtn: { paddingHorizontal: SPACING.md, paddingVertical: 12 },
  qtyText: { fontSize: FONTS.sizes.md, fontWeight: '800', color: colors.text, minWidth: 20, textAlign: 'center' },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN, borderRadius: RADIUS.md, paddingVertical: 15, ...SHADOWS.md,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
});

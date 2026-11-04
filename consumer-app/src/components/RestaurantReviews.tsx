import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SPACING, FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { reviewsAPI } from '../services/api';

const GOLD = '#FDB913';
const PAGE = 8;
const SORTS: { key: 'latest' | 'highest' | 'lowest'; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
];

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={GOLD} />
      ))}
    </View>
  );
}

function fmtDate(d?: string) {
  try { return new Date(d as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

export function RestaurantReviews({ storeId, onSummary }: { storeId: string; onSummary?: (s: any) => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [summary, setSummary] = useState<any>({ average: 0, count: 0, breakdown: {} });
  const [reviews, setReviews] = useState<any[]>([]);
  const [myReview, setMyReview] = useState<any>(null);
  const [sort, setSort] = useState<'latest' | 'highest' | 'lowest'>('latest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const applySummary = useCallback((s: any) => { setSummary(s); onSummary?.(s); }, [onSummary]);

  const loadFirst = useCallback(async (sortKey: typeof sort) => {
    setLoading(true);
    try {
      const { data } = await reviewsAPI.list(storeId, { sort: sortKey, page: 1, limit: PAGE });
      setReviews(data.reviews || []);
      applySummary(data.summary || { average: 0, count: 0, breakdown: {} });
      setMyReview(data.my_review || null);
      setHasMore(!!data.has_more);
      setPage(1);
      if (data.my_review) { setRating(data.my_review.rating); setText(data.my_review.text || ''); }
    } catch {
      setReviews([]);
    }
    setLoading(false);
  }, [storeId, applySummary]);

  useEffect(() => { loadFirst(sort); }, [loadFirst, sort]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { data } = await reviewsAPI.list(storeId, { sort, page: next, limit: PAGE });
      setReviews((prev) => [...prev, ...(data.reviews || [])]);
      setHasMore(!!data.has_more);
      setPage(next);
    } catch { /* ignore */ }
    setLoadingMore(false);
  };

  const submit = async () => {
    if (!isAuthenticated) { router.push('/(auth)/login'); return; }
    if (rating < 1) { Alert.alert('Pick a rating', 'Tap 1–5 stars to rate.'); return; }
    setSubmitting(true);
    try {
      const { data } = await reviewsAPI.upsert(storeId, rating, text.trim());
      applySummary(data.summary || summary);
      setEditing(false);
      await loadFirst(sort);
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail || 'Please try again.');
    }
    setSubmitting(false);
  };

  const remove = () => {
    Alert.alert('Delete review?', 'This removes your rating for this restaurant.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setSubmitting(true);
          try {
            const { data } = await reviewsAPI.remove(storeId);
            applySummary(data.summary || summary);
            setMyReview(null); setRating(0); setText(''); setEditing(false);
            await loadFirst(sort);
          } catch (e: any) {
            Alert.alert('Could not delete', e?.response?.data?.detail || 'Please try again.');
          }
          setSubmitting(false);
        },
      },
    ]);
  };

  const total = summary.count || 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const s = makeStyles(colors);

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Ratings & Reviews</Text>

      {/* Aggregate */}
      <View style={[s.card, { flexDirection: 'row', gap: SPACING.lg }]}>
        <View style={{ alignItems: 'center', width: 96 }}>
          <Text style={s.bigAvg}>{total ? summary.average.toFixed(1) : '—'}</Text>
          <StarRow value={summary.average} />
          <Text style={s.muted}>{total} review{total === 1 ? '' : 's'}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
          {[5, 4, 3, 2, 1].map((star) => {
            const n = summary.breakdown?.[String(star)] || 0;
            return (
              <View key={star} style={s.barRow}>
                <Text style={s.barStar}>{star}</Text>
                <Ionicons name="star" size={10} color={GOLD} />
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct(n)}%` }]} />
                </View>
                <Text style={s.barN}>{n}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Write / edit own review */}
      {!isAuthenticated ? (
        <TouchableOpacity style={s.loginPrompt} onPress={() => router.push('/(auth)/login')}>
          <Text style={s.mutedCenter}>Log in to rate this restaurant.</Text>
        </TouchableOpacity>
      ) : (myReview && !editing) ? (
        <View style={[s.card, { borderColor: colors.primary + '40' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.yourLabel}>YOUR REVIEW</Text>
              <StarRow value={myReview.rating} />
              {!!myReview.text && <Text style={[s.reviewText, { marginTop: 4 }]}>{myReview.text}</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <TouchableOpacity onPress={() => setEditing(true)}><Ionicons name="pencil" size={18} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity onPress={remove}><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.composeTitle}>{myReview ? 'Edit your review' : 'Rate this restaurant'}</Text>
          <View style={{ flexDirection: 'row', gap: 4, marginVertical: SPACING.sm }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity key={i} onPress={() => setRating(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={30} color={GOLD} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, 1000))}
            placeholder="Share details of your experience (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[s.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnText}>{myReview ? 'Update' : 'Post review'}</Text>}
            </TouchableOpacity>
            {myReview && (
              <TouchableOpacity style={[s.btnGhost, { borderColor: colors.border }]} onPress={() => { setEditing(false); setRating(myReview.rating); setText(myReview.text || ''); }}>
                <Text style={[s.btnGhostText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Sort + list */}
      <View style={s.sortRow}>
        <Text style={[s.composeTitle, { marginBottom: 0 }]}>All reviews</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SORTS.map((opt) => (
            <TouchableOpacity key={opt.key} onPress={() => setSort(opt.key)}
              style={[s.sortPill, { borderColor: colors.border }, sort === opt.key && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={[s.sortText, { color: sort === opt.key ? '#fff' : colors.textSecondary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.lg }} />
      ) : reviews.length === 0 ? (
        <Text style={[s.mutedCenter, { marginVertical: SPACING.lg }]}>No reviews yet. Be the first to review!</Text>
      ) : (
        <View style={{ gap: SPACING.sm }}>
          {reviews.map((r) => (
            <View key={r.id} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
                  <View style={[s.avatar, { backgroundColor: colors.primary + '1A' }]}>
                    <Text style={{ color: colors.primary, fontWeight: '800' }}>{(r.user_name || 'C').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{r.user_name || 'Customer'}</Text>
                      {r.verified && <Ionicons name="checkmark-circle" size={14} color={colors.success} />}
                    </View>
                    <Text style={s.muted}>{fmtDate(r.created_at)}</Text>
                  </View>
                </View>
                <StarRow value={r.rating} />
              </View>
              {!!r.text && <Text style={[s.reviewText, { color: colors.textSecondary, marginTop: 6 }]}>{r.text}</Text>}
            </View>
          ))}
          {hasMore && (
            <TouchableOpacity style={[s.btnGhost, { borderColor: colors.border, alignSelf: 'center' }]} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[s.btnGhostText, { color: colors.primary }]}>Load more reviews</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, gap: SPACING.sm },
  heading: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: colors.text, marginBottom: SPACING.xs },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.md },
  bigAvg: { fontSize: 34, fontWeight: '900', color: colors.text },
  muted: { fontSize: FONTS.sizes.xs, color: colors.textMuted, marginTop: 2 },
  mutedCenter: { fontSize: FONTS.sizes.sm, color: colors.textSecondary, textAlign: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barStar: { fontSize: FONTS.sizes.xs, color: colors.textSecondary, width: 10 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: GOLD, borderRadius: 3 },
  barN: { fontSize: FONTS.sizes.xs, color: colors.textMuted, width: 22, textAlign: 'right' },
  loginPrompt: { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.md },
  yourLabel: { fontSize: FONTS.sizes.xs, fontWeight: '800', color: colors.primary, marginBottom: 4, letterSpacing: 0.5 },
  composeTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: colors.text, marginBottom: SPACING.xs },
  input: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, minHeight: 64, textAlignVertical: 'top', fontSize: FONTS.sizes.sm },
  btn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.sm },
  btnGhost: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  btnGhostText: { fontWeight: '700', fontSize: FONTS.sizes.sm },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.xs },
  sortPill: { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1 },
  sortText: { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  reviewText: { fontSize: FONTS.sizes.sm, lineHeight: 19 },
});

export default RestaurantReviews;

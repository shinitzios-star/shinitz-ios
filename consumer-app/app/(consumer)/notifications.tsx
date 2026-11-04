// ─────────────────────────────────────────────────────────────────────────────
// Notification Center — inbox over the server's push log (notifications_log).
// Unread indicators, tap = mark read (+ deep-link to the order), per-item
// delete, mark-all-read, and cursorless pagination (page/has_more).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { notificationsAPI } from '../../src/services/api';

const GROUP_META: Record<string, { icon: any; color: string }> = {
  order: { icon: 'receipt-outline', color: '#3b82f6' },
  refund: { icon: 'cash-outline', color: '#10b981' },
  promo: { icon: 'pricetag-outline', color: '#f59e0b' },
  system: { icon: 'notifications-outline', color: '#8b5cf6' },
};

function timeAgo(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const { data } = await notificationsAPI.list(p);
      setItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
      setUnread(data.unread || 0);
      setHasMore(!!data.has_more);
      setPage(p);
    } catch {
      // network hiccup — pull-to-refresh recovers
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const openItem = async (n: any) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsAPI.markRead([n.id]).catch(() => {});
    }
    const oid = n.data?.orderId || n.data?.order_id;
    if (oid) router.push({ pathname: '/(consumer)/order-detail', params: { orderId: String(oid) } });
  };

  const removeItem = (n: any) => {
    Alert.alert('Delete notification?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((x) => x.id !== n.id));
          if (!n.read) setUnread((u) => Math.max(0, u - 1));
          notificationsAPI.remove(n.id).catch(() => {});
        },
      },
    ]);
  };

  const markAll = () => {
    if (!unread) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    notificationsAPI.markRead().catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notifications{unread > 0 ? ` (${unread})` : ''}
        </Text>
        <TouchableOpacity onPress={markAll} disabled={!unread} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: unread ? colors.primary : colors.textMuted, fontWeight: '700', fontSize: FONTS.sizes.sm }}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loadingMore) { setLoadingMore(true); load(page + 1, true); }
          }}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
          renderItem={({ item }) => {
            const meta = GROUP_META[item.group] || GROUP_META.system;
            return (
              <TouchableOpacity
                style={[styles.card, {
                  backgroundColor: colors.card,
                  borderColor: item.read ? colors.border : colors.primary + '55',
                }]}
                activeOpacity={0.75}
                onPress={() => openItem(item)}
                onLongPress={() => removeItem(item)}
              >
                <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon} size={19} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text, fontWeight: item.read ? '600' : '800' }]} numberOfLines={1}>
                    {item.title || 'Notification'}
                  </Text>
                  <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>{item.body}</Text>
                  <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
                </View>
                {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={56} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, fontSize: FONTS.sizes.md, marginTop: SPACING.sm }}>
                No notifications yet
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: FONTS.sizes.sm, marginTop: 2 }}>
                Order updates and offers will land here
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  card: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONTS.sizes.md },
  body: { fontSize: FONTS.sizes.sm, marginTop: 2, lineHeight: 18 },
  time: { fontSize: FONTS.sizes.xs, marginTop: 4 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
});

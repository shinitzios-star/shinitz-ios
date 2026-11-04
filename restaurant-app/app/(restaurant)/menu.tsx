// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Restaurant — Menu Management (premium merchant redesign, pass 2).
// All data wiring is untouched (restaurantAPI.getProducts/updateProduct/
// deleteProduct, productsAPI.create, optimistic stock stepper, image picker,
// add/edit modal). New on top: in-menu search, category + availability filters,
// availability Switch, larger photo cards with the veg mark on the photo,
// haptics, and full dark-mode theming.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch,
  RefreshControl, ActivityIndicator, Alert, Modal, Image, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { space, radius, typography, elevation } from '../../src/constants/designSystem';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { productsAPI, restaurantAPI } from '../../src/services/api';

const FOOD_CATEGORIES = [
  'Starters', 'Main Course', 'Biryani & Rice', 'Breads',
  'Chinese', 'South Indian', 'Snacks', 'Desserts', 'Beverages',
];

type AvailFilter = 'all' | 'live' | 'out';

export default function RestaurantMenuScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Browse state (search + filters over the loaded menu, all client-side) ──
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [availFilter, setAvailFilter] = useState<AvailFilter>('all');

  const [form, setForm] = useState({
    name: '', price: '', category: 'Main Course', description: '', is_veg: true, image: '' as string, stock: '',
  });
  const [picking, setPicking] = useState(false);

  const pickImage = async () => {
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to add an image'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert('Error', 'Could not read image'); return; }
      if (asset.base64.length > 2_000_000) { Alert.alert('Too large', 'Pick a smaller image'); return; }
      setForm((f) => ({ ...f, image: `data:image/jpeg;base64,${asset.base64}` }));
    } catch {
      Alert.alert('Error', 'Could not open gallery');
    } finally { setPicking(false); }
  };

  const fetchItems = useCallback(async () => {
    try {
      const res = await restaurantAPI.getProducts();
      setItems(res.data || []);
    } catch (e) {
      if (__DEV__) console.warn('menu fetch failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchItems(); }, [fetchItems]));

  const resetForm = () => {
    setForm({ name: '', price: '', category: 'Main Course', description: '', is_veg: true, image: '', stock: '' });
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setShowAddModal(true); };

  const openEdit = (item: any) => {
    setForm({
      name: item.name || '',
      price: String(item.price ?? ''),
      category: item.category || 'Main Course',
      description: item.description || '',
      is_veg: item.is_veg !== false,
      image: item.image || '',
      stock: item.stock != null ? String(item.stock) : '',
    });
    setEditingId(item.id);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      Alert.alert('Missing info', 'Please enter the item name and price');
      return;
    }
    setAdding(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        category: form.category,
        description: form.description.trim(),
        is_veg: form.is_veg,
      };
      if (form.image) payload.image = form.image;
      // Quantity is optional — when set, 0 marks the dish sold out for customers.
      if (form.stock.trim() !== '') {
        const stock = Math.max(0, parseInt(form.stock) || 0);
        payload.stock = stock;
        payload.available = stock > 0;
      }
      if (editingId) {
        await restaurantAPI.updateProduct(editingId, payload);
      } else {
        await productsAPI.create(payload);
      }
      setShowAddModal(false);
      resetForm();
      fetchItems();
      Alert.alert(editingId ? 'Saved' : 'Added', editingId ? 'Menu item updated.' : 'Menu item added — visible to nearby customers.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save item');
    } finally {
      setAdding(false);
    }
  };

  const toggleAvailability = async (item: any) => {
    Haptics.selectionAsync().catch(() => {});
    const next = item.available === false;   // flipping to this
    // Optimistic — the switch answers instantly; revert on failure.
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, available: next } : p)));
    try {
      await restaurantAPI.updateProduct(item.id, { available: next });
    } catch {
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, available: !next } : p)));
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  // Quantity of plates/portions available today. Hitting 0 auto-marks the item
  // unavailable (customers see "Out of stock"); raising it back re-enables it.
  const updateStock = async (item: any, newStock: number) => {
    const stock = Math.max(0, newStock);
    Haptics.selectionAsync().catch(() => {});
    // Optimistic UI so rapid +/- taps feel instant
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, stock, available: stock > 0 } : p)));
    try {
      await restaurantAPI.updateProduct(item.id, { stock, available: stock > 0 });
    } catch {
      fetchItems(); // revert to server truth
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Delete item', `Remove "${item.name}" from your menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await restaurantAPI.deleteProduct(item.id); fetchItems(); }
          catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to delete'); }
        },
      },
    ]);
  };

  // Category chips are data-driven from the menu itself.
  const menuCategories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const it of items) {
      const c = (it.category || '').trim();
      if (c) seen.set(c, (seen.get(c) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [items]);

  const liveCount = items.filter((i) => i.available !== false).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !(`${i.name} ${i.category}`.toLowerCase().includes(q))) return false;
      if (catFilter && (i.category || '').trim() !== catFilter) return false;
      if (availFilter === 'live' && i.available === false) return false;
      if (availFilter === 'out' && i.available !== false) return false;
      return true;
    });
  }, [items, query, catFilter, availFilter]);

  const filtersActive = !!(query || catFilter || availFilter !== 'all');

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.header}>
          <Text style={[typography.h1 as any, { color: colors.text }]}>Menu</Text>
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header: title + live counter + Add */}
      <View style={s.header}>
        <View>
          <Text style={[typography.h1 as any, { color: colors.text }]}>Menu</Text>
          <Text style={[typography.caption as any, { color: colors.textSecondary }]}>
            {liveCount} of {items.length} live for customers
          </Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }, elevation(2)]} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[s.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="Search your menu…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Availability + category filter rail */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipRail}>
        {([['all', 'All'], ['live', 'Live'], ['out', 'Sold out']] as [AvailFilter, string][]).map(([k, label]) => (
          <TouchableOpacity key={k}
            style={[s.chip, {
              borderColor: availFilter === k ? colors.primary : colors.border,
              backgroundColor: availFilter === k ? colors.primary + '15' : colors.card,
            }]}
            onPress={() => setAvailFilter(k)}>
            <Text style={[s.chipText, { color: availFilter === k ? colors.primary : colors.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
        {menuCategories.map((c) => (
          <TouchableOpacity key={c}
            style={[s.chip, {
              borderColor: catFilter === c ? colors.primary : colors.border,
              backgroundColor: catFilter === c ? colors.primary + '15' : colors.card,
            }]}
            onPress={() => setCatFilter(catFilter === c ? null : c)}>
            <Text style={[s.chipText, { color: catFilter === c ? colors.primary : colors.textSecondary }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const live = item.available !== false;
          return (
            <View style={[s.itemCard, { backgroundColor: colors.card }, elevation(1), !live && { opacity: 0.72 }]}>
              <View style={s.itemRow}>
                {/* Photo with the veg mark pinned to its corner (Zomato style) */}
                <View>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={s.itemThumb} />
                  ) : (
                    <View style={[s.itemThumb, { backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="fast-food-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={[s.vegMark, { backgroundColor: colors.card, borderColor: item.is_veg === false ? '#b91c1c' : '#0f8a45' }]}>
                    <View style={[s.vegMarkDot, { backgroundColor: item.is_veg === false ? '#b91c1c' : '#0f8a45' }]} />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong as any, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.catTag, { backgroundColor: colors.surfaceLight }]}>
                    <Text style={[s.catTagText, { color: colors.textSecondary }]}>{item.category}</Text>
                  </View>
                  <Text style={[s.price, { color: colors.primary }]}>₹{item.price}</Text>
                </View>

                {/* Availability switch — the single most-used control */}
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Switch
                    value={live}
                    onValueChange={() => toggleAvailability(item)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor="#fff"
                  />
                  <Text style={[s.liveLabel, { color: live ? colors.success : colors.textMuted }]}>
                    {live ? 'Live' : 'Off'}
                  </Text>
                </View>
              </View>

              <View style={[s.actionRow, { borderTopColor: colors.borderLight }]}>
                {/* Today's quantity (plates/portions). 0 = sold out */}
                <View style={[s.stepper, { backgroundColor: colors.surfaceLight }]}>
                  <TouchableOpacity style={s.stepBtn} onPress={() => updateStock(item, (item.stock || 0) - 1)} hitSlop={6}>
                    <Ionicons name="remove" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={[s.stepCount, { color: colors.text }]}>{item.stock || 0}</Text>
                  <TouchableOpacity style={s.stepBtn} onPress={() => updateStock(item, (item.stock || 0) + 1)} hitSlop={6}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={[s.stepHint, { color: colors.textMuted }]}>portions today</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.primary + '14' }]} onPress={() => openEdit(item)}>
                  <Ionicons name="create-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.error + '14' }]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <View style={[s.emptyIcon, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name={filtersActive ? 'search-outline' : 'restaurant-outline'} size={44} color={colors.primary} />
            </View>
            <Text style={[typography.h3 as any, { color: colors.text, marginTop: space.lg }]}>
              {filtersActive ? 'No matching items' : 'No menu items yet'}
            </Text>
            <Text style={[typography.caption as any, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
              {filtersActive ? 'Try clearing the search or filters' : 'Add your first dish — customers nearby will see it'}
            </Text>
            {filtersActive ? (
              <TouchableOpacity style={[s.clearBtn, { borderColor: colors.primary }]}
                onPress={() => { setQuery(''); setCatFilter(null); setAvailFilter('all'); }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Clear filters</Text>
              </TouchableOpacity>
            ) : (
              <Button title="Add Menu Item" style={{ marginTop: SPACING.lg }} onPress={openAdd} />
            )}
          </View>
        }
      />

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView
          style={[s.modalOverlay, { backgroundColor: COLORS.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={s.modalHeader}>
              <Text style={[typography.h2 as any, { color: colors.text }]}>{editingId ? 'Edit Menu Item' : 'Add Menu Item'}</Text>
              <View style={s.modalHeaderActions}>
                <TouchableOpacity style={[s.headerSaveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={adding} activeOpacity={0.85}>
                  {adding
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.headerSaveText}>{editingId ? 'Save' : 'Add'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
            {/* Image picker */}
            <TouchableOpacity style={s.imagePicker} onPress={pickImage} disabled={picking} activeOpacity={0.8}>
              {form.image ? (
                <Image source={{ uri: form.image }} style={s.imagePreview} />
              ) : (
                <View style={[s.imagePlaceholder, { backgroundColor: colors.surfaceLight, borderColor: colors.primary }]}>
                  {picking
                    ? <ActivityIndicator color={colors.primary} />
                    : <><Ionicons name="camera" size={28} color={colors.primary} /><Text style={[s.imagePickerText, { color: colors.primary }]}>Add photo</Text></>}
                </View>
              )}
              {form.image && (
                <View style={[s.imageEditBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <Input label="Item Name" placeholder="e.g. Paneer Butter Masala"
              value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
            <Input label="Price (₹)" placeholder="Enter price" keyboardType="numeric"
              value={form.price} onChangeText={(t) => setForm({ ...form, price: t })} />
            <Input label="Quantity Available (optional)" placeholder="e.g. 20 plates today" keyboardType="numeric"
              value={form.stock} onChangeText={(t) => setForm({ ...form, stock: t.replace(/\D/g, '') })} />
            <Input label="Description (optional)" placeholder="Short description"
              value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} />

            {/* Veg / Non-veg */}
            <Text style={[s.label, { color: colors.text }]}>Type</Text>
            <View style={s.vegRow}>
              {[{ veg: true, label: 'Veg' }, { veg: false, label: 'Non-veg' }].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[s.vegOption, { borderColor: colors.border },
                    form.is_veg === opt.veg && { borderColor: opt.veg ? '#0f8a45' : '#b91c1c', backgroundColor: (opt.veg ? '#0f8a45' : '#b91c1c') + '12' }]}
                  onPress={() => setForm({ ...form, is_veg: opt.veg })}
                >
                  <View style={[s.vegMark, { position: 'relative', top: 0, left: 0, borderColor: opt.veg ? '#0f8a45' : '#b91c1c', backgroundColor: 'transparent' }]}>
                    <View style={[s.vegMarkDot, { backgroundColor: opt.veg ? '#0f8a45' : '#b91c1c' }]} />
                  </View>
                  <Text style={[s.vegOptionText, { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { color: colors.text }]}>Category</Text>
            <View style={s.categoryGrid}>
              {FOOD_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[s.categoryChip, { backgroundColor: colors.card, borderColor: colors.border },
                    form.category === cat && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setForm({ ...form, category: cat })}
                >
                  <Text style={[s.categoryChipText, { color: form.category === cat ? '#fff' : colors.textSecondary }, form.category === cat && { fontWeight: '700' }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space.lg, paddingVertical: space.lg,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginHorizontal: space.lg, marginBottom: space.md,
    borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  chipRail: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  list: { paddingHorizontal: space.lg, paddingBottom: 110 },
  itemCard: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  itemRow: { flexDirection: 'row', gap: space.md },
  itemThumb: { width: 64, height: 64, borderRadius: radius.md },
  vegMark: {
    position: 'absolute', top: -5, left: -5,
    width: 16, height: 16, borderRadius: 3, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  vegMarkDot: { width: 7, height: 7, borderRadius: 4 },
  catTag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  catTagText: { fontSize: 10.5, fontWeight: '600' },
  price: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  liveLabel: { fontSize: 10, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.md, paddingTop: space.md, borderTopWidth: 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 7 },
  stepCount: { fontSize: 15, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  stepHint: { fontSize: 10.5, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  clearBtn: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8, marginTop: space.lg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: SPACING.lg, maxHeight: '88%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerSaveBtn: { borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 8, minWidth: 64, alignItems: 'center' },
  headerSaveText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  imagePicker: { alignSelf: 'center', marginBottom: SPACING.md, position: 'relative' },
  imagePreview: { width: 110, height: 110, borderRadius: RADIUS.lg },
  imagePlaceholder: {
    width: 110, height: 110, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  imagePickerText: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  imageEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2,
  },
  label: { fontSize: FONTS.sizes.md, marginBottom: SPACING.xs, marginTop: SPACING.sm, fontWeight: '600' },
  vegRow: { flexDirection: 'row', gap: SPACING.sm },
  vegOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1.5 },
  vegOptionText: { fontSize: FONTS.sizes.sm, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  categoryChip: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 1 },
  categoryChipText: { fontSize: FONTS.sizes.sm },
});

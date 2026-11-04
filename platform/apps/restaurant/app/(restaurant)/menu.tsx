import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, Image, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { productsAPI, restaurantAPI } from '../../src/services/api';

const FOOD_CATEGORIES = [
  'Starters', 'Main Course', 'Biryani & Rice', 'Breads',
  'Chinese', 'South Indian', 'Snacks', 'Desserts', 'Beverages',
];

export default function RestaurantMenuScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    try {
      await restaurantAPI.updateProduct(item.id, { available: item.available === false });
      fetchItems();
    } catch {
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  // Quantity of plates/portions available today. Hitting 0 auto-marks the item
  // unavailable (customers see "Out of stock"); raising it back re-enables it.
  const updateStock = async (item: any, newStock: number) => {
    const stock = Math.max(0, newStock);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Menu</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor={COLORS.primary} />}
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.itemRow}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.itemThumb} />
              ) : (
                <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                  <Ionicons name="fast-food-outline" size={22} color={COLORS.textMuted} />
                </View>
              )}
              <View style={[styles.vegDot, { borderColor: item.is_veg === false ? COLORS.error : COLORS.success }]}>
                <View style={[styles.vegDotInner, { backgroundColor: item.is_veg === false ? COLORS.error : COLORS.success }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => toggleAvailability(item)}
                style={[styles.availBadge, { backgroundColor: (item.available !== false ? COLORS.success : COLORS.error) + '20' }]}
              >
                <Ionicons name={item.available !== false ? 'checkmark-circle' : 'close-circle'} size={15} color={item.available !== false ? COLORS.success : COLORS.error} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: item.available !== false ? COLORS.success : COLORS.error }}>
                  {item.available !== false ? 'Available' : 'Unavailable'}
                </Text>
              </TouchableOpacity>
              {/* Today's quantity (plates/portions). 0 = sold out */}
              <View style={styles.stockControls}>
                <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(item, (item.stock || 0) - 1)} hitSlop={4}>
                  <Ionicons name="remove" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.stockCount}>{item.stock || 0}</Text>
                <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(item, (item.stock || 0) + 1)} hitSlop={4}>
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No menu items yet</Text>
            <Text style={styles.emptySubtext}>Add your first dish — customers nearby will see it</Text>
            <Button title="Add Menu Item" style={{ marginTop: SPACING.lg }} onPress={openAdd} />
          </View>
        }
      />

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Menu Item' : 'Add Menu Item'}</Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity style={styles.headerSaveBtn} onPress={handleSave} disabled={adding} activeOpacity={0.85}>
                  {adding
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.headerSaveText}>{editingId ? 'Save' : 'Add'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.md }}>
            {/* Image picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={picking} activeOpacity={0.8}>
              {form.image ? (
                <Image source={{ uri: form.image }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  {picking
                    ? <ActivityIndicator color={COLORS.primary} />
                    : <><Ionicons name="camera" size={28} color={COLORS.primary} /><Text style={styles.imagePickerText}>Add photo</Text></>}
                </View>
              )}
              {form.image && (
                <View style={styles.imageEditBadge}><Ionicons name="camera" size={14} color="#fff" /></View>
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
            <Text style={styles.label}>Type</Text>
            <View style={styles.vegRow}>
              {[{ veg: true, label: 'Veg' }, { veg: false, label: 'Non-veg' }].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.vegOption, form.is_veg === opt.veg && { borderColor: opt.veg ? COLORS.success : COLORS.error, backgroundColor: (opt.veg ? COLORS.success : COLORS.error) + '12' }]}
                  onPress={() => setForm({ ...form, is_veg: opt.veg })}
                >
                  <View style={[styles.vegDot, { borderColor: opt.veg ? COLORS.success : COLORS.error }]}>
                    <View style={[styles.vegDotInner, { backgroundColor: opt.veg ? COLORS.success : COLORS.error }]} />
                  </View>
                  <Text style={styles.vegOptionText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {FOOD_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, form.category === cat && styles.categoryChipActive]}
                  onPress={() => setForm({ ...form, category: cat })}
                >
                  <Text style={[styles.categoryChipText, form.category === cat && styles.categoryChipTextActive]}>{cat}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  itemCard: { marginBottom: SPACING.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  itemThumb: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  itemThumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text },
  itemCategory: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.primary },
  vegDot: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  vegDotInner: { width: 8, height: 8, borderRadius: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 'auto' },
  stockControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  stockBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  stockCount: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text, minWidth: 28, textAlign: 'center' },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.error + '15', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center', paddingHorizontal: SPACING.lg },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 8, minWidth: 64, alignItems: 'center',
  },
  headerSaveText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.md },
  imagePicker: { alignSelf: 'center', marginBottom: SPACING.md, position: 'relative' },
  imagePreview: { width: 110, height: 110, borderRadius: RADIUS.lg },
  imagePlaceholder: {
    width: 110, height: 110, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  imagePickerText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  imageEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  label: { fontSize: FONTS.sizes.md, color: COLORS.text, marginBottom: SPACING.xs, marginTop: SPACING.sm, fontWeight: '500' },
  vegRow: { flexDirection: 'row', gap: SPACING.sm },
  vegOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border },
  vegOptionText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  categoryChip: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
});

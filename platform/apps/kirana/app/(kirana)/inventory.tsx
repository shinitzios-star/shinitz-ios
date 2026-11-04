import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { kiranaAPI, productsAPI } from '../../src/services/api';
import api from '../../src/services/api';

export default function InventoryScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New product form
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: 'Food & Beverages',
    stock: '',
    description: '',
    image: '' as string,
  });
  const [adding, setAdding] = useState(false);
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
      setNewProduct((p) => ({ ...p, image: `data:image/jpeg;base64,${asset.base64}` }));
    } catch {
      Alert.alert('Error', 'Could not open gallery');
    } finally { setPicking(false); }
  };

  const fetchProducts = useCallback(async () => {
    try {
      const response = await kiranaAPI.getProducts();
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      Alert.alert('Error', 'Please fill in product name and price');
      return;
    }

    setAdding(true);
    try {
      await productsAPI.create({
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        category: newProduct.category,
        stock: parseInt(newProduct.stock) || 0,
        description: newProduct.description,
        image: newProduct.image || undefined,
      });

      setShowAddModal(false);
      setNewProduct({ name: '', price: '', category: 'Food & Beverages', stock: '', description: '', image: '' });
      fetchProducts();
      Alert.alert('Success', 'Product added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add product');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${productName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/kirana/products/${productId}`);
              fetchProducts();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleToggleAvailability = async (product: any) => {
    try {
      await api.put(`/kirana/products/${product.id}`, {
        available: !product.available,
      });
      fetchProducts();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update product');
    }
  };

  const handleUpdateStock = async (product: any, newStock: number) => {
    try {
      await api.put(`/kirana/products/${product.id}`, { stock: newStock });
      fetchProducts();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update stock');
    }
  };

  const categories = [
    'Food & Beverages',
    'Dairy',
    'Snacks',
    'Personal Care',
    'Household',
    'Cooking Essentials',
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inventory</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={'#ffffff'} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        renderItem={({ item }) => (
          <Card style={styles.productCard}>
            <View style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productCategory}>{item.category}</Text>
              </View>
              <View style={styles.productMeta}>
                <Text style={styles.productPrice}>₹{item.price}</Text>
              </View>
            </View>
            {/* Stock Controls */}
            <View style={styles.stockRow}>
              <TouchableOpacity
                onPress={() => handleToggleAvailability(item)}
                style={[styles.availBadge, { backgroundColor: item.available !== false ? COLORS.success + '20' : COLORS.error + '20' }]}
              >
                <Ionicons name={item.available !== false ? 'checkmark-circle' : 'close-circle'} size={16} color={item.available !== false ? COLORS.success : COLORS.error} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: item.available !== false ? COLORS.success : COLORS.error }}>{item.available !== false ? 'Available' : 'Unavailable'}</Text>
              </TouchableOpacity>
              <View style={styles.stockControls}>
                <TouchableOpacity style={styles.stockBtn} onPress={() => handleUpdateStock(item, Math.max(0, (item.stock || 0) - 1))}>
                  <Ionicons name="remove" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.stockCount}>{item.stock || 0}</Text>
                <TouchableOpacity style={styles.stockBtn} onPress={() => handleUpdateStock(item, (item.stock || 0) + 1)}>
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteProduct(item.id, item.name)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySubtext}>Add your first product to start selling</Text>
            <Button
              title="Add Product"
              onPress={() => setShowAddModal(true)}
              style={{ marginTop: SPACING.lg }}
            />
          </View>
        }
      />

      {/* Add Product Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Product</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Image picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={picking} activeOpacity={0.8}>
              {newProduct.image ? (
                <Image source={{ uri: newProduct.image }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  {picking
                    ? <ActivityIndicator color={COLORS.primary} />
                    : <><Ionicons name="camera" size={26} color={COLORS.primary} /><Text style={styles.imagePickerText}>Add photo</Text></>}
                </View>
              )}
            </TouchableOpacity>

            <Input
              label="Product Name"
              placeholder="Enter product name"
              value={newProduct.name}
              onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
            />

            <Input
              label="Price (₹)"
              placeholder="Enter price"
              keyboardType="numeric"
              value={newProduct.price}
              onChangeText={(text) => setNewProduct({ ...newProduct, price: text })}
            />

            <Input
              label="Stock Quantity"
              placeholder="Enter stock quantity"
              keyboardType="numeric"
              value={newProduct.stock}
              onChangeText={(text) => setNewProduct({ ...newProduct, stock: text })}
            />

            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    newProduct.category === cat && styles.categoryChipActive,
                  ]}
                  onPress={() => setNewProduct({ ...newProduct, category: cat })}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      newProduct.category === cat && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Add Product"
              onPress={handleAddProduct}
              loading={adding}
              style={{ marginTop: SPACING.md }}
            />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  productCard: {
    marginBottom: SPACING.sm,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  productCategory: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  productMeta: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  productStock: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  imagePicker: { alignSelf: 'center', marginBottom: SPACING.md },
  imagePreview: { width: 100, height: 100, borderRadius: RADIUS.lg },
  imagePlaceholder: {
    width: 100, height: 100, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  imagePickerText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  categoryChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  stockControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stockBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  stockCount: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 30,
    textAlign: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

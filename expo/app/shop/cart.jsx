import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Plus, Minus, X, ShoppingBag } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useShopStore } from '@/store/shopStore';
import { tokens } from '../../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function CartScreen() {
  const { products, cart, removeFromCart, updateCartItemQuantity, getCartTotal } = useShopStore();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const mapped = (cart || []).map((item, index) => {
      const product = (products || []).find(p => p.id === item.productId);
      if (!product) return null;
      const variant = item.variantId
        ? product.variants?.find(v => v.id === item.variantId)
        : undefined;
      return { product, variant, quantity: item.quantity, index };
    }).filter(Boolean);
    setItems(mapped);
  }, [cart, products]);

  const handleRemove = (idx) => {
    Alert.alert('Remove Item', 'Remove this item from cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromCart?.(idx) },
    ]);
  };

  const handleQty = (idx, qty) => {
    if (qty < 1) return handleRemove(idx);
    updateCartItemQuantity?.(idx, qty);
  };

  const subtotal = getCartTotal ? getCartTotal() : 0;
  const shipping = subtotal > 0 ? 5.99 : 0;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Cart" showBack />
        <View style={styles.emptyWrap}>
          <ShoppingBag size={80} color="#333" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <View style={{ width: '100%', marginTop: 24 }}>
            <PrimaryButton title="Browse Shop" onPress={() => router.push('/shop')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Cart" showBack />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }}>
        {items.map((item) => (
          <View key={item.index} style={styles.itemCard}>
            {item.product.imageUrl ? (
              <Image source={{ uri: item.product.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: '#2A2A2A' }]} />
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
              {item.variant ? (
                <Text style={styles.itemVar}>{item.variant.name}</Text>
              ) : null}
              <View style={styles.itemFooter}>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleQty(item.index, item.quantity - 1)}>
                    <Minus size={14} color={tokens.colors.background.default} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleQty(item.index, item.quantity + 1)}>
                    <Plus size={14} color={tokens.colors.background.default} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemPrice}>
                  ${((item.variant?.price || item.product.price) * item.quantity).toFixed(2)}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.remove} onPress={() => handleRemove(item.index)}>
              <X size={16} color="#666" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryVal}>${shipping.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          title="Checkout"
          onPress={() => Alert.alert('Checkout', 'Demo â checkout not implemented.')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#999', fontSize: 16, marginTop: 16 },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 12, marginBottom: 10, gap: 12,
  },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  itemBody: { flex: 1 },
  itemName: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '600' },
  itemVar: { color: '#999', fontSize: 12, marginTop: 2 },
  itemFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 8,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2A2A2A', borderRadius: 999, padding: 2,
  },
  stepBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { color: tokens.colors.background.default, fontSize: 13, fontWeight: '600', paddingHorizontal: 8 },
  itemPrice: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '700' },
  remove: { padding: 4 },
  summary: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16, marginTop: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { color: '#999', fontSize: 14 },
  summaryVal: { color: tokens.colors.background.default, fontSize: 14 },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 8 },
  totalLabel: { color: tokens.colors.background.default, fontSize: 16, fontWeight: '600' },
  totalVal: { color: tokens.colors.background.default, fontSize: 18, fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

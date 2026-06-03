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
          <ShoppingBag size={80} color={tokens.colors.dark_navy.text_primary} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <View style={{ width: '100%', marginTop: tokens.spacing.lg }}>
            <PrimaryButton title="Browse Shop" onPress={() => router.push('/shop')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Cart" showBack />

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 200 }}>
        {items.map((item) => (
          <View key={item.index} style={styles.itemCard}>
            {item.product.imageUrl ? (
              <Image source={{ uri: item.product.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: tokens.colors.dark_navy.bg_card }]} />
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
                    <Minus size={14} color={tokens.colors.dark_navy.bg_primary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => handleQty(item.index, item.quantity + 1)}>
                    <Plus size={14} color={tokens.colors.dark_navy.bg_primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemPrice}>
                  ${((item.variant?.price || item.product.price) * item.quantity).toFixed(2)}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.remove} onPress={() => handleRemove(item.index)}>
              <X size={16} color={tokens.colors.dark_navy.text_secondary} />
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
          onPress={() => Alert.alert('Checkout', 'Demo Ã¢ÂÂ checkout not implemented.')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl },
  emptyTitle: { color: tokens.colors.dark_navy.text_muted, fontSize: 16, marginTop: tokens.spacing.md },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: 12, marginBottom: 10, gap: tokens.spacing.md,
  },
  thumb: { width: 60, height: 60, borderRadius: tokens.radius.sm },
  itemBody: { flex: 1 },
  itemName: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, fontWeight: '600' },
  itemVar: { color: tokens.colors.dark_navy.text_muted, fontSize: 12, marginTop: 2 },
  itemFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 8,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tokens.colors.dark_navy.bg_card, borderRadius: 999, padding: 2,
  },
  stepBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 13, fontWeight: '600', paddingHorizontal: 8 },
  itemPrice: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, fontWeight: '700' },
  remove: { padding: tokens.spacing.xs },
  summary: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginTop: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { color: tokens.colors.dark_navy.text_muted, fontSize: 14 },
  summaryVal: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14 },
  divider: { height: 1, backgroundColor: tokens.colors.dark_navy.bg_card, marginVertical: 8 },
  totalLabel: { color: tokens.colors.dark_navy.bg_primary, fontSize: 16, fontWeight: '600' },
  totalVal: { color: tokens.colors.dark_navy.bg_primary, fontSize: 18, fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

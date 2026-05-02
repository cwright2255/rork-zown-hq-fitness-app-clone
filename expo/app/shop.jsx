import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { router } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import ProductCard from '@/components/ProductCard';
import BottomNavigation from '@/components/BottomNavigation';
import { useShopStore } from '@/store/shopStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../theme/tokens';

export default function ShopScreen() {
  const { products, fetchProducts, getCartItemCount } = useShopStore();
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchProducts?.();
  }, [fetchProducts]);

  const cartCount = useMemo(() => (getCartItemCount ? getCartItemCount() : 0), [getCartItemCount]);

  const categories = [
    { label: 'All', value: 'all' },
    { label: 'Apparel', value: 'apparel' },
    { label: 'Equipment', value: 'equipment' },
    { label: 'Footwear', value: 'footwear' },
    { label: 'Supplements', value: 'supplements' },
  ];

  const filtered = category === 'all'
    ? (products || [])
    : (products || []).filter(p => p.category === category);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Shop"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/shop/cart')}
            style={styles.cartBtn} hitSlop={8}>
            <ShoppingBag size={22} color=tokens.colors.background.default />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
        ListHeaderComponent={
          <>
            <View style={styles.banner}>
              <Text style={styles.bannerLabel}>NEW ARRIVALS</Text>
              <Text style={styles.bannerTitle}>Shop the Latest Collection</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {categories.map((c) => {
                const active = category === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
                    <Text style={[styles.pillText, { color: active ? tokens.colors.grayscale.black : tokens.colors.sky.dark }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <ProductCard
              product={item}
              onPress={() => router.push(`/shop/product/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No products available</Text>}
      />

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  cartBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: tokens.colors.background.default,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  cartBadgeText: { color: tokens.colors.grayscale.black, fontSize: 10, fontWeight: '700' },
  banner: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface,
    borderRadius: 16, padding: 20, marginHorizontal: 16, marginBottom: 16,
  },
  bannerLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.sky.dark, marginBottom: 8,
  },
  bannerTitle: { fontSize: 22, fontWeight: '700', color: tokens.colors.background.default, letterSpacing: -0.3 },
  pillRow: { paddingHorizontal: 16, marginBottom: 12 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, marginRight: 8 },
  pillActive: { backgroundColor: tokens.colors.background.default },
  pillInactive: { backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface },
  pillText: { fontSize: 13, fontWeight: '600' },
  empty: { color: tokens.colors.ink.light, textAlign: 'center', marginTop: 40 },
});

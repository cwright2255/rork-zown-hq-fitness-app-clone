import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import ProductCard from '@/components/ProductCard';
import { useShopStore } from '@/store/shopStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../../../theme/tokens';

export default function CategoryScreen() {
  const { category } = useLocalSearchParams();
  const cat = typeof category === 'string' ? category : '';
  const { getProductsByCategory, fetchProducts } = useShopStore();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchProducts?.();
      const list = getProductsByCategory?.(cat) || [];
      setProducts(list);
      setLoading(false);
    })();
  }, [cat, fetchProducts, getProductsByCategory]);

  const title = cat.charAt(0).toUpperCase() + cat.slice(1);

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} showBack />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color=tokens.colors.background.default />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProductCard
                product={item}
                onPress={() => router.push(`/shop/product/${item.id}`)}
              />
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No products in this category</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});

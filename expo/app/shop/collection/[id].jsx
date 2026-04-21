import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import ProductCard from '@/components/ProductCard';
import { useShopStore } from '@/store/shopStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams();
  const collectionId = typeof id === 'string' ? id : '';
  const {
    getCollectionById,
    getProductsByCollection,
    fetchProducts,
    fetchCollections,
  } = useShopStore();

  const [collection, setCollection] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchProducts?.();
      await fetchCollections?.();
      const col = getCollectionById?.(collectionId);
      if (col) {
        setCollection(col);
        setProducts(getProductsByCollection?.(collectionId) || []);
      }
      setLoading(false);
    })();
  }, [collectionId, fetchProducts, fetchCollections, getCollectionById, getProductsByCollection]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}>
          <Text style={styles.empty}>Collection not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={collection.name} showBack />
      <FlatList
        data={products}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
        ListHeaderComponent={
          collection.imageUrl || collection.image ? (
            <View style={styles.banner}>
              <Image
                source={{ uri: collection.imageUrl || collection.image }}
                style={styles.bannerImg}
              />
              <View style={{ padding: 14 }}>
                <Text style={styles.bannerTitle}>{collection.name}</Text>
                {collection.description ? (
                  <Text style={styles.bannerDesc}>{collection.description}</Text>
                ) : null}
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <ProductCard
              product={item}
              onPress={() => router.push(`/shop/product/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No products in this collection</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
  banner: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, overflow: 'hidden',
    marginHorizontal: 16, marginVertical: 12,
  },
  bannerImg: { width: '100%', height: 160 },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  bannerDesc: { color: '#999', fontSize: 13, marginTop: 4 },
});

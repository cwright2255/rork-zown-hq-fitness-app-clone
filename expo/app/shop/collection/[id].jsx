import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import ProductCard from '@/components/ProductCard';
import { useShopStore } from '@/store/shopStore';
import { tokens } from '../../../../theme/tokens';



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
        <View style={styles.center}><ActivityIndicator color="#000000" /></View>
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
        columnWrapperStyle={{ gap: tokens.spacing.md, paddingHorizontal: 22 }}
        contentContainerStyle={{ paddingBottom: 100, gap: tokens.spacing.md }}
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

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#999999', textAlign: 'center', marginTop: 40 },
  banner: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, overflow: 'hidden',
    marginHorizontal: 22, marginVertical: 12,
  },
  bannerImg: { width: '100%', height: 160 },
  bannerTitle: { color: '#000000', fontSize: 20, fontWeight: '700' },
  bannerDesc: { color: '#666666', fontSize: 13, marginTop: 4 },
});

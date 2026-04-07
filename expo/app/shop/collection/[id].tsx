import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore } from '@/store/shopStore';
import { Product, Collection, ProductVariant } from '@/types';
import ProductCard from '@/components/ProductCard';
import Colors from '@/constants/colors';
import { Shirt } from 'lucide-react-native';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getCollectionById, getProductsByCollection, fetchProducts, fetchCollections, addToCart } = useShopStore() as {
    getCollectionById: (id: string) => Collection | null;
    getProductsByCollection: (id: string) => Product[];
    fetchProducts: () => Promise<void>;
    fetchCollections: () => Promise<void>;
    addToCart: (productId: string, variantId?: string, quantity?: number) => void;
  };
  
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Memoize the data loading function to prevent unnecessary re-renders
  const loadData = useCallback(async () => {
    setIsLoading(true);
    
    // Fetch products and collections if needed
    await Promise.all([
      fetchProducts(),
      fetchCollections()
    ]);
    
    if (id) {
      const foundCollection = getCollectionById(id);
      if (foundCollection) {
        setCollection(foundCollection);
        setProducts(getProductsByCollection(id));
      }
    }
    
    setIsLoading(false);
  }, [id, fetchProducts, fetchCollections, getCollectionById, getProductsByCollection]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleAddToCart = (productId: string) => {
    addToCart(productId, undefined, 1);
  };
  
  const handleTryOn = (product: Product) => {
    router.push({
      pathname: `/shop/product/${product.id}` as any,
      params: { 
        productId: product.id,
        variantId: product.variants?.[0]?.id || '',
        size: (product.variants?.[0]?.attributes as any)?.size || ''
      }
    });
  };
  
  // Check if collection has apparel products for try-on
  const hasApparelProducts = useMemo(() => {
    return products.some(p => p.category === 'apparel' || p.category === 'footwear');
  }, [products]);
  
  // Memoize the header component to prevent re-renders
  const ListHeaderComponent = useMemo(() => {
    if (!collection) return null;
    
    return (
      <View style={styles.header}>
        <Image 
          source={{ uri: collection.imageUrl || collection.image }} 
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.headerContent}>
          <Text style={styles.title}>{collection.name}</Text>
          <Text style={styles.description}>{collection.description}</Text>
          
          {collection.categories && collection.categories.length > 0 && (
            <View style={styles.categoriesContainer}>
              {collection.categories.map((category: string) => (
                <TouchableOpacity 
                  key={category}
                  style={styles.categoryChip}
                  onPress={() => router.push(`/shop/category/${category}`)}
                >
                  <Text style={styles.categoryText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {hasApparelProducts && (
            <TouchableOpacity 
              style={styles.tryOnBanner}
              onPress={() => {
                const firstApparelProduct = products.find(p => 
                  p.category === 'apparel' || p.category === 'footwear'
                );
                if (firstApparelProduct) {
                  handleTryOn(firstApparelProduct);
                }
              }}
            >
              <Shirt size={24} color={Colors.text.inverse} />
              <View style={styles.tryOnBannerContent}>
                <Text style={styles.tryOnBannerTitle}>Virtual Try-On</Text>
                <Text style={styles.tryOnBannerText}>
                  Try on items from this collection with our 3D technology
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          <Text style={styles.productsCount}>{products.length} products</Text>
        </View>
      </View>
    );
  }, [collection, products.length, router, hasApparelProducts, handleTryOn, products]);
  
  // Memoize the empty component to prevent re-renders
  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No products found in this collection</Text>
    </View>
  ), []);
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading collection...</Text>
      </SafeAreaView>
    );
  }
  
  if (!collection) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Collection not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={({ item, index }) => (
          <View style={[
            styles.productCardContainer,
            index % 2 === 0 ? { paddingRight: 6 } : { paddingLeft: 6 }
          ]}>
            <ProductCard 
              product={item}
              onPress={() => router.push(`/shop/product/${item.id}`)}
              onAddToCart={() => handleAddToCart(item.id)}
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={ListEmptyComponent}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.text.primary,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  header: {
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    height: 200,
  },
  headerContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 16,
    lineHeight: 24,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryChip: {
    backgroundColor: Colors.card,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  tryOnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  tryOnBannerContent: {
    marginLeft: 16,
    flex: 1,
  },
  tryOnBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.inverse,
    marginBottom: 4,
  },
  tryOnBannerText: {
    fontSize: 14,
    color: Colors.text.inverse,
    opacity: 0.9,
  },
  productsCount: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  productCardContainer: {
    width: '50%',
    padding: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
});
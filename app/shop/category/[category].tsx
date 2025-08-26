import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore } from '@/store/shopStore';
import { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import Colors from '@/constants/colors';
import { Shirt } from 'lucide-react-native';

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { getProductsByCategory, fetchProducts, addToCart } = useShopStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Fetch products if needed
      await fetchProducts();
      
      if (category) {
        setProducts(getProductsByCategory(category));
      }
      
      setIsLoading(false);
    };
    
    loadData();
  }, [category, fetchProducts, getProductsByCategory]);
  
  const handleAddToCart = (productId: string) => {
    addToCart(productId, undefined, 1);
  };
  
  const handleTryOn = (product: Product) => {
    router.push({
      pathname: `/shop/product/try-on`,
      params: { 
        productId: product.id,
        variantId: product.variants?.[0]?.id || '',
        size: product.variants?.[0]?.attributes?.size || ''
      }
    });
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }
  
  const categoryTitle = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'All Products';
  const canTryOnCategory = category === 'apparel' || category === 'footwear';
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.title}>{categoryTitle}</Text>
            <Text style={styles.productsCount}>{products.length} products</Text>
            
            {canTryOnCategory && (
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
                    See how our products fit your body with 3D technology
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
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
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found in this category</Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => router.push('/shop')}
            >
              <Text style={styles.browseButtonText}>Browse All Products</Text>
            </TouchableOpacity>
          </View>
        )}
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
  header: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  productsCount: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  tryOnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
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
    marginBottom: 16,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  browseButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
});
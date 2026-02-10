import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import Colors from '@/constants/colors';
import ProductCard from '@/components/ProductCard';
import { useShopStore } from '@/store/shopStore';
import BottomNavigation from '@/components/BottomNavigation';

const { width, height: windowHeight } = Dimensions.get('window');

export default function ShopScreen() {
  const { products, collections, fetchProducts, fetchCollections, getCartItemCount } = useShopStore() as {
    products: any[];
    collections: any[];
    fetchProducts: () => Promise<void>;
    fetchCollections: () => Promise<void>;
    getCartItemCount: () => number;
  };
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Memoize static data to prevent recreating on every render
  const banners = useMemo(() => [
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      title: 'DUSK IS OUR DAWN',
      subtitle: 'Run until you see the stars—the After Dark Tour Collection is here.',
      primaryCta: 'Shop',
      secondaryCta: 'Shop All Running',
      backgroundColor: '#E63946',
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800',
      title: 'RUN YOUR WORLD',
      subtitle: 'Engineered for speed and comfort. Our latest running collection has arrived.',
      primaryCta: 'Shop',
      secondaryCta: 'Shop All Running',
      backgroundColor: '#1D3557',
    }
  ], []);
  
  const sportCategories = useMemo(() => [
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800',
      title: 'Shop Tennis',
      subtitle: 'Own the Court',
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
      title: 'Shop Running',
      subtitle: 'Your Path Awaits',
    }
  ], []);
  
  const classicProducts = useMemo(() => [
    {
      id: '1',
      name: 'Air Jordan 1',
      image: 'https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=800',
      price: 180,
    },
    {
      id: '2',
      name: 'Dunk Low',
      image: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800',
      price: 110,
    }
  ], []);
  
  // Optimized data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load data in parallel but don't block UI
        await Promise.all([fetchProducts(), fetchCollections()]);
      } catch (error) {
        console.error('Failed to load shop data:', error);
      }
    };
    
    loadData();
  }, [fetchProducts, fetchCollections]);
  
  // Optimized auto-rotate with cleanup and longer interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 6000); // Increased interval to reduce CPU usage
    
    return () => clearInterval(interval);
  }, [banners.length]);
  
  // Memoize cart count to prevent unnecessary recalculations
  const cartItemCount = useMemo(() => getCartItemCount(), [getCartItemCount]);
  
  // Memoize current banner
  const currentBanner = useMemo(() => banners[currentBannerIndex], [banners, currentBannerIndex]);
  
  // Memoize pagination dots
  const renderPaginationDots = useCallback(() => {
    return (
      <View style={styles.paginationContainer}>
        {banners.map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.paginationDot, 
              index === currentBannerIndex && styles.paginationDotActive
            ]} 
          />
        ))}
      </View>
    );
  }, [banners, currentBannerIndex]);
  
  // Memoize apparel products
  const apparelProducts = useMemo(() => 
    products.filter(p => p.category === 'apparel').slice(0, 3), // Reduced from 4 to 3
    [products]
  );
  
  // Memoize navigation handlers
  const handleShopPress = useCallback(() => {
    router.push('/shop/category/all');
  }, []);
  
  const handleCollectionPress = useCallback((collectionId: string) => {
    router.push(`/shop/collection/${collectionId}`);
  }, []);
  
  const handleProductPress = useCallback((productId: string) => {
    router.push(`/shop/product/${productId}`);
  }, []);
  
  const handleCartPress = useCallback(() => {
    router.push('/shop/cart');
  }, []);

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: "Shop",
          headerShadowVisible: false,
          headerBackTitle: "Back",
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleCartPress}
              style={styles.cartButton}
            >
              <ShoppingCart size={24} color={Colors.text.primary} />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollViewContent}
        removeClippedSubviews={true} // Optimize for performance
      >
        {/* Hero Banner */}
        <View 
          style={[
            styles.heroBanner, 
            { backgroundColor: currentBanner.backgroundColor }
          ]}
        >
          <Image 
            source={{ uri: currentBanner.image }} 
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <View style={styles.bannerOverlay} />
          
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>{currentBanner.title}</Text>
            <Text style={styles.bannerSubtitle}>{currentBanner.subtitle}</Text>
            
            <View style={styles.bannerCtas}>
              <TouchableOpacity 
                style={styles.primaryCta}
                onPress={handleShopPress}
              >
                <Text style={styles.primaryCtaText}>{currentBanner.primaryCta}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryCta}
                onPress={() => setSelectedCategory('apparel')}
              >
                <Text style={styles.secondaryCtaText}>{currentBanner.secondaryCta}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {renderPaginationDots()}
        </View>
        
        {/* Featured Apparel Section */}
        {apparelProducts.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.featuredHeader}>
              <Text style={styles.sectionLargeTitle}>Featured Apparel</Text>
              <TouchableOpacity onPress={() => router.push('/shop/category/apparel')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredProductsContainer}
              removeClippedSubviews={true}
            >
              {apparelProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={() => handleProductPress(product.id)}
                  compact={true}
                />
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Featured Collections */}
        {collections.length > 0 && (
          <View style={styles.collectionsSection}>
            <Text style={styles.sectionLargeTitle}>Featured Collections</Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collectionsContainer}
              removeClippedSubviews={true}
            >
              {collections.slice(0, 3).map((collection) => (
                <TouchableOpacity 
                  key={collection.id} 
                  style={styles.collectionCard}
                  onPress={() => handleCollectionPress(collection.id)}
                >
                  <Image 
                    source={{ uri: collection.imageUrl }} 
                    style={styles.collectionCardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.collectionCardOverlay} />
                  <View style={styles.collectionCardContent}>
                    <Text style={styles.collectionCardTitle}>{collection.name}</Text>
                    <Text style={styles.collectionCardSubtitle}>{collection.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Sport Categories Carousel */}
        <View style={styles.sportCategoriesSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sportCategoriesContainer}
            removeClippedSubviews={true}
          >
            {sportCategories.map((category) => (
              <TouchableOpacity 
                key={category.id}
                style={styles.sportCategoryCard}
                onPress={handleShopPress}
              >
                <Image 
                  source={{ uri: category.image }} 
                  style={styles.sportCategoryImage}
                  resizeMode="cover"
                />
                <View style={styles.sportCategoryContent}>
                  <Text style={styles.sportCategoryTitle}>{category.title}</Text>
                  <Text style={styles.sportCategorySubtitle}>{category.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Shop The Classics */}
        <View style={styles.classicsSection}>
          <Text style={styles.sectionLargeTitle}>Shop The Classics</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classicsContainer}
            removeClippedSubviews={true}
          >
            {classicProducts.map((product) => (
              <TouchableOpacity 
                key={product.id} 
                style={styles.classicProductCard}
                onPress={() => handleProductPress(product.id)}
              >
                <Image 
                  source={{ uri: product.image }} 
                  style={styles.classicProductImage}
                  resizeMode="contain"
                />
                <Text style={styles.classicProductName}>{product.name}</Text>
                <Text style={styles.classicProductPrice}>${product.price}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
      
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 80,
  },
  heroBanner: {
    width: '100%',
    height: windowHeight * 0.6, // Reduced from 0.7 to 0.6
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bannerContent: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    padding: 20,
  },
  bannerTitle: {
    fontSize: 36, // Reduced from 42
    fontWeight: '900',
    color: 'white',
    marginBottom: 8,
    letterSpacing: 1,
  },
  bannerSubtitle: {
    fontSize: 16,
    color: 'white',
    marginBottom: 24,
    lineHeight: 22,
  },
  bannerCtas: {
    flexDirection: 'row',
    marginTop: 8,
  },
  primaryCta: {
    backgroundColor: 'white',
    paddingVertical: Colors.spacing.md,
    paddingHorizontal: Colors.spacing.xxl,
    borderRadius: 30,
    marginRight: Colors.spacing.md,
  },
  primaryCtaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryCta: {
    backgroundColor: 'transparent',
    paddingVertical: Colors.spacing.md,
    paddingHorizontal: Colors.spacing.xxl,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'white',
  },
  secondaryCtaText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: 'white',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  featuredSection: {
    padding: 20,
    backgroundColor: Colors.background,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  featuredProductsContainer: {
    paddingBottom: 10,
  },
  collectionsSection: {
    padding: 20,
    backgroundColor: Colors.background,
  },
  collectionsContainer: {
    paddingBottom: 10,
  },
  collectionCard: {
    width: width * 0.7, // Reduced from 0.8
    height: 180, // Reduced from 200
    position: 'relative',
    borderRadius: Colors.radius.medium,
    overflow: 'hidden',
    marginRight: Colors.spacing.lg,
  },
  collectionCardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  collectionCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  collectionCardContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  collectionCardTitle: {
    fontSize: 20, // Reduced from 24
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  collectionCardSubtitle: {
    fontSize: 14,
    color: 'white',
  },
  sportCategoriesSection: {
    paddingVertical: 20,
    backgroundColor: Colors.background,
  },
  sportCategoriesContainer: {
    paddingHorizontal: 16,
  },
  sportCategoryCard: {
    width: width * 0.7, // Reduced from 0.8
    height: 180, // Reduced from 200
    position: 'relative',
    borderRadius: Colors.radius.medium,
    overflow: 'hidden',
    marginRight: Colors.spacing.lg,
  },
  sportCategoryImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  sportCategoryContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  sportCategoryTitle: {
    fontSize: 24, // Reduced from 28
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  sportCategorySubtitle: {
    fontSize: 16,
    color: 'white',
  },
  classicsSection: {
    padding: 20,
    backgroundColor: Colors.card,
  },
  sectionLargeTitle: {
    fontSize: 28, // Reduced from 32
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 20,
  },
  classicsContainer: {
    paddingBottom: 10,
  },
  classicProductCard: {
    width: 200, // Reduced from 220
    marginRight: 16,
  },
  classicProductImage: {
    width: '100%',
    height: 200, // Reduced from 220
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
  },
  classicProductName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  classicProductPrice: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  bottomPadding: {
    height: 80,
  },
  cartButton: {
    position: 'relative',
    padding: 8,
    marginRight: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
});
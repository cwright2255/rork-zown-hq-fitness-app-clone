import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Collection, CartItem } from '@/types';

interface ShopState {
  products: Product[];
  collections: Collection[];
  cart: CartItem[];
  recentlyViewed: string[];
  favorites: string[];
  isLoading: boolean;
  shopifyCheckoutId?: string;
  
  // Product actions
  fetchProducts: () => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (category: string) => Product[];
  getProductsByCollection: (collectionId: string) => Product[];
  getRelatedProducts: (productId: string) => Product[];
  getFeaturedProducts: () => Product[];
  getNewArrivals: () => Product[];
  getBestSellers: () => Product[];
  
  // Collection actions
  fetchCollections: () => Promise<void>;
  getCollectionById: (id: string) => Collection | undefined;
  
  // Cart actions
  addToCart: (productId: string, variantId?: string, quantity?: number, size?: string) => void;
  removeFromCart: (index: number) => void;
  updateCartItemQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  
  // User actions
  addToRecentlyViewed: (productId: string) => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  favoriteProductIds: string[];
}

// Optimized mock data - reduced size for faster loading
const createMockProducts = (): Product[] => [
  {
    id: '1',
    name: 'Premium Fitness Tracker',
    description: 'Track your workouts and health metrics.',
    price: 199.99,
    imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd6b0?w=500',
    category: 'equipment',
    inStock: true,
    rating: 4.5,
    reviewCount: 128,
    collectionIds: ['c1'],
    variants: [
      { id: 'v1', name: 'Black', price: 199.99, inStock: true, attributes: { color: 'Black' } },
      { id: 'v2', name: 'Silver', price: 219.99, inStock: true, attributes: { color: 'Silver' } }
    ]
  },
  {
    id: '2',
    name: 'Wireless Earbuds',
    description: 'Perfect for workouts and daily use.',
    price: 149.99,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500',
    category: 'equipment',
    inStock: true,
    rating: 4.3,
    reviewCount: 89,
    collectionIds: ['c1'],
    variants: [
      { id: 'v3', name: 'White', price: 149.99, inStock: true, attributes: { color: 'White' } }
    ]
  },
  {
    id: '3',
    name: 'Athletic T-Shirt',
    description: 'Comfortable and breathable athletic wear.',
    price: 29.99,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
    category: 'apparel',
    inStock: true,
    rating: 4.7,
    reviewCount: 156,
    collectionIds: ['c2'],
    variants: [
      { id: 'v4', name: 'Small', price: 29.99, inStock: true, attributes: { size: 'S' } },
      { id: 'v5', name: 'Medium', price: 29.99, inStock: true, attributes: { size: 'M' } },
      { id: 'v6', name: 'Large', price: 29.99, inStock: true, attributes: { size: 'L' } }
    ]
  },
  {
    id: '4',
    name: 'Running Shoes',
    description: 'Lightweight and comfortable running shoes.',
    price: 129.99,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    category: 'footwear',
    inStock: true,
    rating: 4.6,
    reviewCount: 203,
    collectionIds: ['c1'],
    variants: [
      { id: 'v7', name: 'Size 8', price: 129.99, inStock: true, attributes: { size: '8' } },
      { id: 'v8', name: 'Size 9', price: 129.99, inStock: true, attributes: { size: '9' } },
      { id: 'v9', name: 'Size 10', price: 129.99, inStock: true, attributes: { size: '10' } }
    ]
  },
  {
    id: '5',
    name: 'Yoga Mat',
    description: 'Non-slip yoga mat for all your workouts.',
    price: 39.99,
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
    category: 'equipment',
    inStock: true,
    rating: 4.4,
    reviewCount: 87,
    collectionIds: ['c1'],
    variants: [
      { id: 'v10', name: 'Purple', price: 39.99, inStock: true, attributes: { color: 'Purple' } },
      { id: 'v11', name: 'Blue', price: 39.99, inStock: true, attributes: { color: 'Blue' } }
    ]
  },
  {
    id: '6',
    name: 'Sports Bra',
    description: 'High-support sports bra for intense workouts.',
    price: 49.99,
    imageUrl: 'https://images.unsplash.com/photo-1506629905607-d405d7d3b0d2?w=500',
    category: 'apparel',
    inStock: true,
    rating: 4.8,
    reviewCount: 142,
    collectionIds: ['c2'],
    variants: [
      { id: 'v12', name: 'Small', price: 49.99, inStock: true, attributes: { size: 'S' } },
      { id: 'v13', name: 'Medium', price: 49.99, inStock: true, attributes: { size: 'M' } },
      { id: 'v14', name: 'Large', price: 49.99, inStock: true, attributes: { size: 'L' } }
    ]
  }
];

const createMockCollections = (): Collection[] => [
  {
    id: 'c1',
    name: 'Fitness Equipment',
    description: 'Essential gear for your fitness journey.',
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500',
    productIds: ['1', '2', '4', '5'],
    categories: ['equipment', 'footwear']
  },
  {
    id: 'c2',
    name: 'Athletic Wear',
    description: 'Comfortable and stylish workout clothes.',
    imageUrl: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=500',
    productIds: ['3', '6'],
    categories: ['apparel']
  },
  {
    id: 'c3',
    name: 'Running Essentials',
    description: 'Everything you need for your running journey.',
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    productIds: ['4', '2'],
    categories: ['footwear', 'equipment']
  }
];

// Create selectors for better performance
const productsSelector = (state: ShopState) => state.products;
const collectionsSelector = (state: ShopState) => state.collections;
const cartSelector = (state: ShopState) => state.cart;
const favoritesSelector = (state: ShopState) => state.favorites;
const isLoadingSelector = (state: ShopState) => state.isLoading;

// Optimized cache with size limits
const cache = {
  productsByCategory: new Map<string, Product[]>(),
  productsByCollection: new Map<string, Product[]>(),
  relatedProducts: new Map<string, Product[]>(),
  featuredProducts: null as Product[] | null,
  newArrivals: null as Product[] | null,
  bestSellers: null as Product[] | null,
  maxCacheSize: 20, // Limit cache size
};

// Helper to clear cache when products change
const clearCache = () => {
  cache.productsByCategory.clear();
  cache.productsByCollection.clear();
  cache.relatedProducts.clear();
  cache.featuredProducts = null;
  cache.newArrivals = null;
  cache.bestSellers = null;
};

// Helper to manage cache size
const manageCacheSize = (cacheMap: Map<string, any>) => {
  if (cacheMap.size > cache.maxCacheSize) {
    const firstKey = cacheMap.keys().next().value;
    if (firstKey !== undefined) {
      cacheMap.delete(firstKey);
    }
  }
};

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      products: [],
      collections: [],
      cart: [],
      recentlyViewed: [],
      favorites: [],
      isLoading: false,
      
      // Optimized product fetching
      fetchProducts: async () => {
        if (get().products.length > 0) return;
        
        set({ isLoading: true });
        
        // Reduced delay for faster loading
        await new Promise(resolve => setTimeout(resolve, 100));
        
        set({ 
          products: createMockProducts(),
          isLoading: false
        });
        
        clearCache();
      },
      
      getProductById: (id) => {
        return get().products.find(product => product.id === id);
      },
      
      getProductsByCategory: (category) => {
        if (cache.productsByCategory.has(category)) {
          return cache.productsByCategory.get(category)!;
        }
        
        let result: Product[];
        if (category === 'all') {
          result = get().products;
        } else {
          result = get().products.filter(product => product.category === category);
        }
        
        manageCacheSize(cache.productsByCategory);
        cache.productsByCategory.set(category, result);
        return result;
      },
      
      getProductsByCollection: (collectionId) => {
        if (cache.productsByCollection.has(collectionId)) {
          return cache.productsByCollection.get(collectionId)!;
        }
        
        const collection = get().getCollectionById(collectionId);
        if (!collection) return [];
        
        let result: Product[];
        if (collection.productIds) {
          // Use productIds if available
          result = get().products.filter(product => 
            collection.productIds!.includes(product.id)
          );
        } else if (collection.categories) {
          // Fallback to categories
          result = get().products.filter(product => 
            collection.categories!.includes(product.category)
          );
        } else {
          // Fallback to collectionIds on products
          result = get().products.filter(product => 
            product.collectionIds?.includes(collectionId)
          );
        }
        
        manageCacheSize(cache.productsByCollection);
        cache.productsByCollection.set(collectionId, result);
        return result;
      },
      
      getRelatedProducts: (productId) => {
        if (cache.relatedProducts.has(productId)) {
          return cache.relatedProducts.get(productId)!;
        }
        
        const product = get().getProductById(productId);
        if (!product) return [];
        
        const result = get().products
          .filter(p => p.id !== productId && p.category === product.category)
          .slice(0, 3); // Reduced from 4 to 3
        
        manageCacheSize(cache.relatedProducts);
        cache.relatedProducts.set(productId, result);
        return result;
      },
      
      getFeaturedProducts: () => {
        if (cache.featuredProducts) {
          return cache.featuredProducts;
        }
        
        const result = get().products
          .filter(product => product.rating >= 4.5)
          .slice(0, 4); // Reduced from 6 to 4
        
        cache.featuredProducts = result;
        return result;
      },
      
      getNewArrivals: () => {
        if (cache.newArrivals) {
          return cache.newArrivals;
        }
        
        const result = get().products
          .sort((a, b) => b.id.localeCompare(a.id))
          .slice(0, 4); // Reduced from 6 to 4
        
        cache.newArrivals = result;
        return result;
      },
      
      getBestSellers: () => {
        if (cache.bestSellers) {
          return cache.bestSellers;
        }
        
        const result = get().products
          .sort((a, b) => b.reviewCount - a.reviewCount)
          .slice(0, 4); // Reduced from 6 to 4
        
        cache.bestSellers = result;
        return result;
      },
      
      // Optimized collection fetching
      fetchCollections: async () => {
        if (get().collections.length > 0) return;
        
        set({ isLoading: true });
        
        // Reduced delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        set({ 
          collections: createMockCollections(),
          isLoading: false
        });
      },
      
      getCollectionById: (id) => {
        return get().collections.find(collection => collection.id === id);
      },
      
      // Cart actions (unchanged for functionality)
      addToCart: (productId, variantId, quantity = 1, size) => {
        const { cart } = get();
        
        const existingItemIndex = cart.findIndex(
          cartItem => 
            cartItem.productId === productId && 
            cartItem.variantId === variantId
        );
        
        if (existingItemIndex >= 0) {
          const updatedCart = [...cart];
          updatedCart[existingItemIndex].quantity += quantity;
          set({ cart: updatedCart });
        } else {
          set({ 
            cart: [...cart, { 
              productId, 
              variantId, 
              quantity,
              size
            }] 
          });
        }
      },
      
      removeFromCart: (index) => {
        const { cart } = get();
        const updatedCart = [...cart];
        updatedCart.splice(index, 1);
        set({ cart: updatedCart });
      },
      
      updateCartItemQuantity: (index, quantity) => {
        const { cart } = get();
        const updatedCart = [...cart];
        updatedCart[index].quantity = quantity;
        set({ cart: updatedCart });
      },
      
      clearCart: () => {
        set({ cart: [] });
      },
      
      getCartTotal: () => {
        const { cart, products } = get();
        
        return cart.reduce((total, item) => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return total;
          
          const variant = item.variantId 
            ? product.variants?.find(v => v.id === item.variantId)
            : undefined;
          
          const price = variant ? variant.price : product.price;
          return total + (price * item.quantity);
        }, 0);
      },
      
      getCartItemCount: () => {
        return get().cart.reduce((count, item) => count + item.quantity, 0);
      },
      
      // User actions with optimizations
      addToRecentlyViewed: (productId) => {
        const { recentlyViewed } = get();
        
        const filtered = recentlyViewed.filter(id => id !== productId);
        const updated = [productId, ...filtered];
        
        // Reduced from 10 to 5 for better performance
        set({ recentlyViewed: updated.slice(0, 5) });
      },
      
      toggleFavorite: (productId) => {
        const { favorites } = get();
        
        if (favorites.includes(productId)) {
          set({ favorites: favorites.filter(id => id !== productId) });
        } else {
          set({ favorites: [...favorites, productId] });
        }
      },
      
      isFavorite: (productId) => {
        return get().favorites.includes(productId);
      },
      
      get favoriteProductIds() {
        return get().favorites;
      },
    }),
    {
      name: 'zown-shop-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cart: state.cart,
        favorites: state.favorites,
        recentlyViewed: state.recentlyViewed,
        shopifyCheckoutId: state.shopifyCheckoutId,
      }),
    }
  )
);

// Export selectors for better performance
export const useProducts = () => useShopStore(productsSelector);
export const useCollections = () => useShopStore(collectionsSelector);
export const useCart = () => useShopStore(cartSelector);
export const useFavorites = () => useShopStore(favoritesSelector);
export const useShopLoading = () => useShopStore(isLoadingSelector);
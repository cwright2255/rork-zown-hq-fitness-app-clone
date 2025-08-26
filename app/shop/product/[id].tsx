import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  Modal,
  Platform,
  Animated
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Heart, 
  ShoppingBag, 
  Star, 
  ChevronDown, 
  ChevronUp, 
  Share2, 
  Shirt, 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react-native';
import { useShopStore } from '@/store/shopStore';
import { useProgressStore } from '@/store/progressStore';
import { Product, ProductVariant } from '@/types';
import Colors from '@/constants/colors';
import ProductCard from '@/components/ProductCard';

const { width, height } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { 
    getProductById, 
    getRelatedProducts, 
    addToCart, 
    isFavorite, 
    toggleFavorite, 
    addToRecentlyViewed 
  } = useShopStore();
  const { getLatestBodyScan } = useProgressStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showVariants, setShowVariants] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showTryOn, setShowTryOn] = useState(false);
  
  // Try-on state
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [bodyScan, setBodyScan] = useState<any>(null);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [colorOptions, setColorOptions] = useState<{id: string, name: string, color: string}[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  useEffect(() => {
    if (id) {
      const foundProduct = getProductById(id);
      if (foundProduct) {
        setProduct(foundProduct);
        setRelatedProducts(getRelatedProducts(id));
        
        // If product has variants, select the first one by default
        if (foundProduct.variants && foundProduct.variants.length > 0) {
          setSelectedVariant(foundProduct.variants[0]);
          // Fix for TS2345: Convert undefined to null
          setSelectedSize(foundProduct.variants[0].attributes?.size || null);
          
          // Extract color options from variants
          const options = foundProduct.variants.map(variant => ({
            id: variant.id,
            name: variant.name,
            color: variant.attributes?.color || '#000000'
          }));
          setColorOptions(options);
        }
        
        // Add to recently viewed
        addToRecentlyViewed(id);
      }
      setIsLoading(false);
    }
  }, [id, getProductById, getRelatedProducts, addToRecentlyViewed]);
  
  useEffect(() => {
    // Get the latest body scan for try-on
    const latestScan = getLatestBodyScan();
    setBodyScan(latestScan);
  }, [getLatestBodyScan]);
  
  const handleAddToCart = () => {
    if (product) {
      addToCart(
        product.id,
        selectedVariant?.id,
        quantity,
        selectedVariant?.attributes?.size || undefined
      );
      
      // Show success message or navigate to cart
      router.push('/shop/cart');
    }
  };
  
  const handleTryOn = () => {
    setShowTryOn(true);
    
    // Animate in the content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  };
  
  const closeTryOn = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 20,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowTryOn(false);
    });
  };
  
  const toggleVariantsView = () => {
    setShowVariants(!showVariants);
  };
  
  const selectVariant = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    // Fix for TS2345: Convert undefined to null
    setSelectedSize(variant.attributes?.size || null);
    setShowVariants(false);
    setSelectedImageIndex(0); // Reset image index when changing variant
  };
  
  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };
  
  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };
  
  const handleRotate = (direction: 'left' | 'right') => {
    setRotation(prev => {
      if (direction === 'left') {
        return (prev - 45) % 360;
      } else {
        return (prev + 45) % 360;
      }
    });
  };
  
  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      if (direction === 'in' && prev < 1.5) {
        return prev + 0.1;
      } else if (direction === 'out' && prev > 0.5) {
        return prev - 0.1;
      }
      return prev;
    });
  };
  
  const handleColorChange = (direction: 'prev' | 'next') => {
    if (!product || !product.variants || product.variants.length <= 1) return;
    
    setActiveColorIndex(prevIndex => {
      if (direction === 'prev') {
        const newIndex = prevIndex === 0 ? product.variants!.length - 1 : prevIndex - 1;
        setSelectedVariant(product.variants![newIndex]);
        // Fix for TS2345: Convert undefined to null
        setSelectedSize(product.variants![newIndex].attributes?.size || null);
        return newIndex;
      } else {
        const newIndex = prevIndex === product.variants!.length - 1 ? 0 : prevIndex + 1;
        setSelectedVariant(product.variants![newIndex]);
        // Fix for TS2345: Convert undefined to null
        setSelectedSize(product.variants![newIndex].attributes?.size || null);
        return newIndex;
      }
    });
  };
  
  // Get the appropriate mannequin image based on the product category
  const getMannequinImage = () => {
    // In a real app, you would have different mannequin images for different product types
    return 'https://images.unsplash.com/photo-1564466809058-bf4114d55352?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=686&q=80';
  };
  
  // Get the appropriate product overlay image
  const getProductOverlayImage = () => {
    // In a real app, this would be a transparent PNG that overlays on the mannequin
    // For now, we'll use the product image
    return selectedVariant ? selectedVariant.imageUrl || product?.imageUrl : product?.imageUrl;
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading product...</Text>
      </SafeAreaView>
    );
  }
  
  if (!product) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const productFavorite = isFavorite(product.id);
  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const isOutOfStock = selectedVariant ? !selectedVariant.inStock : false;
  const canTryOn = product.category === 'apparel' || product.category === 'footwear';
  
  // Get product images - use variant image if available, otherwise use product image
  const productImages = [
    selectedVariant?.imageUrl || product.imageUrl,
    // Add additional images here - in a real app, you would have multiple images per product
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500',
    'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=500'
  ];
  
  // Available sizes from variants
  const availableSizes = product.variants 
    ? [...new Set(product.variants.map(v => v.attributes?.size).filter(Boolean))]
    : [];
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Main product image */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: productImages[selectedImageIndex] }} 
            style={styles.mainImage}
            resizeMode="cover"
          />
          
          {/* Image thumbnails */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailsContainer}
          >
            {productImages.map((image, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.thumbnailButton,
                  selectedImageIndex === index && styles.selectedThumbnail
                ]}
                onPress={() => setSelectedImageIndex(index)}
              >
                <Image 
                  source={{ uri: image }} 
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.category}>{product.category.toUpperCase()}</Text>
              <Text style={styles.title}>{product.name}</Text>
              
              <View style={styles.ratingContainer}>
                <Star size={16} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
                <Text style={styles.reviews}>({product.reviewCount} reviews)</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.favoriteButton}
              onPress={() => toggleFavorite(product.id)}
            >
              <Heart 
                size={24} 
                color={productFavorite ? Colors.secondary : Colors.text.secondary}
                fill={productFavorite ? Colors.secondary : 'transparent'}
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>${currentPrice.toFixed(2)}</Text>
          </View>
          
          {canTryOn && (
            <TouchableOpacity 
              style={styles.tryOnButton}
              onPress={handleTryOn}
            >
              <Shirt size={20} color={Colors.text.inverse} />
              <Text style={styles.tryOnText}>Virtual Try-On</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.description}>{product.description}</Text>
          
          {product.variants && product.variants.length > 0 && (
            <View style={styles.variantsContainer}>
              <Text style={styles.sectionTitle}>Options</Text>
              
              <TouchableOpacity 
                style={styles.variantSelector}
                onPress={toggleVariantsView}
              >
                <Text style={styles.variantText}>
                  {selectedVariant?.name || 'Select option'}
                </Text>
                {showVariants ? (
                  <ChevronUp size={20} color={Colors.text.secondary} />
                ) : (
                  <ChevronDown size={20} color={Colors.text.secondary} />
                )}
              </TouchableOpacity>
              
              {showVariants && (
                <View style={styles.variantsList}>
                  {product.variants.map(variant => (
                    <TouchableOpacity 
                      key={variant.id}
                      style={[
                        styles.variantItem,
                        selectedVariant?.id === variant.id && styles.selectedVariant
                      ]}
                      onPress={() => selectVariant(variant)}
                      disabled={!variant.inStock}
                    >
                      <Text 
                        style={[
                          styles.variantItemText,
                          selectedVariant?.id === variant.id && styles.selectedVariantText,
                          !variant.inStock && styles.outOfStockText
                        ]}
                      >
                        {variant.name} - ${variant.price.toFixed(2)}
                        {!variant.inStock && ' (Out of Stock)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          
          <View style={styles.quantityContainer}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={decrementQuantity}
                disabled={quantity <= 1}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>{quantity}</Text>
              
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={incrementQuantity}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {relatedProducts.length > 0 && (
            <View style={styles.relatedContainer}>
              <Text style={styles.sectionTitle}>You May Also Like</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedProductsScroll}
              >
                {relatedProducts.map(relatedProduct => (
                  <ProductCard 
                    key={relatedProduct.id}
                    product={relatedProduct}
                    onPress={() => {
                      router.push(`/shop/product/${relatedProduct.id}`);
                    }}
                    compact={true}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={() => {/* Share functionality */}}
        >
          <Share2 size={24} color={Colors.text.secondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.addToCartButton,
            isOutOfStock && styles.disabledButton
          ]}
          onPress={handleAddToCart}
          disabled={isOutOfStock}
        >
          <ShoppingBag size={20} color={Colors.text.inverse} />
          <Text style={styles.addToCartText}>
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Virtual Try-On Modal */}
      <Modal
        visible={showTryOn}
        animationType="slide"
        transparent={false}
        onRequestClose={closeTryOn}
      >
        <SafeAreaView style={styles.tryOnModalContainer}>
          {/* Custom Header */}
          <View style={styles.tryOnHeader}>
            <TouchableOpacity 
              style={styles.tryOnBackButton}
              onPress={closeTryOn}
            >
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.tryOnHeaderTitle}>Virtual Try-On</Text>
            <View style={styles.tryOnHeaderRight}>
              <TouchableOpacity 
                style={styles.tryOnHeaderIconButton}
                onPress={() => toggleFavorite(product.id)}
              >
                <Heart 
                  size={22} 
                  color={productFavorite ? Colors.error : Colors.text.primary}
                  fill={productFavorite ? Colors.error : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.tryOnHeaderIconButton}
                onPress={() => {/* Share action */}}
              >
                <Share2 size={22} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView style={styles.tryOnScrollContainer} showsVerticalScrollIndicator={false}>
            <Animated.View 
              style={[
                styles.tryOnContent,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {/* Color Selector */}
              <View style={styles.colorSelector}>
                <Text style={styles.colorSelectorTitle}>Colors</Text>
                
                <View style={styles.colorNavigation}>
                  <TouchableOpacity 
                    style={styles.colorNavButton}
                    onPress={() => handleColorChange('prev')}
                    disabled={!product.variants || product.variants.length <= 1}
                  >
                    <ChevronLeft size={20} color={product.variants && product.variants.length > 1 ? Colors.text.primary : Colors.text.tertiary} />
                  </TouchableOpacity>
                  
                  <View style={styles.colorSwatch}>
                    {selectedVariant && selectedVariant.attributes && (
                      <View 
                        style={[
                          styles.colorSwatchInner,
                          { backgroundColor: selectedVariant.attributes.color || Colors.primary }
                        ]}
                      />
                    )}
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.colorNavButton}
                    onPress={() => handleColorChange('next')}
                    disabled={!product.variants || product.variants.length <= 1}
                  >
                    <ChevronRight size={20} color={product.variants && product.variants.length > 1 ? Colors.text.primary : Colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.colorName}>
                  {selectedVariant ? selectedVariant.name : 'Default'}
                </Text>
              </View>
              
              {/* Main Content */}
              <View style={styles.tryOnMainContent}>
                {/* Left Side - Color Options */}
                <View style={styles.colorOptionsContainer}>
                  {colorOptions.map((option, index) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.colorOption,
                        selectedVariant?.id === option.id && styles.selectedColorOption
                      ]}
                      onPress={() => {
                        const variant = product.variants?.find(v => v.id === option.id);
                        if (variant) {
                          setSelectedVariant(variant);
                          // Fix for TS2345: Convert undefined to null
                          setSelectedSize(variant.attributes?.size || null);
                          setActiveColorIndex(index);
                        }
                      }}
                    >
                      <View 
                        style={[
                          styles.colorOptionInner,
                          { backgroundColor: option.color }
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Center - 3D Model View */}
                <View style={styles.modelContainer}>
                  <Image 
                    source={{ uri: getMannequinImage() }}
                    style={[
                      styles.mannequinImage,
                      { transform: [{ scale: zoom }, { rotate: `${rotation}deg` }] }
                    ]}
                    resizeMode="contain"
                  />
                  <Image 
                    source={{ uri: getProductOverlayImage() }}
                    style={[
                      styles.productOverlay,
                      { transform: [{ scale: zoom }, { rotate: `${rotation}deg` }] }
                    ]}
                    resizeMode="contain"
                  />
                </View>
              </View>
              
              {/* Controls */}
              <View style={styles.controlsContainer}>
                {/* Rotation Controls */}
                <View style={styles.controlGroup}>
                  <View style={styles.controlLabelContainer}>
                    <Text style={styles.controlLabel}>Rotation</Text>
                    <Text style={styles.controlValue}>{rotation}°</Text>
                  </View>
                  <View style={styles.rotationControls}>
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => handleRotate('left')}
                    >
                      <RotateCcw size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                    
                    <View style={styles.webSlider}>
                      <TouchableOpacity 
                        style={styles.webSliderButton}
                        onPress={() => setRotation(Math.max(0, rotation - 45))}
                      >
                        <Text>-</Text>
                      </TouchableOpacity>
                      <View style={styles.webSliderTrack}>
                        <View 
                          style={[
                            styles.webSliderFill, 
                            { width: `${(rotation / 360) * 100}%` }
                          ]} 
                        />
                      </View>
                      <TouchableOpacity 
                        style={styles.webSliderButton}
                        onPress={() => setRotation(Math.min(360, rotation + 45))}
                      >
                        <Text>+</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => handleRotate('right')}
                    >
                      <RotateCcw size={20} color={Colors.text.primary} style={{ transform: [{ scaleX: -1 }] }} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Zoom Controls */}
                <View style={styles.controlGroup}>
                  <View style={styles.controlLabelContainer}>
                    <Text style={styles.controlLabel}>Zoom</Text>
                    <Text style={styles.controlValue}>{(zoom * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={styles.zoomControls}>
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => handleZoom('out')}
                    >
                      <ZoomOut size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                    
                    <View style={styles.webSlider}>
                      <TouchableOpacity 
                        style={styles.webSliderButton}
                        onPress={() => setZoom(Math.max(0.5, zoom - 0.1))}
                      >
                        <Text>-</Text>
                      </TouchableOpacity>
                      <View style={styles.webSliderTrack}>
                        <View 
                          style={[
                            styles.webSliderFill, 
                            { width: `${((zoom - 0.5) / 1) * 100}%` }
                          ]} 
                        />
                      </View>
                      <TouchableOpacity 
                        style={styles.webSliderButton}
                        onPress={() => setZoom(Math.min(1.5, zoom + 0.1))}
                      >
                        <Text>+</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => handleZoom('in')}
                    >
                      <ZoomIn size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Size Selection */}
                {availableSizes.length > 0 && (
                  <View style={styles.sizeContainer}>
                    <Text style={styles.controlLabel}>Size</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.sizeScroll}
                      contentContainerStyle={styles.sizeScrollContent}
                    >
                      {availableSizes.map((size) => (
                        <TouchableOpacity
                          key={size}
                          style={[
                            styles.sizeOption,
                            selectedSize === size && styles.selectedSizeOption
                          ]}
                          onPress={() => {
                            setSelectedSize(size || null);
                            // Find and select the variant with this size
                            const variant = product.variants?.find(v => v.attributes?.size === size);
                            if (variant) {
                              setSelectedVariant(variant);
                              const index = product.variants?.findIndex(v => v.id === variant.id) || 0;
                              setActiveColorIndex(index >= 0 ? index : 0);
                            }
                          }}
                        >
                          <Text 
                            style={[
                              styles.sizeText,
                              selectedSize === size && styles.selectedSizeText
                            ]}
                          >
                            {size}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              
              {/* Measurements Panel */}
              <View style={styles.measurementsPanel}>
                <View style={styles.measurementsPanelHeader}>
                  <Text style={styles.measurementsPanelTitle}>Your Measurements</Text>
                </View>
                
                <View style={styles.measurementsGrid}>
                  {bodyScan ? (
                    <>
                      <View style={styles.measurementItem}>
                        <Text style={styles.measurementLabel}>Chest</Text>
                        <Text style={styles.measurementValue}>{bodyScan.measurements.chest} cm</Text>
                      </View>
                      <View style={styles.measurementItem}>
                        <Text style={styles.measurementLabel}>Waist</Text>
                        <Text style={styles.measurementValue}>{bodyScan.measurements.waist} cm</Text>
                      </View>
                      <View style={styles.measurementItem}>
                        <Text style={styles.measurementLabel}>Hips</Text>
                        <Text style={styles.measurementValue}>{bodyScan.measurements.hips} cm</Text>
                      </View>
                      <View style={styles.measurementItem}>
                        <Text style={styles.measurementLabel}>Arms</Text>
                        <Text style={styles.measurementValue}>{bodyScan.measurements.arms} cm</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noMeasurementsText}>No body scan data available</Text>
                  )}
                </View>
              </View>
            </Animated.View>
          </ScrollView>
          
          {/* Bottom Panel */}
          <View style={styles.tryOnBottomPanel}>
            <View style={styles.tryOnProductInfo}>
              <Text style={styles.tryOnProductName}>{product.name}</Text>
              <Text style={styles.tryOnProductPrice}>
                ${selectedVariant ? selectedVariant.price.toFixed(2) : product.price.toFixed(2)}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.tryOnAddToBagButton}
              onPress={() => {
                addToCart(
                  product.id,
                  selectedVariant?.id,
                  quantity,
                  selectedSize || undefined
                );
                closeTryOn();
                router.push('/shop/cart');
              }}
            >
              <ShoppingBag size={18} color={Colors.text.inverse} />
              <Text style={styles.tryOnAddToBagText}>Add to Bag</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
  imageContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
  },
  mainImage: {
    width: '100%',
    height: 350,
  },
  thumbnailsContainer: {
    padding: 10,
    backgroundColor: Colors.background,
  },
  thumbnailButton: {
    width: 60,
    height: 60,
    marginRight: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  selectedThumbnail: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  category: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  reviews: {
    marginLeft: 4,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.card,
  },
  priceContainer: {
    marginBottom: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  tryOnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  tryOnText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  description: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 24,
    lineHeight: 24,
  },
  variantsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  variantSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
  variantText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  variantsList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  variantItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  selectedVariant: {
    backgroundColor: Colors.primary + '20',
  },
  variantItemText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  selectedVariantText: {
    fontWeight: '600',
    color: Colors.primary,
  },
  outOfStockText: {
    color: Colors.text.secondary,
  },
  quantityContainer: {
    marginBottom: 24,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  quantityText: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  relatedContainer: {
    marginBottom: 24,
  },
  relatedProductsScroll: {
    paddingRight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  shareButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 24,
  },
  disabledButton: {
    backgroundColor: Colors.inactive,
  },
  addToCartText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Try-On Modal Styles
  tryOnModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tryOnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tryOnBackButton: {
    padding: 8,
  },
  tryOnHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tryOnHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tryOnHeaderIconButton: {
    padding: 8,
    marginLeft: 8,
  },
  tryOnScrollContainer: {
    flex: 1,
  },
  tryOnContent: {
    paddingBottom: 80, // Add padding to account for bottom panel
  },
  colorSelector: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colorSelectorTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  colorNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorNavButton: {
    padding: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  colorSwatchInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorName: {
    fontSize: 14,
    color: Colors.text.primary,
    marginTop: 8,
  },
  tryOnMainContent: {
    flexDirection: 'row',
    height: 400, // Fixed height for the model view
  },
  colorOptionsContainer: {
    width: 60,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedColorOption: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  colorOptionInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  modelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    position: 'relative',
    overflow: 'hidden',
  },
  mannequinImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  productOverlay: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  controlsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  controlGroup: {
    marginBottom: 16,
  },
  controlLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  controlValue: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  rotationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    padding: 8,
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Web slider alternative
  webSlider: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  webSliderButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webSliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  webSliderFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sizeContainer: {
    marginBottom: 16,
  },
  sizeScroll: {
    marginTop: 8,
  },
  sizeScrollContent: {
    paddingRight: 16,
  },
  sizeOption: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  selectedSizeOption: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  sizeText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  selectedSizeText: {
    color: Colors.text.inverse,
  },
  measurementsPanel: {
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  measurementsPanelHeader: {
    marginBottom: 12,
  },
  measurementsPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  measurementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  measurementItem: {
    width: '48%',
    marginBottom: 12,
  },
  measurementLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  measurementValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  noMeasurementsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  tryOnBottomPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tryOnProductInfo: {
    flex: 1,
  },
  tryOnProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  tryOnProductPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tryOnAddToBagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    width: 150,
  },
  tryOnAddToBagText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
});
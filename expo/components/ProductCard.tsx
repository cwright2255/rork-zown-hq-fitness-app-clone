import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, GestureResponderEvent as RNGestureResponderEvent } from 'react-native';
import { Star, ShoppingCart, Shirt } from 'lucide-react-native';
import { Product } from '@/types';
import Colors from '@/constants/colors';
import Card from './Card';
import { useRouter, Href } from 'expo-router';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onAddToCart?: () => void;
  compact?: boolean; // Added compact prop
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  compact = false, // Default to false
}) => {
  const { name, price, imageUrl, rating, reviewCount, category } = product;
  const router = useRouter();
  
  const handleAddToCart = (e: RNGestureResponderEvent) => {
    e.stopPropagation();
    if (onAddToCart) onAddToCart();
  };
  
  const handleTryOn = (e: RNGestureResponderEvent) => {
    e.stopPropagation();
    router.push({
      pathname: `/shop/product/${product.id}` as Href,
      params: { showTryOn: 'true' }
    } as any);
  };
  
  const canTryOn = category === 'apparel' || category === 'footwear';
  
  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.8} 
      style={[
        styles.container,
        compact && styles.compactContainer
      ]}
    >
      <Card variant="elevated" style={styles.card} padding="none">
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={[
              styles.image,
              compact && styles.compactImage
            ]}
            resizeMode="cover"
          />
          
          {canTryOn && (
            <TouchableOpacity 
              style={styles.tryOnBadge}
              onPress={handleTryOn}
            >
              <Shirt size={14} color={Colors.text.inverse} />
              <Text style={styles.tryOnText}>Try On</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.content}>
          <Text 
            style={styles.name} 
            numberOfLines={compact ? 1 : 2}
          >
            {name}
          </Text>
          
          <View style={styles.ratingContainer}>
            <Star size={14} color={Colors.warning} fill={Colors.warning} />
            <Text style={styles.rating}>{(rating ?? 0).toFixed(1)}</Text>
            <Text style={styles.reviews}>({reviewCount})</Text>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.price}>${price.toFixed(2)}</Text>
            
            {!compact && (
              <TouchableOpacity 
                style={styles.cartButton} 
                onPress={handleAddToCart}
                activeOpacity={0.8}
              >
                <ShoppingCart size={16} color={Colors.text.inverse} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  compactContainer: {
    width: 160,
    marginRight: 12,
  },
  card: {
    overflow: 'hidden',
    height: '100%',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#f5f5f5',
  },
  compactImage: {
    height: 120,
  },
  tryOnBadge: {
    position: 'absolute',
    top: Colors.spacing.sm,
    right: Colors.spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Colors.spacing.xs,
    paddingHorizontal: Colors.spacing.sm,
    borderRadius: Colors.radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tryOnText: {
    color: Colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: Colors.spacing.xs,
  },
  content: {
    padding: Colors.spacing.md,
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Colors.spacing.xs,
    height: 40,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.sm,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginLeft: Colors.spacing.xs,
  },
  reviews: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginLeft: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cartButton: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: Colors.radius.large,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProductCard;
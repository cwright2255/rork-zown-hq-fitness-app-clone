import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Heart } from 'lucide-react-native';
import { tokens } from '../../theme/tokens';

const ProductCard = ({ product, onPress, onAddToCart, compact = false }) => {
  const { name, price, imageUrl } = product;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, compact && styles.compact]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        <TouchableOpacity style={styles.heart} hitSlop={8} onPress={(e) => e.stopPropagation?.()}>
          <Heart size={18} color=tokens.colors.ink.light />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.price}>${Number(price).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: tokens.colors.ink.darker,
    borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface,
    borderRadius: 16, overflow: 'hidden',
  },
  compact: { width: 160 },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 160, backgroundColor: tokens.colors.ink.darkest },
  heart: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 12 },
  name: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  price: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '600' },
});

export default ProductCard;

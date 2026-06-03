import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Star } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import ProductCard from '@/components/ProductCard';
import { useShopStore } from '@/store/shopStore';
import { tokens } from '../../../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const productId = typeof id === 'string' ? id : '';
  const { getProductById, addToCart, getRelatedProducts, addToRecentlyViewed } = useShopStore();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!productId) return;
    const p = getProductById?.(productId);
    if (p) {
      setProduct(p);
      if (p.variants?.length) setSelectedVariant(p.variants[0]);
      addToRecentlyViewed?.(p.id);
      const rel = getRelatedProducts?.(p.id);
      setRelated(rel || []);
    }
  }, [productId, getProductById, getRelatedProducts, addToRecentlyViewed]);

  if (!product) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}>
          <Text style={styles.empty}>Product not found</Text>
        </View>
      </View>
    );
  }

  const handleAdd = () => {
    addToCart?.(product, selectedVariant || (product.variants?.[0] ?? null), 1);
    Alert.alert('Added', `${product.name} added to cart.`);
  };

  const currentPrice = selectedVariant?.price || product.price;
  const hasSize = product.variants?.some(v => v.attributes?.size);

  return (
    <View style={styles.container}>
      <View style={styles.headerOverlay}>
        <ScreenHeader showBack transparent />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Image source={{ uri: product.imageUrl }} style={styles.image} />

        <View style={{ padding: tokens.spacing.md }}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>${Number(currentPrice).toFixed(2)}</Text>

          <View style={styles.ratingRow}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.rating}>{(product.rating ?? 0).toFixed(1)}</Text>
            <Text style={styles.reviews}>({product.reviewCount ?? 0} reviews)</Text>
          </View>

          {hasSize ? (
            <>
              <Text style={styles.sectionLabel}>Size</Text>
              <View style={styles.pillRow}>
                {product.variants.map(v => {
                  const active = selectedVariant?.id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                      onPress={() => setSelectedVariant(v)}>
                      <Text style={[styles.pillText, { color: active ? '#000' : '#999' }]}>
                        {v.attributes?.size || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          {product.variants?.some(v => v.attributes?.color) ? (
            <>
              <Text style={styles.sectionLabel}>Color</Text>
              <View style={styles.pillRow}>
                {product.variants.map(v => {
                  const active = selectedVariant?.id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                      onPress={() => setSelectedVariant(v)}>
                      <Text style={[styles.pillText, { color: active ? '#000' : '#999' }]}>
                        {v.attributes?.color || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionLabel}>Description</Text>
          <TouchableOpacity
            style={styles.descCard}
            onPress={() => setExpanded(!expanded)}>
            <Text style={styles.descText} numberOfLines={expanded ? undefined : 3}>
              {product.description}
            </Text>
            <Text style={styles.expandHint}>
              {expanded ? 'Show less' : 'Show more'}
            </Text>
          </TouchableOpacity>

          {related.length ? (
            <>
              <Text style={styles.sectionLabel}>Related</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: tokens.spacing.md }}>
                  {related.slice(0, 5).map(rp => (
                    <View key={rp.id} style={{ width: 160 }}>
                      <ProductCard
                        product={rp}
                        compact
                        onPress={() => router.push(`/shop/product/${rp.id}`)}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="Add to Cart" onPress={handleAdd} />
        <PrimaryButton title="Save for Later" variant="outline" onPress={() => { /* TODO: Connect to real API */ }} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: tokens.colors.dark_navy.text_muted },
  image: { width: '100%', height: 300, backgroundColor: tokens.colors.dark_navy.text_primary },
  name: { fontSize: 28, fontWeight: '700', color: tokens.colors.dark_navy.bg_primary, letterSpacing: -0.5 },
  price: { fontSize: 22, fontWeight: '700', color: tokens.colors.dark_navy.bg_primary, marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  rating: { color: tokens.colors.dark_navy.bg_primary, fontSize: 13, fontWeight: '600' },
  reviews: { color: tokens.colors.dark_navy.text_muted, fontSize: 13 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm, marginTop: 20,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  pill: { paddingVertical: 10, paddingHorizontal: tokens.spacing.md, borderRadius: 999 },
  pillActive: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  pillInactive: { backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border },
  pillText: { fontSize: 13, fontWeight: '600' },
  descCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  descText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, lineHeight: 20 },
  expandHint: { color: tokens.colors.dark_navy.text_muted, fontSize: 12, marginTop: 8 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

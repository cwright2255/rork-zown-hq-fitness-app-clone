import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_CARD_W = (SCREEN_W - 52) / 2;

/* ── Data ── */

const CATEGORIES = ['All', 'Apparel', 'Footwear', 'Equipment', 'Accessories', 'Supplements', 'Tech'];

const NEW_ARRIVALS = [
  { id: 'p1', brand: 'ZOWN', name: 'Performance Tee', price: '$45', icon: 'shirt-outline' },
  { id: 'p2', brand: 'ZOWN', name: 'Training Shorts', price: '$55', icon: 'fitness-outline' },
  { id: 'p3', brand: 'Nike', name: 'Air Zoom Pegasus', price: '$130', icon: 'footsteps-outline' },
  { id: 'p4', brand: 'ZOWN', name: 'Gym Duffle Bag', price: '$80', icon: 'bag-outline' },
  { id: 'p5', brand: 'Under Armour', name: 'Compression Leggings', price: '$65', icon: 'body-outline' },
];

const LOOKS = [
  { id: 'l1', label: 'Gym Ready', icon: 'barbell-outline' },
  { id: 'l2', label: 'Street Style', icon: 'walk-outline' },
  { id: 'l3', label: 'Run Club', icon: 'fitness-outline' },
  { id: 'l4', label: 'Recovery', icon: 'bed-outline' },
];

const TRENDING = [
  { id: 't1', brand: 'Theragun', name: 'Mini Massage Gun', price: '$199', icon: 'pulse-outline' },
  { id: 't2', brand: 'WHOOP', name: '4.0 Band', price: '$30/mo', icon: 'watch-outline' },
  { id: 't3', brand: 'Hydro Flask', name: '32oz Water Bottle', price: '$45', icon: 'water-outline' },
  { id: 't4', brand: 'ZOWN', name: 'Resistance Bands Set', price: '$35', icon: 'barbell-outline' },
  { id: 't5', brand: 'Beats', name: 'Fit Pro Earbuds', price: '$200', icon: 'headset-outline' },
];

const RECENT = [
  { id: 'rv1', price: '$45', icon: 'shirt-outline' },
  { id: 'rv2', price: '$130', icon: 'footsteps-outline' },
  { id: 'rv3', price: '$199', icon: 'pulse-outline' },
  { id: 'rv4', price: '$55', icon: 'fitness-outline' },
];

/* ── Section header ── */

function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onAction}><Text style={styles.viewAll}>{action || 'View All'}</Text></Pressable>
    </View>
  );
}

/* ── Product card ── */

function ProductCard({ item }) {
  return (
    <Pressable style={styles.productCard} onPress={() => { /* TODO: navigate to /shop/product/[id] */ }}>
      <View style={styles.productImage}>
        <Ionicons name={item.icon} size={32} color="#999" />
        <Pressable style={styles.heartBtn}>
          <Ionicons name="heart-outline" size={18} color="#000" />
        </Pressable>
      </View>
      <Text style={styles.productBrand}>{item.brand}</Text>
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productPrice}>{item.price}</Text>
    </Pressable>
  );
}

/* ── Look card ── */

function LookCard({ item }) {
  return (
    <Pressable style={[styles.lookCard, { width: GRID_CARD_W }]} onPress={() => { /* TODO: navigate to shop by look */ }}>
      <View style={styles.lookImage}>
        <Ionicons name={item.icon} size={32} color="#999" />
        <View style={styles.lookOverlay}>
          <Text style={styles.lookLabel}>{item.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/* ── Main screen ── */

export default function ShopScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cartCount] = useState(2);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('@/assets/branding/zown-logo-512.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Shop</Text>
          <View style={styles.headerIcons}>
            <Pressable style={styles.iconBtn} onPress={() => { /* TODO: search */ }}>
              <Ionicons name="search-outline" size={22} color="#000" />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => { /* TODO: /shop/cart */ }}>
              <Ionicons name="cart-outline" size={22} color="#000" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Digital try-on banner */}
        <Pressable style={styles.tryOnBanner} onPress={() => { /* TODO: /shop/try-on */ }}>
          <View style={styles.tryOnLeft}>
            <Text style={styles.tryOnTitle}>Digital Try-On</Text>
            <Text style={styles.tryOnSub}>See how gear looks on you with AR</Text>
            <View style={styles.tryOnBtn}><Text style={styles.tryOnBtnText}>Try Now</Text></View>
          </View>
          <Ionicons name="body-outline" size={60} color="rgba(255,255,255,0.3)" />
        </Pressable>

        {/* Category scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.catPill, selectedCategory === c && styles.catPillActive]}
              onPress={() => setSelectedCategory(c)}
            >
              <Text style={[styles.catPillText, selectedCategory === c && styles.catPillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* New arrivals */}
        <SectionHeader title="New Arrivals" onAction={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {NEW_ARRIVALS.map((item) => <ProductCard key={item.id} item={item} />)}
        </ScrollView>

        {/* Shop by look */}
        <SectionHeader title="Shop by Look" onAction={() => {}} />
        <View style={styles.lookGrid}>
          {LOOKS.map((item) => <LookCard key={item.id} item={item} />)}
        </View>

        {/* Trending now */}
        <SectionHeader title="Trending Now" onAction={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {TRENDING.map((item) => <ProductCard key={item.id} item={item} />)}
        </ScrollView>

        {/* Rewards banner */}
        <View style={styles.rewardsBanner}>
          <View style={styles.rewardsIcon}><Ionicons name="star" size={22} color="#FFD700" /></View>
          <View style={styles.rewardsText}>
            <Text style={styles.rewardsTitle}>ZOWN Rewards</Text>
            <Text style={styles.rewardsSub}>Earn XP on every purchase \u2022 Unlock exclusive gear</Text>
          </View>
          <Pressable style={styles.joinBtn}><Text style={styles.joinBtnText}>Join</Text></Pressable>
        </View>

        {/* Recently viewed */}
        <SectionHeader title="Recently Viewed" action="Clear" onAction={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {RECENT.map((item) => (
            <Pressable key={item.id} style={styles.recentCard}>
              <View style={styles.recentImage}><Ionicons name={item.icon} size={22} color="#999" /></View>
              <Text style={styles.recentPrice}>{item.price}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  logoRow: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  logo: { width: 120, height: 36 },

  /* Header */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#000' },
  headerIcons: { flexDirection: 'row', gap: 12 },
  iconBtn: { position: 'relative' },
  cartBadge: { position: 'absolute', top: -6, right: -8, backgroundColor: '#FF3B30', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  /* Digital try-on */
  tryOnBanner: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 20, backgroundColor: '#111', padding: 20, height: 140, flexDirection: 'row', alignItems: 'center' },
  tryOnLeft: { flex: 1 },
  tryOnTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  tryOnSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  tryOnBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginTop: 12, alignSelf: 'flex-start' },
  tryOnBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },

  /* Category */
  catScroll: { paddingLeft: 20, paddingRight: 6, marginBottom: 20 },
  catPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  catPillActive: { backgroundColor: '#000' },
  catPillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  catPillTextActive: { color: '#FFF' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#666' },

  /* Carousel */
  carousel: { paddingLeft: 20, paddingRight: 6, marginBottom: 24 },

  /* Product card */
  productCard: { width: 160, marginRight: 14 },
  productImage: {
    height: 200, borderRadius: 14, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  heartBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  productBrand: { fontSize: 11, color: '#999', marginTop: 8, textTransform: 'uppercase' },
  productName: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '700', color: '#000', marginTop: 2 },

  /* Look grid */
  lookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  lookCard: { marginBottom: 0 },
  lookImage: { height: 180, borderRadius: 14, backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  lookOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  lookLabel: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  /* Rewards */
  rewardsBanner: { marginHorizontal: 20, borderRadius: 16, backgroundColor: '#F5F5F5', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  rewardsIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  rewardsText: { flex: 1 },
  rewardsTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  rewardsSub: { fontSize: 12, color: '#666', marginTop: 2 },
  joinBtn: { backgroundColor: '#000', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  joinBtnText: { fontSize: 12, fontWeight: '600', color: '#FFF' },

  /* Recent */
  recentCard: { width: 100, marginRight: 12 },
  recentImage: { height: 100, borderRadius: 10, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  recentPrice: { fontSize: 12, fontWeight: '600', color: '#000', marginTop: 4 },
});

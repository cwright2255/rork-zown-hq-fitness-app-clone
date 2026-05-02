import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { useRecipeStore } from '@/store/recipeStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../theme/tokens';

const mockRecipes = [
  {
    id: '1',
    name: 'Whole-Grain Cinnamon-Apple Pancakes',
    category: 'breakfast',
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    calories: 320, protein: 12, carbs: 49, fat: 8,
    prepTime: 20,
  },
  {
    id: '2',
    name: 'Grilled Chicken Salad',
    category: 'lunch',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    calories: 380, protein: 35, carbs: 12, fat: 18,
    prepTime: 20,
  },
  {
    id: '3',
    name: 'Salmon with Quinoa',
    category: 'dinner',
    imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=500',
    calories: 450, protein: 32, carbs: 38, fat: 18,
    prepTime: 25,
  },
  {
    id: '4',
    name: 'Protein Smoothie',
    category: 'snack',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500',
    calories: 220, protein: 25, carbs: 20, fat: 5,
    prepTime: 5,
  },
];

export default function RecipesScreen() {
  const { savedRecipes, loadData } = useRecipeStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData?.();
  }, [loadData]);

  const all = [...mockRecipes, ...(savedRecipes || [])];
  const filtered = filter === 'all' ? all : all.filter(r => r.category === filter);

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Breakfast', value: 'breakfast' },
    { label: 'Lunch', value: 'lunch' },
    { label: 'Dinner', value: 'dinner' },
    { label: 'Snack', value: 'snack' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Recipes" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {filters.map(f => {
          const active = filter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
              <Text style={[styles.pillText, { color: active ? tokens.colors.grayscale.black : tokens.colors.sky.dark }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/recipe/${item.id}`)}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePh]} />
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{item.name}</Text>
              <View style={styles.macroRow}>
                <View style={[styles.chip, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Text style={[styles.chipText, { color: tokens.colors.brand.lighter }]}>{item.protein}g P</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
                  <Text style={[styles.chipText, { color: tokens.colors.legacy.legacy_f97316 }]}>{item.carbs}g C</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                  <Text style={[styles.chipText, { color: tokens.colors.legacy.legacy_a855f7 }]}>{item.fat}g F</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                  <Text style={[styles.chipText, { color: tokens.colors.green.light }]}>{item.calories} kcal</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  pillRow: { paddingHorizontal: 16, paddingVertical: 8, maxHeight: 56 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, marginRight: 8 },
  pillActive: { backgroundColor: tokens.colors.background.default },
  pillInactive: { backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface },
  pillText: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface,
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
  },
  image: { width: '100%', height: 160 },
  imagePh: { backgroundColor: tokens.colors.legacy.darkSurface },
  cardBody: { padding: 14 },
  cardName: { color: tokens.colors.background.default, fontSize: 16, fontWeight: '600' },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '600' },
});

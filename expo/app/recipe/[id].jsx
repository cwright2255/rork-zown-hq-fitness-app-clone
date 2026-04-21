import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useNutritionStore } from '@/store/nutritionStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const recipes = {
  '1': {
    id: '1',
    title: 'Whole-Grain Cinnamon-Apple Pancakes',
    description: 'Delicious and nutritious pancakes made with whole grains and fresh apples.',
    prepTime: 20, servings: 4,
    calories: 320, protein: 12, carbs: 49, fat: 8,
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    ingredients: [
      '2 medium gala or honeycrisp apples, peeled and cored',
      '2 tablespoons unsalted butter',
      '2 tablespoons maple syrup',
      '1 1/4 teaspoons ground cinnamon',
      '2/3 cup quick-cooking oats',
      '1/3 cup whole wheat flour',
      '1 teaspoon baking powder',
      '1/4 teaspoon salt',
      '2 large eggs',
      '1 cup milk',
    ],
    instructions: [
      'Dice one apple and slice the other. Heat butter in skillet, add diced apple with syrup and cinnamon. Cook until softened.',
      'Combine oats, flour, baking powder, cinnamon, and salt in a bowl.',
      'Whisk eggs, milk, syrup, vanilla. Combine with dry ingredients. Fold in apple.',
      'Heat skillet. Pour 1/4 cup batter per pancake. Cook until bubbles form, flip and cook 1-2 more minutes.',
      'Serve with apple slices and maple syrup.',
    ],
  },
  '2': {
    id: '2',
    title: 'Grilled Chicken Salad',
    description: 'Refreshing salad with grilled chicken and light vinaigrette.',
    prepTime: 20, servings: 2,
    calories: 380, protein: 35, carbs: 12, fat: 18,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    ingredients: ['2 chicken breasts', 'Mixed greens', 'Cherry tomatoes', 'Cucumber', 'Olive oil', 'Lemon'],
    instructions: ['Grill chicken.', 'Slice vegetables.', 'Toss with dressing.', 'Top with chicken.'],
  },
  '3': {
    id: '3',
    title: 'Salmon with Quinoa',
    description: 'Omega-3 rich salmon served over fluffy quinoa.',
    prepTime: 25, servings: 2,
    calories: 450, protein: 32, carbs: 38, fat: 18,
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=500',
    ingredients: ['2 salmon fillets', '1 cup quinoa', 'Lemon', 'Herbs', 'Olive oil'],
    instructions: ['Cook quinoa per package.', 'Season and sear salmon.', 'Plate and serve.'],
  },
  '4': {
    id: '4',
    title: 'Protein Smoothie',
    description: 'Quick post-workout protein shake.',
    prepTime: 5, servings: 1,
    calories: 220, protein: 25, carbs: 20, fat: 5,
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500',
    ingredients: ['1 scoop protein', '1 banana', '1 cup almond milk', 'Ice'],
    instructions: ['Blend all ingredients until smooth.'],
  },
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const recipeId = typeof id === 'string' ? id : '';
  const recipe = recipes[recipeId];
  const { addFoodToMeal } = useNutritionStore();

  if (!recipe) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}>
          <Text style={styles.empty}>Recipe not found</Text>
        </View>
      </View>
    );
  }

  const handleLog = () => {
    const food = {
      id: `recipe-${recipe.id}-${Date.now()}`,
      name: recipe.title,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      servingSize: `1/${recipe.servings} recipe`,
      imageUrl: recipe.image,
    };
    const today = new Date().toISOString().split('T')[0];
    const mealId = `meal-${Date.now()}`;
    addFoodToMeal?.(today, mealId, food);
    Alert.alert('Logged', 'Recipe added to your diary.', [
      { text: 'View', onPress: () => router.push('/nutrition') },
      { text: 'OK', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {recipe.image ? (
          <Image source={{ uri: recipe.image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePh]} />
        )}
        <View style={{ padding: 16 }}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.prepTime} min · Serves {recipe.servings}
          </Text>

          <View style={styles.macroRow}>
            <View style={[styles.chip, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Text style={[styles.chipText, { color: '#3B82F6' }]}>{recipe.protein}g P</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
              <Text style={[styles.chipText, { color: '#F97316' }]}>{recipe.carbs}g C</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
              <Text style={[styles.chipText, { color: '#A855F7' }]}>{recipe.fat}g F</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <Text style={[styles.chipText, { color: '#22C55E' }]}>{recipe.calories} kcal</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Ingredients</Text>
          <View style={styles.card}>
            {recipe.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingRow}>
                <View style={styles.dot} />
                <Text style={styles.ingText}>{ing}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Instructions</Text>
          {recipe.instructions.map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="Log This Meal" onPress={handleLog} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#999' },
  image: { width: '100%', height: 260 },
  imagePh: { backgroundColor: '#1A1A1A' },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  meta: { color: '#999', fontSize: 13, marginTop: 6 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 8, marginTop: 20,
  },
  card: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16,
  },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 10 },
  ingText: { color: '#fff', fontSize: 14, flex: 1 },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 14, marginBottom: 8,
    alignItems: 'flex-start', gap: 12,
  },
  stepNum: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    width: 28, textAlign: 'center',
  },
  stepText: { color: '#fff', fontSize: 14, flex: 1, lineHeight: 20 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

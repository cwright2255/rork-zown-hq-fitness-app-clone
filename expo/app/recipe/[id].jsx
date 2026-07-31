import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useNutritionStore } from '@/store/nutritionStore';
import { useRecipeStore } from '@/store/recipeStore';
import { useUserStore } from '@/store/userStore';
import { tokens } from '../../../theme/tokens';

// Turns a real saved-recipe ingredient (an object: {id, name, amount, unit},
// the shape services/recipeExtractionService.js's AI extraction produces)
// into the plain display string this screen's rendering expects. Handles
// legacy/plain-string ingredients too, in case any were saved before this
// normalization existed.
function formatIngredient(ing) {
  if (typeof ing === 'string') return ing;
  if (!ing) return '';
  const amount = ing.amount ? `${ing.amount} ` : '';
  const unit = ing.unit ? `${ing.unit} ` : '';
  return `${amount}${unit}${ing.name || ''}`.trim();
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const recipeId = typeof id === 'string' ? id : '';
  const { addFoodToMeal } = useNutritionStore();
  const { savedRecipes, loadRecipes } = useRecipeStore();
  const { user } = useUserStore();

  React.useEffect(() => {
    // Covers the case of opening a direct link to a recipe (e.g. from a
    // notification or another device) before this session has loaded the
    // user's saved recipes yet.
    if (user?.uid && savedRecipes.length === 0) loadRecipes(user.uid);
  }, [user?.uid]);

  const rawRecipe = savedRecipes.find((r) => r.id === recipeId);
  const recipe = rawRecipe
    ? {
        ...rawRecipe,
        title: rawRecipe.title || rawRecipe.name,
        image: rawRecipe.image || rawRecipe.imageUrl,
        ingredients: (rawRecipe.ingredients || []).map(formatIngredient),
      }
    : null;

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
      calories: recipe.calories ?? 0,
      protein: recipe.protein ?? 0,
      carbs: recipe.carbs ?? 0,
      fat: recipe.fat ?? 0,
      servingSize: `1/${recipe.servings || 4} recipe`,
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
        <View style={{ padding: tokens.spacing.md }}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.prepTime} min · Serves {recipe.servings}
          </Text>

          {recipe.hasNutritionEstimate !== false && recipe.calories != null ? (
            <View style={styles.macroRow}>
              <View style={[styles.chip, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Text style={[styles.chipText, { color: '#3B82F6' }]}>{recipe.protein ?? 0}g P</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
                <Text style={[styles.chipText, { color: '#F97316' }]}>{recipe.carbs ?? 0}g C</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                <Text style={[styles.chipText, { color: '#A855F7' }]}>{recipe.fat ?? 0}g F</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Text style={[styles.chipText, { color: '#22C55E' }]}>{recipe.calories} kcal</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.meta}>Nutrition estimate not available for this recipe</Text>
          )}

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
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: tokens.colors.dark_navy.text_muted },
  image: { width: '100%', height: 260 },
  imagePh: { backgroundColor: tokens.colors.dark_navy.text_primary },
  title: { fontSize: 28, fontWeight: '700', color: tokens.colors.dark_navy.bg_primary, letterSpacing: -0.5 },
  meta: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 6 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: tokens.spacing.sm },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm, marginTop: 20,
  },
  card: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.dark_navy.bg_primary, marginRight: 10 },
  ingText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, flex: 1 },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: 14, marginBottom: tokens.spacing.sm,
    alignItems: 'flex-start', gap: tokens.spacing.md,
  },
  stepNum: {
    color: tokens.colors.dark_navy.bg_primary, fontSize: 18, fontWeight: '700',
    width: 28, textAlign: 'center',
  },
  stepText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, flex: 1, lineHeight: 20 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

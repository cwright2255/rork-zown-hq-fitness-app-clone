import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useNutritionStore } from '@/store/nutritionStore';
import { useRecipeStore } from '@/store/recipeStore';
import GroceryListButton from '@/components/GroceryListButton';
import { isRecipeOnList } from '@/lib/groceryList';
import {
  MAX_SERVINGS, canConvert, clampServings, displayIngredient, parseServings, scaleFactor,
} from '@/lib/recipeScale';
import { cookingSteps } from '@/lib/cookingSteps';
import CookingMode from '@/components/CookingMode';
import PlanTargetSheet from '@/components/PlanTargetSheet';
import { useMealPlanStore } from '@/store/mealPlanStore';
import { dayLabel } from '@/lib/mealCopy';
import { useUserStore } from '@/store/userStore';
import { localDateKey } from '@/lib/localDate';
import { MEAL_SLOTS, slotForHour } from '@/lib/foodLog';
import { tokens } from '../../../theme/tokens';

// Ingredients are saved as objects ({id, name, amount, unit}, the shape
// services/recipeExtractionService.js's AI extraction produces) or as plain
// text. lib/recipeScale.js turns either into the line shown here, for the
// number of servings and the units the person picked.
const UNIT_CHOICES = [
  { id: 'original', label: 'As written' },
  { id: 'us', label: 'US' },
  { id: 'metric', label: 'Metric' },
];

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const recipeId = typeof id === 'string' ? id : '';
  const { addFoodToMeal } = useNutritionStore();
  const { savedRecipes, loadRecipes, groceryList, addToGroceryList } = useRecipeStore();
  const { user } = useUserStore();
  // Which meal the recipe is logged to. Starts on the one that fits the time of day.
  const [slotId, setSlotId] = React.useState(() => slotForHour(new Date().getHours()));
  // How many servings to cook (null: as the recipe is written), which units to
  // show, and whether cooking mode is open.
  const [servings, setServings] = React.useState(null);
  const [system, setSystem] = React.useState('original');
  const [cooking, setCooking] = React.useState(false);
  // Whether the sheet for picking a day and meal on the meal plan is open.
  const [planning, setPlanning] = React.useState(false);

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

  const baseServings = parseServings(recipe.servings);
  const servingsNow = servings === null ? baseServings : servings;
  const factor = scaleFactor(baseServings, servingsNow);
  const ingredientList = Array.isArray(rawRecipe.ingredients) ? rawRecipe.ingredients : [];
  const ingredientLines = ingredientList.map((ing) => displayIngredient(ing, { factor, system }));
  const steps = cookingSteps(recipe.instructions);

  const hasNutrition = recipe.hasNutritionEstimate !== false && recipe.calories != null;
  const onGroceryList = isRecipeOnList(groceryList, recipe.id);

  const logNow = () => {
    const food = {
      id: `recipe-${recipe.id}`,
      name: recipe.title,
      calories: recipe.calories ?? 0,
      protein: recipe.protein ?? 0,
      carbs: recipe.carbs ?? 0,
      fat: recipe.fat ?? 0,
      servingSize: '1 serving',
      imageUrl: recipe.image,
    };
    // One of the four meal slots (not a made-up id), so it shows up in the diary.
    addFoodToMeal?.(localDateKey(), slotId, food);
    Alert.alert('Logged', 'Recipe added to your diary.', [
      { text: 'View', onPress: () => router.push('/nutrition') },
      { text: 'OK', style: 'cancel' },
    ]);
  };

  // Puts one serving of the recipe on the meal plan (the plan screen changes the servings).
  const addToPlan = ({ date, slot }) => {
    const result = useMealPlanStore.getState().addRecipe(recipe, { date, slot });
    if (!result.ok) {
      Alert.alert('Could not add', result.error);
      return;
    }
    setPlanning(false);
    // The plan is saved to the cloud once sync is on, which it is not until the plan screen has been opened.
    if (user?.uid) useMealPlanStore.getState().startSync(user.uid);
    const meal = MEAL_SLOTS.find((s) => s.id === slot);
    Alert.alert('Added to your plan', `${recipe.title} is on your plan for ${meal ? meal.name : slot} \u00B7 ${dayLabel(date)}.`, [
      { text: 'View plan', onPress: () => router.push({ pathname: '/nutrition/plan', params: { date } }) },
      { text: 'OK', style: 'cancel' },
    ]);
  };

  const handleLog = () => {
    if (!hasNutrition) {
      Alert.alert(
        'No nutrition estimate',
        'This recipe has no calorie estimate, so it would count as 0 kcal in your diary.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log anyway', onPress: logNow },
        ]
      );
      return;
    }
    logNow();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader showBack rightAction={<GroceryListButton />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 190 }}>
        {recipe.image ? (
          <Image source={{ uri: recipe.image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePh]} />
        )}
        <View style={{ padding: 22 }}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.prepTime} min {'\u00B7'} Serves {baseServings ? servingsNow : recipe.servings}
          </Text>

          {recipe.hasNutritionEstimate !== false && recipe.calories != null ? (
            <>
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
              <Text testID="recipe-per-serving" style={styles.perServing}>Nutrition is per serving</Text>
            </>
          ) : (
            <Text style={styles.meta}>Nutrition estimate not available for this recipe</Text>
          )}

          {steps.length > 0 && (
            <TouchableOpacity
              testID="recipe-start-cooking"
              accessibilityRole="button"
              style={styles.cookBtn}
              onPress={() => setCooking(true)}>
              <Text style={styles.cookText}>Start Cooking</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>Ingredients</Text>
          {baseServings ? (
            <View style={styles.servingsRow}>
              <Text style={styles.servingsLabel}>Servings</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  testID="recipe-servings-minus"
                  accessibilityRole="button"
                  accessibilityLabel="Fewer servings"
                  disabled={servingsNow <= 1}
                  style={[styles.stepBtn, servingsNow <= 1 && styles.stepBtnOff]}
                  onPress={() => setServings(clampServings(servingsNow - 1))}>
                  <Text style={styles.stepBtnText}>{'\u2212'}</Text>
                </TouchableOpacity>
                <Text testID="recipe-servings-value" style={styles.servingsValue}>{servingsNow}</Text>
                <TouchableOpacity
                  testID="recipe-servings-plus"
                  accessibilityRole="button"
                  accessibilityLabel="More servings"
                  disabled={servingsNow >= MAX_SERVINGS}
                  style={[styles.stepBtn, servingsNow >= MAX_SERVINGS && styles.stepBtnOff]}
                  onPress={() => setServings(clampServings(servingsNow + 1))}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              {servingsNow !== baseServings && (
                <TouchableOpacity testID="recipe-servings-reset" accessibilityRole="button" onPress={() => setServings(null)}>
                  <Text style={styles.resetText}>{`Reset to ${baseServings}`}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          {canConvert(ingredientList) && (
            <View style={styles.unitRow}>
              {UNIT_CHOICES.map((u) => {
                const active = system === u.id;
                return (
                  <TouchableOpacity
                    key={u.id}
                    testID={`recipe-units-${u.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.slotPill, active && styles.slotPillActive]}
                    onPress={() => setSystem(u.id)}>
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>{u.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={styles.card}>
            {ingredientLines.map((ing, i) => (
              <View key={i} style={styles.ingRow}>
                <View style={styles.dot} />
                <Text style={styles.ingText}>{ing}</Text>
              </View>
            ))}
          </View>

          {onGroceryList ? (
            <View testID="recipe-on-grocery" style={[styles.groceryBtn, styles.groceryBtnDone]}>
              <Text style={[styles.groceryText, styles.groceryTextDone]}>On your grocery list</Text>
            </View>
          ) : (
            <TouchableOpacity
              testID="recipe-add-grocery"
              style={styles.groceryBtn}
              onPress={() => addToGroceryList && addToGroceryList(recipe.id, factor)}>
              <Text style={styles.groceryText}>Add Ingredients to Grocery List</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="recipe-add-plan"
            accessibilityRole="button"
            style={styles.groceryBtn}
            onPress={() => setPlanning(true)}>
            <Text style={styles.groceryText}>Add to Meal Plan</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Instructions</Text>
          {steps.length === 0 ? (
            <Text testID="recipe-no-steps" style={styles.noSteps}>No instructions saved for this recipe.</Text>
          ) : steps.map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.slotRow}>
          {MEAL_SLOTS.map((slot) => {
            const active = slotId === slot.id;
            return (
              <TouchableOpacity
                key={slot.id}
                testID={`recipe-slot-${slot.id}`}
                style={[styles.slotPill, active && styles.slotPillActive]}
                onPress={() => setSlotId(slot.id)}>
                <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <PrimaryButton title="Log This Meal" onPress={handleLog} />
      </View>

      {planning && (
        <PlanTargetSheet
          title={`Add ${recipe.title} to your plan`}
          confirmLabel="Add"
          initialSlot={slotId}
          onConfirm={addToPlan}
          onClose={() => setPlanning(false)}
        />
      )}

      {cooking && (
        <CookingMode
          title={recipe.title}
          steps={steps}
          ingredients={ingredientLines}
          onClose={() => setCooking(false)}
        />
      )}
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#999999' },
  image: { width: '100%', height: 260 },
  imagePh: { backgroundColor: '#F5F5F5' },
  title: { fontSize: 28, fontWeight: '700', color: '#000000', letterSpacing: -0.5 },
  meta: { color: '#999999', fontSize: 13, marginTop: 6 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: tokens.spacing.sm },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 14, marginTop: 20,
  },
  card: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000000', marginRight: 10 },
  ingText: { color: '#000000', fontSize: 14, flex: 1 },
  cookBtn: {
    marginTop: 18, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#000000',
  },
  cookText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  servingsLabel: { fontSize: 14, fontWeight: '600', color: '#000000' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#000000', backgroundColor: '#FFFFFF',
  },
  stepBtnOff: { opacity: 0.3 },
  stepBtnText: { fontSize: 18, fontWeight: '600', color: '#000000' },
  servingsValue: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#000000' },
  perServing: { color: '#999999', fontSize: 12 },
  resetText: { fontSize: 13, color: '#999999', textDecorationLine: 'underline' },
  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  groceryBtn: {
    marginTop: 14, paddingVertical: 12, borderRadius: 999, alignItems: 'center',
    borderWidth: 1, borderColor: '#000000', backgroundColor: '#FFFFFF',
  },
  groceryBtnDone: { borderColor: '#DDDDDD', backgroundColor: '#F5F5F5' },
  groceryText: { fontSize: 14, fontWeight: '600', color: '#000000' },
  groceryTextDone: { color: '#999999' },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 14, marginBottom: tokens.spacing.sm,
    alignItems: 'flex-start', gap: tokens.spacing.md,
  },
  stepNum: {
    color: '#000000', fontSize: 18, fontWeight: '700',
    width: 28, textAlign: 'center',
  },
  stepText: { color: '#000000', fontSize: 14, flex: 1, lineHeight: 20 },
  noSteps: { color: '#999999', fontSize: 14, lineHeight: 20 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  slotRow: { flexDirection: 'row', gap: 8, marginBottom: 10, justifyContent: 'center' },
  slotPill: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF',
  },
  slotPillActive: { backgroundColor: '#000000', borderColor: '#000000' },
  slotText: { fontSize: 13, fontWeight: '600', color: '#999999' },
  slotTextActive: { color: '#FFFFFF' },
});

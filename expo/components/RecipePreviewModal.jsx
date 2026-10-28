import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import recipeExtractionService from '@/services/recipeExtractionService';
import { cookingSteps } from '@/lib/cookingSteps';
import { MACRO_COLORS } from '@/lib/recipeColors';
import { MEAL_SLOTS } from '@/lib/foodLog';
import { dayLabel } from '@/lib/mealCopy';
import { useMealPlanStore } from '@/store/mealPlanStore';
import PlanTargetSheet from '@/components/PlanTargetSheet';

// Real fraction formatting for cooking measurements - Spoonacular gives
// amounts as decimals (0.25, 0.333, etc.), but recipes are
// conventionally read as fractions (1/4 cup, 1/3 cup), not "0.25 cup".
// Only converts amounts genuinely close to a common cooking fraction;
// anything else is left as a plain, rounded number rather than guessed
// at.
function formatAmount(amount) {
  if (amount == null) return '';
  const whole = Math.floor(amount);
  const frac = amount - whole;
  const FRACTIONS = [
    [0.125, '1/8'], [0.25, '1/4'], [0.333, '1/3'], [0.34, '1/3'],
    [0.375, '3/8'], [0.5, '1/2'], [0.625, '5/8'], [0.66, '2/3'],
    [0.667, '2/3'], [0.75, '3/4'], [0.875, '7/8'],
  ];
  const match = FRACTIONS.find(([val]) => Math.abs(frac - val) < 0.01);
  if (match) return whole > 0 ? `${whole} ${match[1]}` : match[1];
  if (frac < 0.01) return String(whole);
  return String(Math.round(amount * 100) / 100);
}

// The calories, protein, carbs and fat of one serving, as four tiles. A figure the recipe does not have is left out.
function nutritionTiles(nutrition) {
  if (!nutrition) return [];
  const tile = (key, label, value, unit, color) => (typeof value === 'number' && Number.isFinite(value) ? { key, label, text: `${Math.round(value)}${unit}`, color } : null);
  return [
    tile('calories', 'Calories', nutrition.calories, '', '#000000'),
    tile('protein', 'Protein', nutrition.protein, 'g', MACRO_COLORS.protein),
    tile('carbs', 'Carbs', nutrition.carbs, 'g', MACRO_COLORS.carbs),
    tile('fat', 'Fat', nutrition.fat, 'g', MACRO_COLORS.fat),
  ].filter(Boolean);
}

// Real preview-before-save flow: tapping a discovery card on the
// Recipes screen used to prompt an immediate "Save this recipe?"
// confirmation - this replaces that with an actual preview of the real
// ingredients (with real measurements) and real instructions first,
// with Save as an explicit action once the user has actually looked at
// the recipe, not a blind save.
//
// It also puts the recipe on the meal plan: "Add to Meal Plan" saves the recipe first (unless it is already saved) and then asks
// which day and meal. findSaved(recipe) tells it whether the recipe is already one of the person's saved recipes (and returns that
// saved copy), so nothing is saved twice. planOnOpen opens the day and meal sheet as soon as the recipe has loaded.
export default function RecipePreviewModal({ visible, recipeId, onClose, onSaved, addRecipe, uid, findSaved, planOnOpen = false, onViewPlan }) {
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const autoPlanned = useRef(false);

  useEffect(() => {
    if (!visible || !recipeId) return;
    let cancelled = false;
    setLoading(true);
    setRecipe(null);
    setPlanning(false);
    autoPlanned.current = false;
    recipeExtractionService.getSpoonacularById(recipeId).then((data) => {
      if (!cancelled) setRecipe(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [visible, recipeId]);

  // Opened from "Add to plan": ask for the day and meal as soon as there is a recipe to plan.
  useEffect(() => {
    if (planOnOpen && recipe && !autoPlanned.current) {
      autoPlanned.current = true;
      setPlanning(true);
    }
  }, [planOnOpen, recipe]);

  // A recipe can come back without a list of ingredients or steps; show what there is.
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const steps = cookingSteps(recipe?.instructions);
  const tiles = nutritionTiles(recipe?.nutrition);
  const savedCopy = recipe && findSaved ? findSaved(recipe) : null;

  const handleSave = async () => {
    if (!recipe || savedCopy) return;
    setSaving(true);
    try {
      // The store gives back null when it could not save (nothing at all from a stand-in is fine).
      if ((await addRecipe(recipe, uid)) === null) throw new Error('save failed');
      onSaved?.();
      onClose();
      Alert.alert('Saved', `"${recipe.name}" was added to your recipes.`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save this recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // The meal plan holds saved recipes, so a recipe that is not saved yet is saved first.
  const handlePlan = async ({ date, slot }) => {
    if (!recipe) return;
    setPlanBusy(true);
    try {
      const created = !savedCopy;
      const saved = savedCopy || await addRecipe(recipe, uid);
      if (!saved) {
        Alert.alert('Could not add', 'This recipe could not be saved, so it was not added to your plan. Please try again.');
        return;
      }
      const result = useMealPlanStore.getState().addRecipe(saved, { date, slot });
      if (!result.ok) {
        Alert.alert('Could not add', result.error);
        return;
      }
      setPlanning(false);
      // The plan is saved to the cloud once sync is on, which it is not until the plan screen has been opened.
      if (uid) useMealPlanStore.getState().startSync(uid);
      if (created) onSaved?.();
      const meal = MEAL_SLOTS.find((s) => s.id === slot);
      onClose();
      Alert.alert('Added to your plan', `${recipe.name} is on your plan for ${meal ? meal.name : slot} · ${dayLabel(date)}.`, [
        ...(onViewPlan ? [{ text: 'View plan', onPress: () => onViewPlan(date) }] : []),
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add this recipe to your plan. Please try again.');
    } finally {
      setPlanBusy(false);
    }
  };

  const busy = saving || planBusy;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={ps.container}>
        <View style={ps.header}>
          <Text style={ps.headerTitle} numberOfLines={1}>{recipe?.name || 'Recipe'}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color="#000" />
          </Pressable>
        </View>

        {loading ? (
          <View style={ps.center}><ActivityIndicator size="large" color="#000" /></View>
        ) : !recipe ? (
          <View style={ps.center}>
            <Text style={ps.errorText}>Could not load this recipe.</Text>
          </View>
        ) : (
          <>
            <ScrollView style={ps.scroll} contentContainerStyle={ps.scrollContent}>
              {recipe.imageUrl ? (
                <Image source={{ uri: recipe.imageUrl }} style={ps.image} resizeMode="cover" />
              ) : null}

              <View style={ps.metaRow}>
                {recipe.cookTime ? <Text style={ps.metaText}>{recipe.cookTime} min</Text> : null}
                {recipe.servings ? <Text style={ps.metaText}>{recipe.servings} servings</Text> : null}
              </View>

              {tiles.length ? (
                <View testID="preview-nutrition" style={ps.tiles}>
                  {tiles.map((t) => (
                    <View key={t.key} style={ps.tile}>
                      <View style={[ps.tileBar, { backgroundColor: t.color }]} />
                      <Text style={ps.tileValue}>{t.text}</Text>
                      <Text style={ps.tileLabel}>{t.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {tiles.length ? <Text style={ps.perServing}>Per serving</Text> : null}

              {recipe.description ? <Text style={ps.description}>{recipe.description}</Text> : null}

              <Text style={ps.sectionTitle}>Ingredients</Text>
              {ingredients.map((ing, i) => (
                <Text key={ing.id ?? i} style={ps.ingredientText}>
                  {'• '}{[formatAmount(ing.amount), ing.unit, ing.name].filter(Boolean).join(' ')}
                </Text>
              ))}

              <Text style={ps.sectionTitle}>Instructions</Text>
              {steps.length === 0 ? (
                <Text testID="preview-no-steps" style={ps.noSteps}>No instructions for this recipe.</Text>
              ) : steps.map((step, i) => (
                <View key={i} style={ps.stepRow}>
                  <Text style={ps.stepNumber}>{i + 1}</Text>
                  <Text style={ps.stepText}>{step}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={ps.footer}>
              <Pressable testID="preview-plan" accessibilityRole="button" style={ps.planBtn} onPress={() => setPlanning(true)} disabled={busy}>
                {planBusy ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="calendar-outline" size={18} color="#000" />
                    <Text style={ps.planBtnText}>Add to Meal Plan</Text>
                  </>
                )}
              </Pressable>
              <Pressable testID="preview-save" accessibilityRole="button" style={[ps.saveBtn, savedCopy && ps.saveBtnDone]} onPress={handleSave} disabled={busy || !!savedCopy}>
                {saving ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name={savedCopy ? 'bookmark' : 'bookmark-outline'} size={18} color="#FFF" />
                    <Text style={ps.saveBtnText}>{savedCopy ? 'Saved' : 'Save Recipe'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {planning && recipe ? (
          <PlanTargetSheet
            title={`Add ${recipe.name} to your plan`}
            confirmLabel="Add"
            onConfirm={handlePlan}
            onClose={() => setPlanning(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000', flex: 1, marginRight: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#999' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  image: { width: '100%', height: 220, backgroundColor: '#F0F0F0' },
  metaRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, marginTop: 16 },
  metaText: { fontSize: 13, fontWeight: '600', color: '#666', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 14 },
  tile: { flex: 1, backgroundColor: '#F7F7F7', borderRadius: 12, paddingBottom: 10, overflow: 'hidden', alignItems: 'center' },
  tileBar: { height: 4, alignSelf: 'stretch', marginBottom: 8 },
  tileValue: { fontSize: 19, fontWeight: '800', color: '#000' },
  tileLabel: { fontSize: 11, fontWeight: '600', color: '#777', marginTop: 2 },
  perServing: { fontSize: 11, color: '#999', paddingHorizontal: 20, marginTop: 6 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, paddingHorizontal: 20, marginTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  ingredientText: { fontSize: 14, color: '#333', paddingHorizontal: 20, marginBottom: 8, lineHeight: 20 },
  stepRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14, gap: 12 },
  stepNumber: { fontSize: 13, fontWeight: '700', color: '#FFF', backgroundColor: '#000', width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  stepText: { fontSize: 14, color: '#333', lineHeight: 20, flex: 1 },
  noSteps: { fontSize: 14, color: '#999', lineHeight: 20, paddingHorizontal: 20 },
  footer: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: '#EEE' },
  planBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#000' },
  planBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', height: 52, borderRadius: 26 },
  saveBtnDone: { backgroundColor: '#555' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import recipeExtractionService from '@/services/recipeExtractionService';

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

// Real preview-before-save flow: tapping a discovery card on the
// Recipes screen used to prompt an immediate "Save this recipe?"
// confirmation - this replaces that with an actual preview of the real
// ingredients (with real measurements) and real instructions first,
// with Save as an explicit action once the user has actually looked at
// the recipe, not a blind save.
export default function RecipePreviewModal({ visible, recipeId, onClose, onSaved, addRecipe, uid }) {
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !recipeId) return;
    let cancelled = false;
    setLoading(true);
    setRecipe(null);
    recipeExtractionService.getSpoonacularById(recipeId).then((data) => {
      if (!cancelled) setRecipe(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [visible, recipeId]);

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      await addRecipe(recipe, uid);
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
                {recipe.nutrition?.calories ? <Text style={ps.metaText}>{Math.round(recipe.nutrition.calories)} cal</Text> : null}
                {recipe.cookTime ? <Text style={ps.metaText}>{recipe.cookTime} min</Text> : null}
                {recipe.servings ? <Text style={ps.metaText}>{recipe.servings} servings</Text> : null}
              </View>

              {recipe.description ? <Text style={ps.description}>{recipe.description}</Text> : null}

              <Text style={ps.sectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ing) => (
                <Text key={ing.id} style={ps.ingredientText}>
                  {'\u2022 '}{[formatAmount(ing.amount), ing.unit, ing.name].filter(Boolean).join(' ')}
                </Text>
              ))}

              <Text style={ps.sectionTitle}>Instructions</Text>
              {recipe.instructions.map((step, i) => (
                <View key={i} style={ps.stepRow}>
                  <Text style={ps.stepNumber}>{i + 1}</Text>
                  <Text style={ps.stepText}>{step}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={ps.footer}>
              <Pressable style={ps.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="bookmark-outline" size={18} color="#FFF" />
                    <Text style={ps.saveBtnText}>Save Recipe</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
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
  description: { fontSize: 14, color: '#666', lineHeight: 20, paddingHorizontal: 20, marginTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  ingredientText: { fontSize: 14, color: '#333', paddingHorizontal: 20, marginBottom: 8, lineHeight: 20 },
  stepRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14, gap: 12 },
  stepNumber: { fontSize: 13, fontWeight: '700', color: '#FFF', backgroundColor: '#000', width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  stepText: { fontSize: 14, color: '#333', lineHeight: 20, flex: 1 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#EEE' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', height: 52, borderRadius: 26 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Plus, Minus, Heart, Star } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useNutritionStore } from '@/store/nutritionStore';
import { getFoodById, gradeToStars } from '@/services/calorieApiService';

// Real, new 1-5 star display - same component/logic as
// app/nutrition.jsx and app/nutrition/search.jsx.
function StarRating({ stars, size = 16 }) {
  if (!stars) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= stars ? '#F59E0B' : '#DDDDDD'} fill={i <= stars ? '#F59E0B' : 'transparent'} />
      ))}
    </View>
  );
}

export default function FoodDetailScreen() {
  const { id, mealId } = useLocalSearchParams();
  const foodId = typeof id === 'string' ? id : '';
  const { favoriteFood, addToFavorites, removeFromFavorites, addFoodToMeal, dailyGoals } = useNutritionStore();

  const [food, setFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedMealId, setSelectedMealId] = useState(mealId?.toString() || 'breakfast');

  useEffect(() => {
    if (!foodId) return;
    (async () => {
      try {
        const f = await getFoodById(foodId);
        setFood(f);
      } catch (e) {
        console.error('load food', e);
      }
    })();
  }, [foodId]);

  const isFav = food ? (favoriteFood || []).some(f => f.id === food.id) : false;

  if (!food) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}><ActivityIndicator color="#000000" /></View>
      </View>
    );
  }

  const cals = Math.round((food.calories || 0) * quantity);
  const p = Math.round((food.protein || 0) * quantity);
  const c = Math.round((food.carbs || 0) * quantity);
  const fa = Math.round((food.fat || 0) * quantity);

  const dailyP = dailyGoals?.protein || 150;
  const dailyC = dailyGoals?.carbs || 200;
  const dailyF = dailyGoals?.fat || 65;

  const meals = [
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'lunch', name: 'Lunch' },
    { id: 'dinner', name: 'Dinner' },
    { id: 'snack', name: 'Snack' },
  ];

  const handleAdd = () => {
    const adjusted = {
      ...food,
      id: `${food.id}-${Date.now()}`,
      calories: cals,
      protein: p,
      carbs: c,
      fat: fa,
      servingSize: `${quantity}x ${food.servingSize || '100g'}`,
    };
    addFoodToMeal(new Date().toISOString().slice(0, 10), selectedMealId, adjusted);
    (router.canGoBack() ? router.back() : router.replace('/'));
  };

  const toggleFav = () => {
    if (isFav) removeFromFavorites(food.id);
    else addToFavorites(food);
  };

  const macros = [
    { label: 'Protein', value: p, goal: dailyP, color: '#3B82F6' },
    { label: 'Carbs', value: c, goal: dailyC, color: '#F97316' },
    { label: 'Fat', value: fa, goal: dailyF, color: '#A855F7' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        showBack
        rightAction={
          <TouchableOpacity onPress={toggleFav} hitSlop={8}>
            <Heart size={22} color={isFav ? '#EF4444' : '#999'} fill={isFav ? '#EF4444' : 'transparent'} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text style={styles.name}>{food.name}</Text>
        {food.servingSize ? <Text style={styles.serving}>{food.servingSize}</Text> : null}

        <View style={styles.calWrap}>
          <Text style={styles.calNumber}>{cals}</Text>
          <Text style={styles.calLabel}>kcal</Text>
          <View style={{ marginTop: 8 }}>
            <StarRating stars={food.nutritionalScore?.score ? gradeToStars(food.nutritionalScore.score) : null} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Macros</Text>
        <View style={styles.macroCard}>
          {macros.map((m) => {
            const pct = Math.min(100, (m.value / m.goal) * 100);
            return (
              <View key={m.label} style={styles.macroRow}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                  <Text style={styles.macroValue}>{m.value}g</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Servings</Text>
        <View style={styles.stepperCard}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setQuantity(Math.max(0.5, quantity - 0.5))}>
            <Minus size={18} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}x</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setQuantity(quantity + 0.5)}>
            <Plus size={18} color="#000000" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Meal</Text>
        <View style={styles.mealPills}>
          {meals.map((m) => {
            const active = selectedMealId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                onPress={() => setSelectedMealId(m.id)}>
                <Text style={[styles.pillText, { color: active ? '#FFFFFF' : '#999' }]}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="Add to Log" onPress={handleAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 28, fontWeight: '700', color: '#000000', letterSpacing: -0.5 },
  serving: { fontSize: 13, color: '#999999', marginTop: 4 },
  calWrap: { alignItems: 'center', marginVertical: 24 },
  calNumber: { fontSize: 48, fontWeight: '800', color: '#000000', letterSpacing: -1 },
  calLabel: { fontSize: 14, color: '#999999', marginTop: 4 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: 8, marginTop: 12,
  },
  macroCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 16, padding: 16,
  },
  macroRow: { marginBottom: 12 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  macroLabel: { color: '#000000', fontSize: 14 },
  macroValue: { color: '#000000', fontSize: 14, fontWeight: '600' },
  track: { height: 6, backgroundColor: '#E5E5E5', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  stepperCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { color: '#000000', fontSize: 18, fontWeight: '600' },
  mealPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  pillActive: { backgroundColor: '#000000' },
  pillInactive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD' },
  pillText: { fontSize: 13, fontWeight: '600' },
  // Real fix: 24 sits under the persistent bottom tab bar (see
  // app/nutrition.jsx's own "Log Food" button, which already correctly
  // uses 84 for the same reason) - this button was rendering, just
  // invisible behind the nav bar.
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 84 },
});

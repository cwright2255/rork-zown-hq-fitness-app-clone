import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Plus, Minus, Heart, Star } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useNutritionStore } from '@/store/nutritionStore';
import { getFoodById, gradeToStars } from '@/services/calorieApiService';
import { localDateKey } from '@/lib/localDate';
import { MEAL_SLOTS, scaleFood, foodKey, slotForHour } from '@/lib/foodLog';

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
  const { id, mealId, scannedFood } = useLocalSearchParams();
  const foodId = typeof id === 'string' ? id : '';
  const {
    favoriteFood, addToFavorites, removeFromFavorites, addFoodToMeal, dailyGoals,
    removeFoodFromMeal, updateFoodInMeal, findLoggedFood, customFoods,
  } = useNutritionStore();

  const [food, setFood] = useState(null);
  // Set when this screen was opened on something already in the diary: { meal, food }.
  const [logged, setLogged] = useState(null);
  const [failed, setFailed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedMealId, setSelectedMealId] = useState(
    mealId ? mealId.toString() : slotForHour(new Date().getHours())
  );

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    // A food just scanned (barcode or photo) arrives with its numbers in the
    // route params: there is nothing to look up, and it is not in any database
    // by an id this screen could fetch.
    if (scannedFood) {
      try {
        const f = JSON.parse(scannedFood);
        if (!f || !f.name) throw new Error('no food in the scan');
        setLogged(null);
        setQuantity(1);
        setFood({
          ...f,
          id: f.id || `scanned-${f.barcode || Date.now()}`,
          servingSize: f.servingSize || '100g',
        });
      } catch (e) {
        console.error('parse scanned food', e);
        setFailed(true);
      }
      return undefined;
    }

    if (!foodId) return undefined;

    // An already-logged food's id is its own log id (or, for older entries, a
    // composite {realId}-{timestamp}), not a real Calorie API id, so it is
    // looked up in the diary first. Its saved numbers are what was eaten, not
    // the generic 100g values a fresh API fetch would return.
    const hit = findLoggedFood ? findLoggedFood(foodId) : null;
    if (hit) {
      setLogged(hit);
      setFood(hit.food);
      setQuantity(hit.food.quantity > 0 ? hit.food.quantity : 1);
      return undefined;
    }

    // One of the person's own foods (My Foods) is not in the food database either.
    const mine = (customFoods || []).find((f) => f.id === foodId);
    if (mine) {
      setLogged(null);
      setQuantity(1);
      setFood(mine);
      return undefined;
    }

    setLogged(null);
    (async () => {
      try {
        const f = await getFoodById(foodId);
        if (cancelled) return;
        if (f) setFood(f); else setFailed(true);
      } catch (e) {
        console.error('load food', e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [foodId, scannedFood]);

  const isFav = food ? (favoriteFood || []).some(f => f.id === food.id) : false;

  if (failed) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}>
          <Text testID="food-load-failed" style={styles.failedText}>
            Couldn't load this food. Go back and try another.
          </Text>
        </View>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack />
        <View style={styles.center}><ActivityIndicator color="#000000" /></View>
      </View>
    );
  }

  const scaled = scaleFood(food, quantity);
  const cals = scaled.calories;
  const p = scaled.protein;
  const c = scaled.carbs;
  const fa = scaled.fat;

  const dailyP = dailyGoals?.protein || 150;
  const dailyC = dailyGoals?.carbs || 200;
  const dailyF = dailyGoals?.fat || 65;

  // Entries saved before one-serving values were kept can be removed but not re-scaled.
  const canEdit = !logged || !!food.base;
  const unchanged = !!logged && quantity === (food.quantity > 0 ? food.quantity : 1);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const handleAdd = () => {
    const adjusted = {
      ...food,
      id: `${food.id}-${Date.now()}`,
      ...scaled,
    };
    addFoodToMeal(localDateKey(), selectedMealId, adjusted);
    goBack();
  };

  const handleUpdate = () => {
    if (!logged) return;
    const { base, ...numbers } = scaled;
    updateFoodInMeal(logged.meal.id, foodKey(logged.food), numbers, logged.meal.date);
    goBack();
  };

  const removeNow = () => {
    if (!logged) return;
    removeFoodFromMeal(logged.meal.id, foodKey(logged.food), logged.meal.date);
    goBack();
  };

  const handleRemove = () => {
    Alert.alert('Remove from log?', `${food.name} will be taken out of your diary.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: removeNow },
    ]);
  };

  const toggleFav = () => {
    if (isFav) removeFromFavorites(food.id);
    else addToFavorites(food);
  };

  // Fiber, sugar and sodium for the serving shown, only for those the food lists.
  const extras = [
    { key: 'fiber', label: 'Fiber', unit: 'g' },
    { key: 'sugar', label: 'Sugar', unit: 'g' },
    { key: 'sodium', label: 'Sodium', unit: 'mg' },
  ].filter((n) => scaled[n.key] != null);

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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>
        <Text style={styles.name}>{food.name}</Text>
        {food.brand ? <Text style={styles.serving}>{food.brand}</Text> : null}
        {food.servingSize ? <Text style={styles.serving}>{logged && food.base ? scaled.servingSize : food.servingSize}</Text> : null}

        <View style={styles.calWrap}>
          <Text testID="food-calories" style={styles.calNumber}>{cals}</Text>
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

        {extras.length ? (
          <>
            <Text style={styles.sectionLabel}>More nutrients</Text>
            <View style={styles.macroCard}>
              {extras.map((n, i) => (
                <View
                  key={n.key}
                  testID={`food-${n.key}`}
                  style={[styles.nutrientRow, i === extras.length - 1 && { marginBottom: 0 }]}>
                  <Text style={styles.macroLabel}>{n.label}</Text>
                  <Text style={styles.macroValue}>{scaled[n.key]} {n.unit}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {canEdit ? (
          <>
            <Text style={styles.sectionLabel}>Servings</Text>
            <View style={styles.stepperCard}>
              <TouchableOpacity
                testID="food-minus"
                style={styles.stepBtn}
                onPress={() => setQuantity(Math.max(0.5, quantity - 0.5))}>
                <Minus size={18} color="#000000" />
              </TouchableOpacity>
              <Text testID="food-quantity" style={styles.qtyText}>{quantity}x</Text>
              <TouchableOpacity
                testID="food-plus"
                style={styles.stepBtn}
                onPress={() => setQuantity(quantity + 0.5)}>
                <Plus size={18} color="#000000" />
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {!logged ? (
          <>
            <Text style={styles.sectionLabel}>Meal</Text>
            <View style={styles.mealPills}>
              {MEAL_SLOTS.map((m) => {
                const active = selectedMealId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`food-meal-${m.id}`}
                    style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                    onPress={() => setSelectedMealId(m.id)}>
                    <Text style={[styles.pillText, { color: active ? '#FFFFFF' : '#999' }]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {logged ? (
          <>
            {canEdit ? (
              <PrimaryButton title="Update Serving" onPress={handleUpdate} disabled={unchanged} />
            ) : null}
            <TouchableOpacity testID="food-remove" style={styles.removeBtn} onPress={handleRemove}>
              <Text style={styles.removeText}>Remove from Log</Text>
            </TouchableOpacity>
          </>
        ) : (
          <PrimaryButton title="Add to Log" onPress={handleAdd} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  failedText: { color: '#666666', fontSize: 15, textAlign: 'center' },
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
  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
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
  // Real fix: was 84, same as nutrition.jsx's original bug - confirmed
  // directly from a real screenshot that the bottom nav bar IS visible
  // on this screen (my earlier comment here assuming it wasn't was
  // wrong), so this needs the same proven 100 value app/wearables.jsx
  // and the fixed app/nutrition.jsx both already use.
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 100 },
  removeBtn: { alignItems: 'center', paddingVertical: 12 },
  removeText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});

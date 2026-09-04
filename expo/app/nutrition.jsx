import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Star } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { useNutritionStore } from '@/store/nutritionStore';
import { useUserStore } from '@/store/userStore';
import { gradeToStars } from '@/services/calorieApiService';
import { tokens } from '../../theme/tokens';

// Real, new 1-5 star display - matches the FDA-Daily-Value-based grade
// already computed for any food that came from a search result (see
// services/calorieApiService.js's calculateNutritionalScore), shown
// alongside calories to aid both the meal's XP tier and the user's own
// decision-making. Renders nothing for a food with no computed grade
// (a manually-adjusted quantity, etc.) rather than a misleading
// default rating.
function StarRating({ stars, size = 12 }) {
  if (!stars) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= stars ? '#FBBF24' : '#3A3A3A'} fill={i <= stars ? '#FBBF24' : 'transparent'} />
      ))}
    </View>
  );
}

// Same canonical meal slot ids as app/nutrition/log.jsx and
// app/nutrition/food/[id].jsx -- lowercase singular. Previously this
// screen used capitalized/plural display labels ('Breakfast', 'Snacks')
// as if they were the real match key, which never actually matched a
// meal's real id, and its own "Add Food" button dropped which slot was
// tapped entirely (took a `type` argument but never used it), so every
// added food landed with no meal assignment regardless of which button
// was pressed.
const MEAL_SLOTS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snack', name: 'Snack' },
];

export default function NutritionScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useUserStore();
  const { meals, dailyGoals, loadNutritionData, setSyncUid, getMealsByDate } = useNutritionStore();

  useEffect(() => {
    if (user?.uid) {
      setSyncUid(user.uid);
      loadNutritionData(user.uid);
    }
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.uid) await loadNutritionData(user.uid);
    setRefreshing(false);
  };

  const [selectedDate, setSelectedDate] = useState(new Date());

  const shiftDate = (days) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const formatDate = (date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const dateStr = selectedDate.toISOString().slice(0, 10);
  const mealsForSelectedDate = useMemo(() => getMealsByDate(dateStr), [meals, dateStr]);

  const totals = useMemo(() => {
    const allFoods = mealsForSelectedDate.flatMap((m) => m.foods || []);
    return {
      protein: allFoods.reduce((s, f) => s + (f.protein || 0), 0),
      carbs: allFoods.reduce((s, f) => s + (f.carbs || 0), 0),
      fat: allFoods.reduce((s, f) => s + (f.fat || 0), 0),
    };
  }, [mealsForSelectedDate]);

  const dailyCalorieGoal = dailyGoals?.calories || 2000;
  const caloriesConsumed = mealsForSelectedDate.reduce((s, m) => s + (m.foods || []).reduce((fs, f) => fs + (f.calories || 0), 0), 0);
  const caloriesRemaining = Math.max(0, dailyCalorieGoal - caloriesConsumed);

  const getMealForSlot = (slotId) => mealsForSelectedDate.find((m) => m.id === slotId) || null;

  const sumMealCalories = (meal) => (meal?.foods || []).reduce((s, f) => s + (f.calories || 0), 0);

  // Real average across a meal slot's foods - only counts foods that
  // actually have a computed grade, so a slot with one graded food and
  // one manually-adjusted one isn't dragged toward an assumed middle
  // value for the ungraded item.
  const avgMealStars = (meal) => {
    const graded = (meal?.foods || [])
      .map((f) => f.nutritionalScore?.score ? gradeToStars(f.nutritionalScore.score) : null)
      .filter((v) => v != null);
    if (!graded.length) return null;
    return Math.round(graded.reduce((s, v) => s + v, 0) / graded.length);
  };

  const handleAddMealType = (slot) => {
    router.push({ pathname: '/nutrition/search', params: { mealId: slot.id } });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Nutrition" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateBtn} hitSlop={8}>
            <ChevronLeft size={22} color={tokens.colors.dark_navy.bg_primary} />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateBtn} hitSlop={8}>
            <ChevronRight size={22} color={tokens.colors.dark_navy.bg_primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.calCard}>
          <Text style={styles.calNumber}>{caloriesRemaining}</Text>
          <Text style={styles.calLabel}>kcal remaining</Text>
        </View>

        <View style={styles.macroRow}>
          <View style={[styles.macroChip, { borderLeftColor: '#3B82F6' }]}>
            <Text style={styles.macroVal}>{Math.round(totals.protein)}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
          </View>
          <View style={[styles.macroChip, { borderLeftColor: '#F97316' }]}>
            <Text style={styles.macroVal}>{Math.round(totals.carbs)}g</Text>
            <Text style={styles.macroLabel}>Carbs</Text>
          </View>
          <View style={[styles.macroChip, { borderLeftColor: '#A855F7' }]}>
            <Text style={styles.macroVal}>{Math.round(totals.fat)}g</Text>
            <Text style={styles.macroLabel}>Fat</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Meals</Text>

        {MEAL_SLOTS.map((slot) => {
          const meal = getMealForSlot(slot.id);
          const cals = sumMealCalories(meal);
          const mealStars = avgMealStars(meal);
          return (
            <View key={slot.id} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealName}>{slot.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <StarRating stars={mealStars} size={11} />
                  <View style={styles.calBadge}>
                    <Text style={styles.calBadgeText}>{cals} kcal</Text>
                  </View>
                </View>
              </View>
              {meal?.foods?.length ? (
                <View style={styles.foodList}>
                  {meal.foods.map((fo) => (
                    <TouchableOpacity
                      key={fo.id}
                      style={styles.foodRow}
                      onPress={() => router.push(`/nutrition/food/${fo.id}`)}>
                      <Text style={styles.foodName}>{fo.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <StarRating stars={fo.nutritionalScore?.score ? gradeToStars(fo.nutritionalScore.score) : null} size={10} />
                        <Text style={styles.foodCal}>{fo.calories} kcal</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.addFoodBtn}
                onPress={() => handleAddMealType(slot)}>
                <Plus size={16} color={tokens.colors.dark_navy.bg_primary} />
                <Text style={styles.addFoodText}>Add Food</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          title="Log Food"
          onPress={() => router.push('/nutrition/search')}
        />
      </View>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  scroll: { flex: 1, paddingHorizontal: tokens.spacing.md },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
  },
  dateBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dateText: { fontSize: 18, fontWeight: '600', color: tokens.colors.dark_navy.text_primary },
  calCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary,
    borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg, alignItems: 'center',
    marginTop: 8, marginBottom: tokens.spacing.md,
  },
  calNumber: { fontSize: 48, fontWeight: '800', color: tokens.colors.dark_navy.text_primary, letterSpacing: -1 },
  calLabel: { fontSize: 14, color: tokens.colors.dark_navy.text_muted, marginTop: 4 },
  macroRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: 20 },
  macroChip: {
    flex: 1,
    backgroundColor: tokens.colors.dark_navy.text_primary,
    borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderLeftWidth: 4,
    borderRadius: tokens.radius.lg,
    padding: 12,
  },
  macroVal: { fontSize: 16, fontWeight: '700', color: tokens.colors.dark_navy.text_primary },
  macroLabel: { fontSize: 12, color: tokens.colors.dark_navy.text_muted, marginTop: 2 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm, marginTop: 4,
  },
  mealCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary,
    borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md, marginBottom: 12,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { fontSize: 16, fontWeight: '600', color: tokens.colors.dark_navy.text_primary },
  calBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  calBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  foodList: { marginTop: 12 },
  foodRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  foodName: { color: tokens.colors.dark_navy.text_primary, fontSize: 14, flex: 1 },
  foodCal: { color: tokens.colors.dark_navy.text_muted, fontSize: 13 },
  addFoodBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 10,
  },
  addFoodText: { color: tokens.colors.dark_navy.text_primary, fontSize: 14, fontWeight: '500' },
  bottomBar: {
    position: 'absolute', left: 16, right: 16, bottom: 84,
  },
});

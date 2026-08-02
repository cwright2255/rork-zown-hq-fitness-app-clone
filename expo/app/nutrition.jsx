import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { useNutritionStore } from '@/store/nutritionStore';
import { useHealthStore } from '@/store/healthStore';
import { useUserStore } from '@/store/userStore';
import { tokens } from '../../theme/tokens';

export default function NutritionScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { meals, loadAllHealth } = useHealthStore();
  const { user } = useUserStore();
  const { loadNutritionData, setSyncUid } = useNutritionStore();

  useEffect(() => {
    if (user?.uid) {
      setSyncUid(user.uid);
      loadNutritionData(user.uid);
    }
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await loadAllHealth(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Real fix: everything below was referenced throughout the render
  // logic (date nav, macro totals, per-meal breakdown) but never
  // declared anywhere in this file - the whole logic layer was missing
  // while the JSX that depends on it was intact. Built directly from
  // the real meals data shape confirmed in healthStore.js
  // (timestamp/calories/protein/carbs/fat), mirroring the pattern
  // already used there for getTodayMacros, but for the selected date
  // rather than only today.
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

  const mealsForSelectedDate = useMemo(() => {
    const dateStr = selectedDate.toISOString().slice(0, 10);
    return (meals || []).filter((m) => m.timestamp && m.timestamp.startsWith(dateStr));
  }, [meals, selectedDate]);

  const totals = useMemo(() => ({
    protein: mealsForSelectedDate.reduce((s, m) => s + (m.protein || 0), 0),
    carbs: mealsForSelectedDate.reduce((s, m) => s + (m.carbs || 0), 0),
    fat: mealsForSelectedDate.reduce((s, m) => s + (m.fat || 0), 0),
  }), [mealsForSelectedDate]);

  // No calorie-goal field exists anywhere in the user or health store -
  // using a standard baseline rather than a real personalized target.
  const DAILY_CALORIE_GOAL = 2000;
  const caloriesConsumed = mealsForSelectedDate.reduce((s, m) => s + (m.calories || 0), 0);
  const caloriesRemaining = Math.max(0, DAILY_CALORIE_GOAL - caloriesConsumed);

  const mealTypes = [
    { name: 'Breakfast' },
    { name: 'Lunch' },
    { name: 'Dinner' },
    { name: 'Snacks' },
  ];

  const getMealForType = (typeName) => {
    return mealsForSelectedDate.find((m) => m.type === typeName || m.mealType === typeName) || null;
  };

  const sumMealCalories = (meal) => {
    if (!meal) return 0;
    if (meal.calories) return meal.calories;
    return (meal.foods || []).reduce((s, f) => s + (f.calories || 0), 0);
  };

  const handleAddMealType = (type) => {
    router.push('/nutrition/search');
  };
return (
    <View style={styles.container}>
      <ScreenHeader title="Nutrition" />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 160 }}>
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

        {mealTypes.map((type) => {
          const meal = getMealForType(type.name);
          const cals = sumMealCalories(meal);
          return (
            <View key={type.name} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealName}>{type.name}</Text>
                <View style={styles.calBadge}>
                  <Text style={styles.calBadgeText}>{cals} kcal</Text>
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
                      <Text style={styles.foodCal}>{fo.calories} kcal</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.addFoodBtn}
                onPress={() => handleAddMealType(type)}>
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

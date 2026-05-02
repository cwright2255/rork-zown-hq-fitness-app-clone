import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { useNutritionStore } from '@/store/nutritionStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../theme/tokens';

export default function NutritionScreen() {
  const { getMealsByDate, dailyGoals, addMeal } = useNutritionStore();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dateKey = selectedDate.toISOString().split('T')[0];
  const meals = getMealsByDate(dateKey);

  const totals = useMemo(() => {
    let c = 0, p = 0, cb = 0, f = 0;
    meals.forEach(m => {
      (m.foods || []).forEach(fo => {
        c += fo.calories || 0;
        p += fo.protein || 0;
        cb += fo.carbs || 0;
        f += fo.fat || 0;
      });
    });
    return { calories: c, protein: p, carbs: cb, fat: f };
  }, [meals]);

  const caloriesRemaining = Math.max(0, (dailyGoals?.calories || 2000) - totals.calories);

  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  const formatDate = (d) => {
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const mealTypes = [
    { name: 'Breakfast', time: '08:00' },
    { name: 'Lunch', time: '13:00' },
    { name: 'Dinner', time: '19:00' },
    { name: 'Snacks', time: '16:00' },
  ];

  const getMealForType = (name) => meals.find(m => m.name?.toLowerCase() === name.toLowerCase());

  const handleAddMealType = (type) => {
    const existing = getMealForType(type.name);
    if (existing) {
      router.push({ pathname: '/nutrition/search', params: { mealId: existing.id } });
    } else {
      const newMeal = {
        id: Date.now().toString(),
        name: type.name,
        foods: [],
        time: type.time,
        date: dateKey,
      };
      addMeal(newMeal);
      router.push({ pathname: '/nutrition/search', params: { mealId: newMeal.id } });
    }
  };

  const sumMealCalories = (meal) =>
    (meal?.foods || []).reduce((sum, fo) => sum + (fo.calories || 0), 0);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Nutrition" />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateBtn} hitSlop={8}>
            <ChevronLeft size={22} color=tokens.colors.background.default />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateBtn} hitSlop={8}>
            <ChevronRight size={22} color=tokens.colors.background.default />
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
                <Plus size={16} color=tokens.colors.background.default />
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
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  scroll: { flex: 1, paddingHorizontal: 16 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dateBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  dateText: { fontSize: 18, fontWeight: '600', color: tokens.colors.background.default },
  calCard: {
    backgroundColor: tokens.colors.ink.darker,
    borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 24, alignItems: 'center',
    marginTop: 8, marginBottom: 16,
  },
  calNumber: { fontSize: 48, fontWeight: '800', color: tokens.colors.background.default, letterSpacing: -1 },
  calLabel: { fontSize: 14, color: '#999', marginTop: 4 },
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  macroChip: {
    flex: 1,
    backgroundColor: tokens.colors.ink.darker,
    borderWidth: 1, borderColor: '#2A2A2A',
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 12,
  },
  macroVal: { fontSize: 16, fontWeight: '700', color: tokens.colors.background.default },
  macroLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 8, marginTop: 4,
  },
  mealCard: {
    backgroundColor: tokens.colors.ink.darker,
    borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16, marginBottom: 12,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { fontSize: 16, fontWeight: '600', color: tokens.colors.background.default },
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
  foodName: { color: tokens.colors.background.default, fontSize: 14, flex: 1 },
  foodCal: { color: '#999', fontSize: 13 },
  addFoodBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 10,
  },
  addFoodText: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '500' },
  bottomBar: {
    position: 'absolute', left: 16, right: 16, bottom: 84,
  },
});

import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { useNutritionStore } from '@/store/nutritionStore';
import { tokens } from '../../theme/tokens';

export default function NutritionScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { meals, loadAllHealth } = useHealthStore();
  const { user } = useUserStore();

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
  dateText: { fontSize: 18, fontWeight: '600', color: tokens.colors.dark_navy.bg_primary },
  calCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary,
    borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg, alignItems: 'center',
    marginTop: 8, marginBottom: tokens.spacing.md,
  },
  calNumber: { fontSize: 48, fontWeight: '800', color: tokens.colors.dark_navy.bg_primary, letterSpacing: -1 },
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
  macroVal: { fontSize: 16, fontWeight: '700', color: tokens.colors.dark_navy.bg_primary },
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
  mealName: { fontSize: 16, fontWeight: '600', color: tokens.colors.dark_navy.bg_primary },
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
  foodName: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, flex: 1 },
  foodCal: { color: tokens.colors.dark_navy.text_muted, fontSize: 13 },
  addFoodBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 10,
  },
  addFoodText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, fontWeight: '500' },
  bottomBar: {
    position: 'absolute', left: 16, right: 16, bottom: 84,
  },
});

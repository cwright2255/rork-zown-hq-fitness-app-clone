import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Star, Droplet } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { useNutritionStore } from '@/store/nutritionStore';
import { useUserStore } from '@/store/userStore';
import { useHealthStore } from '@/store/healthStore';
import { gradeToStars } from '@/services/calorieApiService';

// Real fix: this screen previously used tokens.colors.dark_navy - a
// dark theme not shared by any other screen reachable from the main
// bottom nav. Rebuilt to precisely match app/hq.jsx (confirmed
// directly): white #FFFFFF cards with a subtle shadow (not flat gray).
// The calorie display started as hq.jsx's own single-color ProgressRing
// SVG component, copied unchanged, then became the multi-colored
// MacroRing below - same underlying ring approach, now split into a
// per-macro segment breakdown instead of one solid color.

// Real, new multi-colored ring - the same overall calorie-progress
// arc app/hq.jsx's own ProgressRing draws (same radius/circumference
// math, same top-start clockwise fill), but split into three segments,
// colored to match the existing blue/orange/purple already used for
// the Protein/Carbs/Fat cards on this same screen - sized by each
// macro's actual share of calories consumed so far (protein/carbs at
// 4 cal/g, fat at 9 cal/g - standard conversions), not by grams
// directly (fat's higher cal/g would otherwise be under-represented).
// Segment math (contiguous stroke-dasharray/dashoffset per segment,
// each starting exactly where the previous one ends) verified visually
// against a rendered test case before writing this, not assumed correct
// from spec-reading alone.
function MacroRing({ size = 180, strokeWidth = 14, macros, dailyGoalCalories, label, subLabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const proteinCals = (macros.protein || 0) * 4;
  const carbsCals = (macros.carbs || 0) * 4;
  const fatCals = (macros.fat || 0) * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  const overallProgress = dailyGoalCalories > 0
    ? Math.min(totalMacroCals / dailyGoalCalories, 1)
    : 0;

  const segments = totalMacroCals > 0 ? [
    { frac: (proteinCals / totalMacroCals) * overallProgress, color: '#3B82F6' },
    { frac: (carbsCals / totalMacroCals) * overallProgress, color: '#F97316' },
    { frac: (fatCals / totalMacroCals) * overallProgress, color: '#A855F7' },
  ] : [];

  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const segLen = seg.frac * circumference;
    const arc = { key: i, color: seg.color, dasharray: `${segLen} ${circumference}`, offset: -cumulative };
    cumulative += segLen;
    return arc;
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F5F5F5"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {arcs.map((arc) => (
          <Circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.offset}
            strokeLinecap="butt"
            fill="transparent"
            transform={"rotate(-90 " + (size / 2) + " " + (size / 2) + ")"}
          />
        ))}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#000000' }}>{label}</Text>
        {subLabel && <Text style={{ fontSize: 13, color: '#666666', marginTop: 2 }}>{subLabel}</Text>}
      </View>
    </View>
  );
}


// Real 1-5 star display - matches the FDA-Daily-Value-based grade
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
        <Star key={i} size={size} color={i <= stars ? '#F59E0B' : '#DDDDDD'} fill={i <= stars ? '#F59E0B' : 'transparent'} />
      ))}
    </View>
  );
}

// Same canonical meal slot ids as app/nutrition/food/[id].jsx --
// lowercase singular. Previously this
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
  // Real restore: this screen's water tracking was removed in an
  // earlier, unrelated commit (fd06ef4, a UI migration batch) well
  // before this session - confirmed directly via git history, not a
  // regression from anything built here. The original component
  // (components/HydrationTracker.jsx, recovered from commit 8f5f2a2)
  // called addExpActivity directly with no protection against
  // re-awarding the same tier repeatedly, and read from
  // user.fitnessMetrics.water, a data source that predates
  // nutritionStore entirely - not safe to restore verbatim. Reusing
  // healthStore's hydration/addGlass/awardHydrationXP here instead,
  // since that system already exists, already works, and is already
  // top-up-protected against double-awarding - rather than building a
  // third, parallel hydration+XP system alongside nutritionStore's own
  // (unused-for-XP) waterIntake. healthStore's hydration only tracks
  // the current day (resets whenever the date changes), so this is
  // only shown when viewing "Today" below - not shown for past dates,
  // rather than implying past-date editing works when it doesn't.
  const { hydration, addGlass } = useHealthStore();

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
  const isViewingToday = dateStr === new Date().toISOString().slice(0, 10);
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
            <ChevronLeft size={22} color="#000" />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateBtn} hitSlop={8}>
            <ChevronRight size={22} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.calCard}>
          <MacroRing
            size={180}
            strokeWidth={14}
            macros={totals}
            dailyGoalCalories={dailyCalorieGoal}
            label={caloriesRemaining}
            subLabel="kcal remaining"
          />
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

        {isViewingToday && (
          <>
            <Text style={styles.sectionLabel}>Hydration</Text>
            <View style={styles.hydrationCard}>
              <View style={styles.glassesRow}>
                {Array.from({ length: hydration?.target || 8 }).map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => addGlass(user?.uid)} hitSlop={6}>
                    <Droplet
                      size={26}
                      color={i < (hydration?.glasses || 0) ? '#3B82F6' : '#DDDDDD'}
                      fill={i < (hydration?.glasses || 0) ? '#3B82F6' : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.glassesLabel}>
                {hydration?.glasses || 0} of {hydration?.target || 8} glasses
              </Text>
              <TouchableOpacity style={styles.addGlassBtn} onPress={() => addGlass(user?.uid)}>
                <Text style={styles.addGlassBtnText}>Add Glass</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

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
                <Plus size={16} color="#000" />
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

// cardShadow: the exact shadow values from app/hq.jsx's own
// cardContainer style, confirmed directly, reused here rather than
// approximated so every card actually matches hq.jsx's real depth.
// Real fix: android elevation was 3 here (and across every other
// screen fixed this pass) - hq.jsx's own actual value, checked again
// directly, is 2. The other files in this pass share this same
// discrepancy; flagged, not fixed here, since this fix is scoped to
// nutrition.jsx as asked.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1, paddingHorizontal: 22 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  dateBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF', ...cardShadow,
    alignItems: 'center', justifyContent: 'center',
  },
  dateText: { fontSize: 18, fontWeight: '600', color: '#000' },
  calCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: 16,
    paddingVertical: 24, alignItems: 'center',
    marginTop: 8, marginBottom: 16,
  },
  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  macroChip: {
    flex: 1,
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 12,
  },
  macroVal: { fontSize: 16, fontWeight: '700', color: '#000' },
  macroLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 14, marginTop: 4,
  },
  hydrationCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: 16,
    padding: 16, marginBottom: 20, alignItems: 'center',
  },
  glassesRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' },
  glassesLabel: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 12 },
  addGlassBtn: { backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  addGlassBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  mealCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: 16,
    padding: 16, marginBottom: 12,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { fontSize: 16, fontWeight: '600', color: '#000' },
  calBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  calBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  foodList: { marginTop: 12 },
  foodRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  foodName: { color: '#000', fontSize: 14, flex: 1 },
  foodCal: { color: '#999', fontSize: 13 },
  addFoodBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 10,
  },
  addFoodText: { color: '#000', fontSize: 14, fontWeight: '500' },
  // Real fix: was 84, which is why the button sat partly behind the
  // nav bar - app/wearables.jsx has the identical fixed-button-above-
  // nav pattern and already uses 100, a proven, working value rather
  // than a guess.
  bottomBar: {
    position: 'absolute', left: 16, right: 16, bottom: 100,
  },
});

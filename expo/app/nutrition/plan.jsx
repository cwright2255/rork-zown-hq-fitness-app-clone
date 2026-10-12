import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import GroceryListButton from '@/components/GroceryListButton';
import PlanTargetSheet from '@/components/PlanTargetSheet';
import { useMealPlanStore } from '@/store/mealPlanStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useRecipeStore } from '@/store/recipeStore';
import { useUserStore } from '@/store/userStore';
import { logPlannedEntry, logPlannedDay } from '@/services/mealPlanLog';
import { MEAL_SLOTS } from '@/lib/foodLog';
import { localDateKey, parseDateKey } from '@/lib/localDate';
import { dayLabel } from '@/lib/mealCopy';
import { isRecipeOnList } from '@/lib/groceryList';
import {
  MAX_PLAN_SERVINGS, MIN_PLAN_SERVINGS, SERVINGS_STEP,
  canLogEntry, dayParts, dayTotals, entriesFor, entryTotals, planGroceryFactors, servingsLabel, shiftWeek, weekDays, weekLabel,
} from '@/lib/mealPlan';

const n = (v) => Number(v).toLocaleString('en-US');
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const first = (v) => (Array.isArray(v) ? v[0] : v);

// The week's meal plan: pick a day, see its four meals, add recipes and foods,
// change servings, log what was eaten, and add the week's ingredients to the
// grocery list.
export default function MealPlanScreen() {
  const params = useLocalSearchParams();
  const requested = first(params.date);
  const todayKey = localDateKey();
  const [selected, setSelected] = useState(() => (parseDateKey(requested) ? requested : todayKey));
  // The meal slot the add sheet is open for, and the item being moved or copied.
  const [adding, setAdding] = useState(null);
  const [relocating, setRelocating] = useState(null);

  const { user } = useUserStore();
  const { entries, startSync, addRecipe, setServings, removeEntry, moveEntry, copyEntry } = useMealPlanStore();
  const { dailyGoals } = useNutritionStore();
  const { savedRecipes, loadRecipes, groceryList, generateGroceryList } = useRecipeStore();

  React.useEffect(() => {
    if (!user?.uid) return;
    startSync(user.uid);
    if (!savedRecipes.length) loadRecipes(user.uid);
  }, [user?.uid]);

  const days = weekDays(selected);
  const dayEntries = useMemo(() => entriesFor(entries, selected), [entries, selected]);
  const totals = useMemo(() => dayTotals(entries, selected), [entries, selected]);
  const goal = dailyGoals?.calories;
  const loggable = dayEntries.filter((e) => canLogEntry(e, todayKey));

  const tell = (title, message) => Alert.alert(title, message);
  const check = (result) => {
    if (!result.ok) tell('Could not do that', result.error);
    return result.ok;
  };

  const logOne = (entry) => {
    const result = logPlannedEntry(entry.id);
    if (!result.ok) tell('Could not log', result.error);
  };

  const logAll = () => {
    const logged = logPlannedDay(selected);
    Alert.alert('Logged', `${plural(logged, 'item')} added to your diary.`, [
      { text: 'View', onPress: () => router.push({ pathname: '/nutrition', params: { date: selected } }) },
      { text: 'OK', style: 'cancel' },
    ]);
  };

  const openMenu = (entry) => {
    const buttons = [];
    if (!entry.loggedAt) {
      buttons.push({ text: 'Move to another day', onPress: () => setRelocating({ entry, mode: 'move' }) });
      buttons.push({ text: 'Copy to another day', onPress: () => setRelocating({ entry, mode: 'copy' }) });
    }
    buttons.push({ text: 'Remove', style: 'destructive', onPress: () => removeEntry(entry.id) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(entry.name, undefined, buttons);
  };

  const addGroceries = () => {
    const plan = planGroceryFactors(entries, savedRecipes, { fromKey: days[0], toKey: days[6], todayKey });
    const left = plan.missing.length
      ? ` ${plural(plan.missing.length, 'planned recipe')} no longer saved ${plan.missing.length === 1 ? 'was' : 'were'} left out: ${plan.missing.join(', ')}.`
      : '';
    if (!plan.recipeIds.length) {
      tell('Nothing to shop for', `No saved recipes are planned for the rest of this week.${left}`);
      return;
    }
    const already = plan.recipeIds.filter((id) => isRecipeOnList(groceryList, id)).length;
    if (already === plan.recipeIds.length) {
      tell('Already on your list', `The recipes planned for the rest of this week are already on your grocery list.${left}`);
      return;
    }
    const skipped = already ? ` ${plural(already, 'recipe')} already on your list will be skipped.` : '';
    Alert.alert(
      'Add to grocery list',
      `Add the ingredients for ${plural(plan.meals, 'planned meal')} (${plural(plan.recipeIds.length - already, 'recipe')}) to your grocery list, for the servings planned?${skipped}${left}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => generateGroceryList(plan.recipeIds, plan.factors) },
      ]
    );
  };

  const confirmRelocate = ({ date, slot }) => {
    const { entry, mode } = relocating;
    const result = mode === 'move' ? moveEntry(entry.id, { date, slot }) : copyEntry(entry.id, { date, slot });
    if (check(result)) {
      setRelocating(null);
      setSelected(date);
    }
  };

  const renderEntry = (entry) => {
    const kcal = entryTotals(entry).calories;
    const logged = !!entry.loggedAt;
    const meta = `${servingsLabel(entry.servings)} · ${entry.hasNutrition ? `${n(kcal)} kcal` : 'no calorie estimate'}`;
    const body = (
      <>
        <Text style={[styles.entryName, logged && styles.entryNameLogged]} numberOfLines={2}>{entry.name}</Text>
        <Text style={styles.entryMeta}>{meta}</Text>
      </>
    );
    return (
      <View key={entry.id} testID={`plan-entry-${entry.id}`} style={styles.entry}>
        {entry.kind === 'recipe' ? (
          <TouchableOpacity
            testID={`plan-entry-open-${entry.id}`}
            style={styles.entryText}
            onPress={() => router.push(`/recipe/${entry.refId}`)}>
            {body}
          </TouchableOpacity>
        ) : (
          <View style={styles.entryText}>{body}</View>
        )}
        {logged ? (
          <Text testID={`plan-entry-logged-${entry.id}`} style={styles.loggedTag}>Logged</Text>
        ) : (
          <>
            <View style={styles.stepper}>
              <TouchableOpacity
                testID={`plan-entry-minus-${entry.id}`}
                accessibilityLabel="Fewer servings"
                disabled={entry.servings <= MIN_PLAN_SERVINGS}
                style={[styles.stepButton, entry.servings <= MIN_PLAN_SERVINGS && styles.stepDisabled]}
                onPress={() => setServings(entry.id, entry.servings - SERVINGS_STEP)}>
                <Text style={styles.stepText}>{'−'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`plan-entry-plus-${entry.id}`}
                accessibilityLabel="More servings"
                disabled={entry.servings >= MAX_PLAN_SERVINGS}
                style={[styles.stepButton, entry.servings >= MAX_PLAN_SERVINGS && styles.stepDisabled]}
                onPress={() => setServings(entry.id, entry.servings + SERVINGS_STEP)}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
            {canLogEntry(entry, todayKey) ? (
              <TouchableOpacity testID={`plan-entry-log-${entry.id}`} accessibilityRole="button" style={styles.logButton} onPress={() => logOne(entry)}>
                <Text style={styles.logText}>Log</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
        <TouchableOpacity testID={`plan-entry-menu-${entry.id}`} accessibilityLabel={`Options for ${entry.name}`} hitSlop={8} onPress={() => openMenu(entry)}>
          <Text style={styles.menuDots}>{'•••'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Meal Plan" showBack rightAction={<GroceryListButton />} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.weekRow}>
          <TouchableOpacity testID="plan-prev-week" accessibilityLabel="Previous week" hitSlop={8} onPress={() => setSelected(shiftWeek(selected, -1))}>
            <ChevronLeft size={22} color="#000000" />
          </TouchableOpacity>
          <Text testID="plan-week-label" style={styles.weekLabel}>{weekLabel(selected)}</Text>
          <TouchableOpacity testID="plan-next-week" accessibilityLabel="Next week" hitSlop={8} onPress={() => setSelected(shiftWeek(selected, 1))}>
            <ChevronRight size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        <View style={styles.dayStrip}>
          {days.map((key) => {
            const parts = dayParts(key);
            const active = key === selected;
            const planned = entriesFor(entries, key).length > 0;
            return (
              <TouchableOpacity
                key={key}
                testID={`plan-day-${key}`}
                accessibilityState={{ selected: active }}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => setSelected(key)}>
                <Text style={[styles.dayName, active && styles.dayTextActive]}>{parts.weekday}</Text>
                <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{parts.day}</Text>
                {planned ? <View testID={`plan-dot-${key}`} style={[styles.dot, active && styles.dotActive]} /> : <View style={styles.dotSpace} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dayHeader}>
          <Text testID="plan-day-title" style={styles.dayTitle}>{dayLabel(selected, todayKey)}</Text>
          {selected !== todayKey ? (
            <TouchableOpacity testID="plan-today" accessibilityRole="button" onPress={() => setSelected(todayKey)}>
              <Text style={styles.link}>Go to today</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          {totals.count === 0 ? (
            <Text testID="plan-day-empty" style={styles.empty}>Nothing planned for this day yet.</Text>
          ) : (
            <>
              <Text testID="plan-day-totals" style={styles.totalKcal}>{n(totals.calories)} kcal planned</Text>
              {goal > 0 ? <Text testID="plan-day-goal" style={styles.totalSub}>of your {n(goal)} kcal goal</Text> : null}
              <Text testID="plan-day-macros" style={styles.totalSub}>
                P {n(totals.protein)}g {'·'} C {n(totals.carbs)}g {'·'} F {n(totals.fat)}g
              </Text>
              {totals.missing > 0 ? (
                <Text testID="plan-day-missing" style={styles.warning}>
                  {plural(totals.missing, 'item')} {totals.missing === 1 ? 'has' : 'have'} no calorie estimate, so these totals are low.
                </Text>
              ) : null}
            </>
          )}
          {loggable.length > 0 ? (
            <TouchableOpacity testID="plan-log-day" accessibilityRole="button" style={styles.logAll} onPress={logAll}>
              <Text style={styles.logAllText}>Log everything planned ({loggable.length})</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {MEAL_SLOTS.map((slot) => {
          const items = entriesFor(entries, selected, slot.id);
          // A meal whose items have no calorie estimate shows no calories, rather than a made-up 0.
          const kcal = items.reduce((sum, e) => sum + entryTotals(e).calories, 0);
          const estimated = items.some((e) => e.hasNutrition);
          return (
            <View key={slot.id} testID={`plan-slot-${slot.id}`} style={styles.slot}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotName}>{slot.name}</Text>
                {estimated ? <Text style={styles.slotKcal}>{n(kcal)} kcal</Text> : null}
                <View style={{ flex: 1 }} />
                <TouchableOpacity testID={`plan-add-${slot.id}`} accessibilityLabel={`Add to ${slot.name}`} style={styles.addButton} onPress={() => setAdding(slot.id)}>
                  <Plus size={16} color="#000000" />
                  <Text style={styles.addText}>Add</Text>
                </TouchableOpacity>
              </View>
              {items.map(renderEntry)}
            </View>
          );
        })}

        <TouchableOpacity testID="plan-groceries" accessibilityRole="button" style={styles.groceries} onPress={addGroceries}>
          <Text style={styles.groceriesText}>Add this week's ingredients to the grocery list</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Counts the recipes planned from today to the end of this week, for the servings planned.</Text>
      </ScrollView>

      {adding ? (
        <AddSheet
          slotId={adding}
          date={selected}
          todayKey={todayKey}
          recipes={savedRecipes}
          onClose={() => setAdding(null)}
          onPickRecipe={(recipe) => {
            if (check(addRecipe(recipe, { date: selected, slot: adding }))) setAdding(null);
          }}
          onFindFood={() => {
            const slot = adding;
            setAdding(null);
            router.push({ pathname: '/nutrition/search', params: { mealId: slot, planDate: selected } });
          }}
        />
      ) : null}

      {relocating ? (
        <PlanTargetSheet
          title={relocating.mode === 'move' ? `Move ${relocating.entry.name}` : `Copy ${relocating.entry.name}`}
          confirmLabel={relocating.mode === 'move' ? 'Move' : 'Copy'}
          initialDate={relocating.entry.date}
          initialSlot={relocating.entry.slot}
          onConfirm={confirmRelocate}
          onClose={() => setRelocating(null)}
        />
      ) : null}
    </View>
  );
}

// Choose what to add to a meal: one of the saved recipes, or a food from the food search.
function AddSheet({ slotId, date, todayKey, recipes, onClose, onPickRecipe, onFindFood }) {
  const [tab, setTab] = useState('recipes');
  const [query, setQuery] = useState('');
  const slot = MEAL_SLOTS.find((s) => s.id === slotId);
  const needle = query.trim().toLowerCase();
  const shown = (Array.isArray(recipes) ? recipes : []).filter((r) => !needle || String(r.title || r.name || '').toLowerCase().includes(needle));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View testID="plan-add-sheet" style={styles.sheet}>
        <View style={styles.sheetTop}>
          <TouchableOpacity testID="plan-add-close" accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <Text style={styles.sheetClose}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.sheetTitle} numberOfLines={1}>{`Add to ${slot.name} · ${dayLabel(date, todayKey)}`}</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.tabs}>
          {[{ id: 'recipes', label: 'Recipes' }, { id: 'foods', label: 'Foods' }].map((t) => (
            <TouchableOpacity
              key={t.id}
              testID={`plan-add-tab-${t.id}`}
              accessibilityState={{ selected: tab === t.id }}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'recipes' ? (
          <>
            <TextInput
              testID="plan-add-search"
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search your recipes..."
              placeholderTextColor="#999999"
            />
            <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
              {shown.length === 0 ? (
                <Text testID="plan-add-empty" style={styles.empty}>
                  {recipes && recipes.length ? 'No saved recipe matches that.' : 'You have no saved recipes yet. Save one from Recipes, or add a food instead.'}
                </Text>
              ) : (
                shown.map((r) => (
                  <TouchableOpacity key={r.id} testID={`plan-add-recipe-${r.id}`} style={styles.pickRow} onPress={() => onPickRecipe(r)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName} numberOfLines={2}>{r.title || r.name}</Text>
                      <Text style={styles.entryMeta}>
                        {r.hasNutritionEstimate !== false && r.calories != null ? `${n(Math.round(r.calories))} kcal per serving` : 'no calorie estimate'}
                      </Text>
                    </View>
                    <Text style={styles.pickPlus}>+</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.foodsTab}>
            <Text style={styles.empty}>Search the food database, or pick one of your recent foods or My Foods.</Text>
            <TouchableOpacity testID="plan-add-find-food" accessibilityRole="button" style={styles.findFood} onPress={onFindFood}>
              <Text style={styles.findFoodText}>Find a food</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 140 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  weekLabel: { fontSize: 16, fontWeight: '700', color: '#000000' },
  dayStrip: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dayChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, backgroundColor: '#F0F0F0' },
  dayChipActive: { backgroundColor: '#000000' },
  dayName: { fontSize: 11, fontWeight: '600', color: '#666666' },
  dayNumber: { fontSize: 17, fontWeight: '700', color: '#000000', marginTop: 2 },
  dayTextActive: { color: '#FFFFFF' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#000000', marginTop: 4 },
  dotActive: { backgroundColor: '#FFFFFF' },
  dotSpace: { width: 5, height: 5, marginTop: 4 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dayTitle: { fontSize: 20, fontWeight: '800', color: '#000000' },
  link: { fontSize: 14, fontWeight: '600', color: '#000000', textDecorationLine: 'underline' },
  card: { borderWidth: 1, borderColor: '#EEEEEE', borderRadius: 16, padding: 16, marginBottom: 16 },
  empty: { color: '#999999', fontSize: 14, paddingVertical: 4 },
  totalKcal: { fontSize: 22, fontWeight: '800', color: '#000000' },
  totalSub: { fontSize: 13, color: '#666666', marginTop: 3 },
  warning: { fontSize: 12, color: '#B45309', marginTop: 8 },
  logAll: { marginTop: 12, paddingVertical: 12, borderRadius: 999, backgroundColor: '#000000', alignItems: 'center' },
  logAllText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  slot: { marginBottom: 16 },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  slotName: { fontSize: 17, fontWeight: '700', color: '#000000' },
  slotKcal: { fontSize: 13, color: '#999999' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#000000' },
  addText: { fontSize: 13, fontWeight: '600', color: '#000000' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  entryText: { flex: 1 },
  entryName: { fontSize: 15, fontWeight: '600', color: '#000000' },
  entryNameLogged: { color: '#999999' },
  entryMeta: { fontSize: 12, color: '#999999', marginTop: 2 },
  stepper: { flexDirection: 'row', gap: 4 },
  stepButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  stepDisabled: { opacity: 0.3 },
  stepText: { fontSize: 16, fontWeight: '700', color: '#000000' },
  logButton: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#000000' },
  logText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  loggedTag: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  menuDots: { fontSize: 16, color: '#666666', letterSpacing: 1 },
  groceries: { marginTop: 4, paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: '#000000', alignItems: 'center' },
  groceriesText: { fontSize: 14, fontWeight: '700', color: '#000000' },
  hint: { fontSize: 12, color: '#999999', textAlign: 'center', marginTop: 8 },
  sheet: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sheetClose: { fontSize: 16, fontWeight: '600', color: '#000000', width: 48 },
  sheetTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#000000' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F0F0F0', alignItems: 'center' },
  tabActive: { backgroundColor: '#000000' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666666' },
  tabTextActive: { color: '#FFFFFF' },
  search: { marginHorizontal: 16, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#F5F5F5', fontSize: 15, color: '#000000' },
  sheetList: { paddingHorizontal: 16, paddingBottom: 40 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  pickPlus: { fontSize: 22, fontWeight: '600', color: '#000000' },
  foodsTab: { paddingHorizontal: 16, paddingTop: 12 },
  findFood: { marginTop: 16, paddingVertical: 14, borderRadius: 999, backgroundColor: '#000000', alignItems: 'center' },
  findFoodText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

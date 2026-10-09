import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import NutritionField from '@/components/NutritionField';
import { useNutritionStore } from '@/store/nutritionStore';
import { localDateKey } from '@/lib/localDate';
import { MEAL_SLOTS, SLOT_IDS, slotForHour } from '@/lib/foodLog';
import { buildQuickAdd } from '@/lib/customFood';
import { backToDiary } from '@/lib/diaryNav';

const first = (v) => (Array.isArray(v) ? v[0] : v);

// Log calories without picking a food: a restaurant meal, a bite of something.
// Protein, carbs and fat are optional.
export default function QuickAddScreen() {
  const params = useLocalSearchParams();
  const mealId = first(params.mealId);
  const { addFoodToMeal } = useNutritionStore();

  const [slotId, setSlotId] = useState(() => (SLOT_IDS.includes(mealId) ? mealId : slotForHour(new Date().getHours())));
  const [fields, setFields] = useState({ calories: '', label: '', protein: '', carbs: '', fat: '' });
  const [errors, setErrors] = useState({});

  const set = (key) => (value) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const rest = { ...e };
      delete rest[key];
      return rest;
    });
  };

  const add = () => {
    const result = buildQuickAdd(fields);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    addFoodToMeal(localDateKey(), slotId, result.food);
    backToDiary(router);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Quick Add" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <NutritionField
          testID="qa-calories" label="Calories (kcal)" value={fields.calories} onChangeText={set('calories')}
          error={errors.calories} placeholder="0" keyboardType="number-pad" maxLength={5} autoFocus />
        <NutritionField
          testID="qa-label" label="Name (optional)" value={fields.label} onChangeText={set('label')}
          error={errors.label} placeholder="Quick add" keyboardType="default" maxLength={80} />

        <Text style={styles.sectionLabel}>Meal</Text>
        <View style={styles.pills}>
          {MEAL_SLOTS.map((m) => {
            const active = slotId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                testID={`qa-slot-${m.id}`}
                style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                onPress={() => setSlotId(m.id)}>
                <Text style={[styles.pillText, { color: active ? '#FFFFFF' : '#999999' }]}>{m.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Macros (optional)</Text>
        <NutritionField testID="qa-protein" label="Protein (g)" value={fields.protein} onChangeText={set('protein')} error={errors.protein} placeholder="0" />
        <NutritionField testID="qa-carbs" label="Carbs (g)" value={fields.carbs} onChangeText={set('carbs')} error={errors.carbs} placeholder="0" />
        <NutritionField testID="qa-fat" label="Fat (g)" value={fields.fat} onChangeText={set('fat')} error={errors.fat} placeholder="0" />

        <View style={styles.actions}>
          <PrimaryButton title="Add to Log" onPress={add} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 140 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: 8, marginTop: 8,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  pillActive: { backgroundColor: '#000000' },
  pillInactive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD' },
  pillText: { fontSize: 13, fontWeight: '600' },
  actions: { marginTop: 12 },
});

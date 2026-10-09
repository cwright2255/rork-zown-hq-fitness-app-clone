import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import NutritionField from '@/components/NutritionField';
import { useNutritionStore } from '@/store/nutritionStore';
import { localDateKey } from '@/lib/localDate';
import { MEAL_SLOTS } from '@/lib/foodLog';
import { customFoodToFields } from '@/lib/customFood';
import { backToDiary } from '@/lib/diaryNav';

const EMPTY = { name: '', servingSize: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '' };
const first = (v) => (Array.isArray(v) ? v[0] : v);

// Make a food of your own (or change one): its name, what one serving is and
// what is in it. It is kept in My Foods on the search screen.
export default function CustomFoodScreen() {
  const params = useLocalSearchParams();
  const mealId = first(params.mealId);
  const editId = first(params.editId);
  const presetName = first(params.name);
  const { customFoods, addCustomFood, updateCustomFood, removeCustomFood, addFoodToMeal } = useNutritionStore();

  const editing = editId ? (customFoods || []).find((f) => f.id === editId) : null;
  const slot = MEAL_SLOTS.find((s) => s.id === mealId) || null;

  const [fields, setFields] = useState(() => (
    editing ? customFoodToFields(editing) : { ...EMPTY, name: typeof presetName === 'string' ? presetName : '' }
  ));
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/nutrition'));

  if (editId && !editing) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Edit Food" showBack />
        <View style={styles.center}>
          <Text testID="cf-missing" style={styles.missing}>This food no longer exists.</Text>
        </View>
      </View>
    );
  }

  const save = (logAfter) => {
    const result = editing ? updateCustomFood(editing.id, fields) : addCustomFood(fields);
    if (!result || !result.ok) {
      setErrors((result && result.errors) || {});
      return;
    }
    if (logAfter && slot) {
      addFoodToMeal(localDateKey(), slot.id, result.food);
      backToDiary(router);
      return;
    }
    goBack();
  };

  const confirmDelete = () => {
    Alert.alert('Delete this food?', `${editing.name} is taken out of My Foods. Days it was already logged on keep it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { removeCustomFood(editing.id); goBack(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={editing ? 'Edit Food' : 'Create Food'} showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <NutritionField
          testID="cf-name" label="Name" value={fields.name} onChangeText={set('name')}
          error={errors.name} placeholder="Protein shake" keyboardType="default" maxLength={80} />
        <NutritionField
          testID="cf-serving" label="Serving size" value={fields.servingSize} onChangeText={set('servingSize')}
          error={errors.servingSize} placeholder="1 serving" keyboardType="default" maxLength={60}
          hint="Everything below is for one serving." />
        <NutritionField testID="cf-calories" label="Calories (kcal)" value={fields.calories} onChangeText={set('calories')} error={errors.calories} placeholder="0" />
        <NutritionField testID="cf-protein" label="Protein (g)" value={fields.protein} onChangeText={set('protein')} error={errors.protein} placeholder="0" />
        <NutritionField testID="cf-carbs" label="Carbs (g)" value={fields.carbs} onChangeText={set('carbs')} error={errors.carbs} placeholder="0" />
        <NutritionField testID="cf-fat" label="Fat (g)" value={fields.fat} onChangeText={set('fat')} error={errors.fat} placeholder="0" />

        <Text style={styles.sectionLabel}>Optional</Text>
        <NutritionField testID="cf-fiber" label="Fiber (g)" value={fields.fiber} onChangeText={set('fiber')} error={errors.fiber} placeholder="Leave blank if unknown" />
        <NutritionField testID="cf-sugar" label="Sugar (g)" value={fields.sugar} onChangeText={set('sugar')} error={errors.sugar} placeholder="Leave blank if unknown" />
        <NutritionField testID="cf-sodium" label="Sodium (mg)" value={fields.sodium} onChangeText={set('sodium')} error={errors.sodium} placeholder="Leave blank if unknown" />

        <View style={styles.actions}>
          {editing ? (
            <>
              <PrimaryButton title="Save Changes" onPress={() => save(false)} />
              <TouchableOpacity testID="cf-delete" style={styles.linkBtn} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete Food</Text>
              </TouchableOpacity>
            </>
          ) : slot ? (
            <>
              <PrimaryButton title={`Save & Add to ${slot.name}`} onPress={() => save(true)} />
              <TouchableOpacity testID="cf-save-only" style={styles.linkBtn} onPress={() => save(false)}>
                <Text style={styles.linkText}>Save Only</Text>
              </TouchableOpacity>
            </>
          ) : (
            <PrimaryButton title="Save Food" onPress={() => save(false)} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 140 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  missing: { color: '#666666', fontSize: 15, textAlign: 'center' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: 8, marginTop: 8,
  },
  actions: { marginTop: 12 },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  deleteText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});

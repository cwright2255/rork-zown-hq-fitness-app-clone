import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import { useNutritionStore } from '@/store/nutritionStore';
import { searchFoods } from '@/services/passioService';
import { tokens } from '../../../theme/tokens';



export default function SearchFoodScreen() {
  const { mealId, scannedFood } = useLocalSearchParams();
  const { addFoodToMeal, recentFoods } = useNutritionStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scannedFood) {
      try {
        const f = JSON.parse(scannedFood);
        setResults([{
          id: `scanned-${Date.now()}`,
          name: f.name,
          servingSize: f.servingSize || '100g',
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
        }]);
      } catch (e) {
        console.error('parse scanned food', e);
      }
    }
  }, [scannedFood]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchFoods(query);
        if (!cancelled) setResults(res || []);
      } catch (e) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const handleSelect = (food) => {
    if (mealId && addFoodToMeal) {
      addFoodToMeal(mealId.toString(), food);
      (router.canGoBack() ? router.back() : router.replace('/'));
    } else {
      router.push(`/nutrition/food/${food.id}`);
    }
  };

  const recentQueries = ['Chicken', 'Oatmeal', 'Eggs', 'Banana', 'Yogurt'];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Search Food" showBack />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods..."
          placeholderTextColor={tokens.colors.dark_navy.text_secondary}
          autoFocus
        />
      </View>

      {!query ? (
        <View style={{ paddingHorizontal: tokens.spacing.md }}>
          <Text style={styles.sectionLabel}>Recent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentQueries.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.chip}
                onPress={() => setQuery(q)}>
                <Text style={styles.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {recentFoods?.length ? (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Recent Foods</Text>
              <FlatList
                data={recentFoods}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.foodCard} onPress={() => handleSelect(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodName}>{item.name}</Text>
                      <Text style={styles.foodServing}>{item.servingSize}</Text>
                    </View>
                    <View style={styles.calBadge}>
                      <Text style={styles.calBadgeText}>{item.calories} kcal</Text>
                    </View>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </>
          ) : null}
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.dark_navy.bg_primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i, idx) => i.id?.toString() || idx.toString()}
          contentContainerStyle={{ padding: tokens.spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.foodCard} onPress={() => handleSelect(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodServing}>{item.servingSize || '100g'}</Text>
              </View>
              <View style={styles.calBadge}>
                <Text style={styles.calBadgeText}>{item.calories} kcal</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No results found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  searchWrap: { padding: tokens.spacing.md },
  input: {
    backgroundColor: tokens.colors.dark_navy.text_primary,
    borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.md, height: 52, paddingHorizontal: tokens.spacing.md,
    color: tokens.colors.dark_navy.bg_primary, fontSize: 15,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm,
  },
  chip: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    paddingHorizontal: 14, paddingVertical: tokens.spacing.sm,
    borderRadius: 999, marginRight: 8,
  },
  chipText: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, fontWeight: '500' },
  foodCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: 14, marginBottom: 10,
  },
  foodName: { color: tokens.colors.dark_navy.bg_primary, fontSize: 15, fontWeight: '500' },
  foodServing: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 2 },
  calBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  calBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: tokens.colors.dark_navy.text_secondary, textAlign: 'center', marginTop: 40 },
});

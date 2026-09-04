import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useNutritionStore } from '@/store/nutritionStore';
import { searchFoods, gradeToStars } from '@/services/calorieApiService';

// Real, new 1-5 star display - same component/logic as app/nutrition.jsx,
// duplicated locally rather than shared since these are two small,
// screen-specific presentational components, not shared business logic.
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
      addFoodToMeal(new Date().toISOString().slice(0, 10), mealId.toString(), food);
      (router.canGoBack() ? router.back() : router.replace('/'));
    } else {
      router.push(`/nutrition/food/${food.id}`);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Search Food" showBack />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods..."
          placeholderTextColor="#999999"
          autoFocus
        />
      </View>

      {!query ? (
        <View style={{ paddingHorizontal: 16 }}>
          {recentFoods?.length ? (
            <>
              <Text style={styles.sectionLabel}>Recent Foods</Text>
              <FlatList
                data={recentFoods}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.foodCard} onPress={() => handleSelect(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodName}>{item.name}</Text>
                      <Text style={styles.foodServing}>{item.servingSize}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <StarRating stars={item.nutritionalScore?.score ? gradeToStars(item.nutritionalScore.score) : null} />
                      <View style={styles.calBadge}>
                        <Text style={styles.calBadgeText}>{item.calories} kcal</Text>
                      </View>
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
          <ActivityIndicator color="#000000" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i, idx) => i.id?.toString() || idx.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.foodCard} onPress={() => handleSelect(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodServing}>{item.servingSize || '100g'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <StarRating stars={item.nutritionalScore?.score ? gradeToStars(item.nutritionalScore.score) : null} />
                <View style={styles.calBadge}>
                  <Text style={styles.calBadgeText}>{item.calories} kcal</Text>
                </View>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  searchWrap: { padding: 16 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 12, height: 52, paddingHorizontal: 16,
    color: '#000000', fontSize: 15,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: 8,
  },
  foodCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  foodName: { color: '#000000', fontSize: 15, fontWeight: '500' },
  foodServing: { color: '#999999', fontSize: 13, marginTop: 2 },
  calBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  calBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#999999', textAlign: 'center', marginTop: 40 },
});

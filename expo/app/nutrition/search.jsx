import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Star, ScanLine, Camera, Plus, Zap } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useNutritionStore } from '@/store/nutritionStore';
import { useMealPlanStore } from '@/store/mealPlanStore';
import { searchFoodsDetailed, gradeToStars } from '@/services/calorieApiService';
import { localDateKey } from '@/lib/localDate';
import { matchesFoodQuery } from '@/lib/customFood';
import { MEAL_SLOTS } from '@/lib/foodLog';
import { dayLabel } from '@/lib/mealCopy';

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
  const { mealId, planDate: planParam } = useLocalSearchParams();
  // Opened from the meal plan: a tapped food goes on the plan for that day, not into the diary.
  const planDate = Array.isArray(planParam) ? planParam[0] : planParam;
  const planning = !!planDate;
  const planSlot = planning && mealId ? MEAL_SLOTS.find((s) => s.id === mealId.toString()) : null;
  const { addFoodToMeal, recentFoods, customFoods, removeCustomFood } = useNutritionStore();
  const myFoods = customFoods || [];

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // True when the search could not be reached. The list is then empty (the app has no foods of its own to show instead).
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchFoodsDetailed(query);
        if (!cancelled) {
          setResults(res.results || []);
          setFailed(!!res.failed);
        }
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const handleSelect = (food) => {
    if (planning) {
      const result = useMealPlanStore.getState().addFood(food, { date: planDate, slot: mealId ? mealId.toString() : undefined });
      if (!result.ok) {
        Alert.alert('Could not add', result.error);
        return;
      }
      (router.canGoBack() ? router.back() : router.replace({ pathname: '/nutrition/plan', params: { date: planDate } }));
      return;
    }
    if (mealId && addFoodToMeal) {
      addFoodToMeal(localDateKey(), mealId.toString(), food);
      (router.canGoBack() ? router.back() : router.replace('/'));
    } else {
      router.push(`/nutrition/food/${food.id}`);
    }
  };

  // Which meal the food was being added to (if any) rides along to the scanners.
  const openScanner = (pathname) => {
    router.push({ pathname, params: mealId ? { mealId: mealId.toString() } : {} });
  };

  // The meal the food is being added to (if any) and what was typed ride along to the forms.
  const openForm = (pathname) => {
    const params = {};
    // A food made while planning is only saved to My Foods; it is not logged to today's diary.
    if (mealId && !planning) params.mealId = mealId.toString();
    if (query.trim()) params.name = query.trim();
    router.push({ pathname, params });
  };

  const deleteCustom = (food) => {
    Alert.alert('Delete this food?', `${food.name} is taken out of My Foods. Days it was already logged on keep it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeCustomFood && removeCustomFood(food.id) },
    ]);
  };

  const manageCustom = (food) => {
    Alert.alert(food.name, 'One of your own foods.', [
      { text: 'Edit', onPress: () => router.push({ pathname: '/nutrition/custom-food', params: { editId: food.id } }) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCustom(food) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const trimmedQuery = query.trim();
  const customMatches = trimmedQuery ? myFoods.filter((f) => matchesFoodQuery(f, trimmedQuery)) : [];

  const renderCustomRow = (item) => (
    <TouchableOpacity
      key={item.id}
      testID={`my-food-${item.id}`}
      style={styles.foodCard}
      onPress={() => handleSelect(item)}
      onLongPress={() => manageCustom(item)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodServing}>{item.servingSize || '1 serving'}</Text>
      </View>
      <View style={styles.calBadge}>
        <Text style={styles.calBadgeText}>{item.calories} kcal</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={planning ? 'Plan a Food' : 'Search Food'} showBack />

      {planning ? (
        <View testID="search-plan-banner" style={styles.planBanner}>
          <Text style={styles.planBannerText}>
            {`Adding to your meal plan: ${planSlot ? planSlot.name : 'a meal'} \u00B7 ${dayLabel(planDate)}`}
          </Text>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods..."
          placeholderTextColor="#999999"
          autoFocus
        />
        {planning ? null : (
          <>
            <TouchableOpacity
              testID="search-barcode"
              accessibilityLabel="Scan a barcode"
              style={styles.scanBtn}
              onPress={() => openScanner('/nutrition/barcode-scan')}>
              <ScanLine size={22} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="search-photo"
              accessibilityLabel="Scan food with the camera"
              style={styles.scanBtn}
              onPress={() => openScanner('/nutrition/scan')}>
              <Camera size={22} color="#000000" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity testID="search-create-food" style={styles.actionBtn} onPress={() => openForm('/nutrition/custom-food')}>
          <Plus size={16} color="#000000" />
          <Text style={styles.actionText}>Create Food</Text>
        </TouchableOpacity>
        {planning ? null : (
          <TouchableOpacity testID="search-quick-add" style={styles.actionBtn} onPress={() => openForm('/nutrition/quick-add')}>
            <Zap size={16} color="#000000" />
            <Text style={styles.actionText}>Quick Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {failed && query ? (
        <View testID="search-fallback-banner" style={styles.banner}>
          <Text style={styles.bannerText}>
            Couldn't reach food search. Check your connection and search again.
          </Text>
        </View>
      ) : null}

      {!query ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {myFoods.length ? (
            <>
              <Text style={styles.sectionLabel}>My Foods</Text>
              {myFoods.slice(0, 10).map(renderCustomRow)}
              <Text style={styles.hint}>
                {myFoods.length > 10 ? 'Type a name to find the rest. ' : ''}Hold a food to edit or delete it.
              </Text>
            </>
          ) : null}
          {recentFoods?.length ? (
            <>
              <Text style={styles.sectionLabel}>Recent Foods</Text>
              {recentFoods.map((item) => (
                <TouchableOpacity key={item.id} style={styles.foodCard} onPress={() => handleSelect(item)}>
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
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : loading ? (
        <View style={{ flex: 1 }}>
          {customMatches.length ? (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={styles.sectionLabel}>My Foods</Text>
              {customMatches.map(renderCustomRow)}
            </View>
          ) : null}
          <View style={styles.center}>
            <ActivityIndicator color="#000000" />
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i, idx) => i.id?.toString() || idx.toString()}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            customMatches.length ? (
              <View>
                <Text style={styles.sectionLabel}>My Foods</Text>
                {customMatches.map(renderCustomRow)}
                {results.length ? <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Search Results</Text> : null}
              </View>
            ) : null
          }
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
            // "No results found" would claim the search ran; when it could not be reached the banner above says so.
            customMatches.length || failed ? null : <Text style={styles.empty}>No results found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  searchWrap: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 12, height: 52, paddingHorizontal: 16,
    color: '#000000', fontSize: 15,
  },
  scanBtn: {
    width: 52, height: 52, borderRadius: 12,
    borderWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF',
  },
  actionText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  hint: { color: '#999999', fontSize: 12, marginBottom: 12 },
  planBanner: { marginHorizontal: 16, marginBottom: 4, padding: 12, borderRadius: 12, backgroundColor: '#F0F0F0' },
  planBannerText: { color: '#000000', fontSize: 13, fontWeight: '600' },
  banner: {
    marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  bannerText: { color: '#78350F', fontSize: 13 },
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

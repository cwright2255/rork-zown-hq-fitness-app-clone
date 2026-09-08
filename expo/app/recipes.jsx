import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image,
  RefreshControl, Pressable, Platform, TextInput, Modal, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRecipeStore } from '@/store/recipeStore';
import { useUserStore } from '@/store/userStore';
import RecipeImportModal from '@/components/RecipeImportModal';
import RecipePreviewModal from '@/components/RecipePreviewModal';
import recipeExtractionService from '@/services/recipeExtractionService';

const CATS = ['All','High Protein','Low Carb','Vegan','Quick Meals','Post-Workout'];

const NAV_BAR_CLEARANCE = Platform.OS === 'ios' ? 120 : 110;

function buildBrowseSections(dietaryPreferences) {
  const { diet, allergies, dailyCalorieGoal } = dietaryPreferences || {};
  const dietParam = diet ? { diet } : {};
  const intoleranceParam = allergies?.length ? { intolerances: allergies.join(',') } : {};

  const mealCalorieRange = dailyCalorieGoal
    ? { minCalories: String(Math.round(dailyCalorieGoal * 0.25)), maxCalories: String(Math.round(dailyCalorieGoal * 0.35)) }
    : { minCalories: '300', maxCalories: '700' };
  const quickCalorieCeiling = dailyCalorieGoal
    ? { maxCalories: String(Math.round(dailyCalorieGoal * 0.35)) }
    : { maxCalories: '700' };

  return {
    featured: { minProtein: '15', maxSugar: '15', ...mealCalorieRange, instructionsRequired: 'true', sort: 'popularity', number: 1, ...dietParam, ...intoleranceParam },
    postWorkout: { minProtein: '20', maxFat: '25', maxSugar: '20', instructionsRequired: 'true', sort: 'popularity', number: 12, ...dietParam, ...intoleranceParam },
    mealPrep: { minServings: '4', minProtein: '15', maxSugar: '20', type: 'main course', instructionsRequired: 'true', sort: 'popularity', number: 12, ...dietParam, ...intoleranceParam },
    quickEasy: { maxReadyTime: '20', ...quickCalorieCeiling, maxSugar: '20', instructionsRequired: 'true', sort: 'time', number: 12, ...dietParam, ...intoleranceParam },
  };
}

function buildSearchParams(query, dietaryPreferences) {
  const { diet, allergies } = dietaryPreferences || {};
  return {
    query,
    instructionsRequired: 'true',
    number: 20,
    ...(diet ? { diet } : {}),
    ...(allergies?.length ? { intolerances: allergies.join(',') } : {}),
  };
}

function buildAiRecommendationsParams(dietaryPreferences, fitnessLevel, savedRecipes) {
  const { diet, allergies, dailyCalorieGoal } = dietaryPreferences || {};
  const dietParam = diet ? { diet } : {};
  const intoleranceParam = allergies?.length ? { intolerances: allergies.join(',') } : {};

  const cuisineCounts = {};
  (savedRecipes || []).forEach((r) => {
    (r.tags || []).forEach((t) => {
      cuisineCounts[t] = (cuisineCounts[t] || 0) + 1;
    });
  });
  const topCuisineEntry = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];
  const cuisineParam = topCuisineEntry && topCuisineEntry[1] >= 2 ? { cuisine: topCuisineEntry[0] } : {};

  const ADVANCED_LEVELS = ['advanced', 'elite'];
  const minProtein = ADVANCED_LEVELS.includes(fitnessLevel) ? '25' : '18';

  const mealCalorieRange = dailyCalorieGoal
    ? { minCalories: String(Math.round(dailyCalorieGoal * 0.25)), maxCalories: String(Math.round(dailyCalorieGoal * 0.35)) }
    : { minCalories: '300', maxCalories: '700' };

  return {
    minProtein, maxSugar: '15', ...mealCalorieRange, instructionsRequired: 'true', sort: 'popularity', number: 12,
    ...dietParam, ...intoleranceParam, ...cuisineParam,
  };
}

// Real fix: these pills used to only filter the small, personal Saved
// Recipes list - tapping "High Protein" with few or no saved recipes
// visibly did nothing, completely disconnected from Spoonacular's much
// larger recipe database. Each pill except "All" now runs a real,
// targeted Spoonacular query and replaces the discovery area with
// matching results, the same way search already does. Allergies still
// apply regardless of which pill is active (a safety constraint, not a
// taste preference). Vegan is the one case where the pill's own intent
// deliberately overrides a user's separately-stated profile diet
// (e.g. keto) for this specific view, rather than combining the two
// into a near-impossible intersection - the object spread order below
// (diet after ...base) is what makes that override happen.
function buildCategoryParams(category, dietaryPreferences) {
  const { diet, allergies } = dietaryPreferences || {};
  const dietParam = diet ? { diet } : {};
  const intoleranceParam = allergies?.length ? { intolerances: allergies.join(',') } : {};
  const base = { instructionsRequired: 'true', sort: 'popularity', number: 20, ...dietParam, ...intoleranceParam };

  switch (category) {
    case 'High Protein':
      return { ...base, minProtein: '25' };
    case 'Low Carb':
      return { ...base, maxCarbs: '20' };
    case 'Vegan':
      return { ...base, diet: 'vegan' };
    case 'Quick Meals':
      return { ...base, maxReadyTime: '20', sort: 'time' };
    case 'Post-Workout':
      return { ...base, minProtein: '20', maxFat: '25' };
    default:
      return null;
  }
}

function SectionHeader({ title, onViewAll, expanded, right }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {right}
        {onViewAll ? (
          <Pressable onPress={onViewAll}>
            <Text style={s.viewAll}>{expanded ? 'Show Less' : 'View All'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RecipeCard({ item, onPress }) {
  return (
    <Pressable style={s.recipeCard} onPress={onPress}>
      <View style={s.recipeImage}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.recipeImagePhoto} resizeMode="cover" />
        ) : (
          <Ionicons name="restaurant-outline" size={24} color="#CCC" />
        )}
      </View>
      <Text style={s.recipeName} numberOfLines={2}>{item.name}</Text>
      <View style={s.recipeMeta}>
        {item.cal ? <Text style={s.recipeMetaText}>{item.cal}</Text> : null}
        <Text style={s.recipeMetaText}>{item.time}</Text>
      </View>
    </Pressable>
  );
}

function SavedCard({ item, onLongPress }) {
  return (
    <Pressable style={s.savedCard} onLongPress={onLongPress}>
      <View style={s.savedImage}>
        {item.imageUrl || item.image ? (
          <Image source={{ uri: item.imageUrl || item.image }} style={s.savedImagePhoto} resizeMode="cover" />
        ) : (
          <Ionicons name="restaurant-outline" size={28} color="#CCC" />
        )}
        {item.source ? (
          <View style={[s.sourceBadge, { backgroundColor: item.color || '#333' }]}>
            <Text style={s.sourceBadgeText}>{item.source}</Text>
          </View>
        ) : null}
        <View style={s.bookmarkIcon}>
          <Ionicons name="bookmark" size={18} color="#FFD700" />
        </View>
      </View>
      <Text style={s.savedTitle} numberOfLines={2}>{item.title}</Text>
      <View style={s.savedMeta}>
        <Text style={s.savedMetaText}>{item.cal}</Text>
        <Text style={s.savedMetaText}>{item.time}</Text>
        <Text style={s.savedMetaText}>{item.servings}</Text>
      </View>
    </Pressable>
  );
}

export default function RecipesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cat, setCat] = useState('All');
  const [showImportModal, setShowImportModal] = useState(false);
  const { savedRecipes, loadRecipes, removeRecipe, addRecipe } = useRecipeStore();
  const { user } = useUserStore();

  const [browse, setBrowse] = useState({ featured: [], aiRecommendations: [], postWorkout: [], mealPrep: [], quickEasy: [] });
  const [browseLoading, setBrowseLoading] = useState(true);
  const [expanded, setExpanded] = useState({ aiRecommendations: false, postWorkout: false, mealPrep: false, quickEasy: false });
  const [previewRecipeId, setPreviewRecipeId] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Real, new state for category-pill results - separate from
  // searchResults since a pill and a text search are two different,
  // mutually exclusive browse modes (selecting one clears the other,
  // see setCat/handleSearchSubmit below).
  const [categoryResults, setCategoryResults] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      setIsLoading(true);
      loadRecipes(user.uid).finally(() => setIsLoading(false));
    }
  }, [user?.uid]);

  const dietPref = user?.dietaryPreferences?.diet || null;
  const allergiesPref = (user?.dietaryPreferences?.allergies || []).join(',');
  const calorieGoalPref = user?.dietaryPreferences?.dailyCalorieGoal || null;
  const fitnessLevelPref = user?.fitnessLevel || null;
  const savedRecipesCount = savedRecipes?.length || 0;

  useEffect(() => {
    let cancelled = false;
    setBrowseLoading(true);
    const sections = buildBrowseSections(user?.dietaryPreferences);
    const aiParams = buildAiRecommendationsParams(user?.dietaryPreferences, user?.fitnessLevel, savedRecipes);
    Promise.all([
      recipeExtractionService.getSpoonacularBrowse(sections.featured, sections.featured.number),
      recipeExtractionService.getSpoonacularBrowse(aiParams, aiParams.number),
      recipeExtractionService.getSpoonacularBrowse(sections.postWorkout, sections.postWorkout.number),
      recipeExtractionService.getSpoonacularBrowse(sections.mealPrep, sections.mealPrep.number),
      recipeExtractionService.getSpoonacularBrowse(sections.quickEasy, sections.quickEasy.number),
    ]).then(([featured, aiRecommendations, postWorkout, mealPrep, quickEasy]) => {
      if (cancelled) return;
      const seen = new Set();
      const dedupe = (items) => {
        const kept = items.filter((item) => !seen.has(item.id));
        kept.forEach((item) => seen.add(item.id));
        return kept;
      };
      setBrowse({
        featured: dedupe(featured),
        aiRecommendations: dedupe(aiRecommendations),
        postWorkout: dedupe(postWorkout),
        mealPrep: dedupe(mealPrep),
        quickEasy: dedupe(quickEasy),
      });
    }).finally(() => {
      if (!cancelled) setBrowseLoading(false);
    });
    return () => { cancelled = true; };
  }, [dietPref, allergiesPref, calorieGoalPref, fitnessLevelPref, savedRecipesCount]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    recipeExtractionService.getSpoonacularBrowse(buildSearchParams(searchQuery, user?.dietaryPreferences), 20).then((results) => {
      if (!cancelled) setSearchResults(results);
    }).finally(() => {
      if (!cancelled) setSearchLoading(false);
    });
    return () => { cancelled = true; };
  }, [searchQuery]);

  // Real, new effect: fetches whenever a non-"All" category pill is
  // active, using buildCategoryParams above. Re-fetches if the user's
  // dietary preferences change while a category is active too, same
  // reasoning as the main browse effect.
  useEffect(() => {
    if (cat === 'All') {
      setCategoryResults(null);
      return;
    }
    let cancelled = false;
    setCategoryLoading(true);
    const params = buildCategoryParams(cat, user?.dietaryPreferences);
    recipeExtractionService.getSpoonacularBrowse(params, params.number).then((results) => {
      if (!cancelled) setCategoryResults(results);
    }).finally(() => {
      if (!cancelled) setCategoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [cat, dietPref, allergiesPref]);

  // Saved Recipes is only ever shown in the "All" state now (see the
  // render below - a category pill or search replaces the whole
  // discovery area, same as before), so this no longer needs its own
  // category-based filter.
  const displayRecipes = savedRecipes || [];

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await loadRecipes(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleCardPress = (item) => setPreviewRecipeId(item.id);

  const toggleExpanded = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Real fix: search and a category pill are two separate, mutually
  // exclusive browse modes - submitting a search clears any active
  // category, and selecting a category (below) clears any active
  // search, so the discovery area is never asked to show two different
  // result sets at once.
  const handleSearchSubmit = () => {
    setCat('All');
    setSearchQuery(searchInput.trim());
  };
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleCategoryPress = (category) => {
    setSearchInput('');
    setSearchQuery('');
    setCat(category);
  };

  const renderBrowseSection = (title, key, marginBottom = 24) => {
    const items = browse[key] || [];
    const visible = expanded[key] ? items : items.slice(0, 6);
    return (
      <>
        <SectionHeader title={title} onViewAll={() => toggleExpanded(key)} expanded={expanded[key]} />
        {browseLoading ? (
          <View style={{ paddingHorizontal: 20, marginBottom }}>
            <LoadingSkeleton width="100%" height={140} borderRadius={12} />
          </View>
        ) : items.length === 0 ? (
          <Text style={[s.recipeMetaText, { paddingHorizontal: 20, marginBottom }]}>
            Nothing to show right now.{recipeExtractionService.lastDiagnostic ? ` (${recipeExtractionService.lastDiagnostic})` : ''}
          </Text>
        ) : expanded[key] ? (
          <View style={[s.gridWrap, { marginBottom }]}>
            {visible.map((item) => (
              <RecipeCard key={item.id} item={item} onPress={() => handleCardPress(item)} />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom }}>
            {visible.map((item) => (
              <RecipeCard key={item.id} item={item} onPress={() => handleCardPress(item)} />
            ))}
          </ScrollView>
        )}
      </>
    );
  };

  const featuredItem = browse.featured?.[0];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <RecipeImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => user?.uid && loadRecipes(user.uid)}
      />
      <RecipePreviewModal
        visible={!!previewRecipeId}
        recipeId={previewRecipeId}
        onClose={() => setPreviewRecipeId(null)}
        onSaved={() => user?.uid && loadRecipes(user.uid)}
        addRecipe={addRecipe}
        uid={user?.uid}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <Text style={s.pageTitle}>Recipes</Text>

        {/* Category Pills - real fix: these now run a real Spoonacular
            query per pill (see buildCategoryParams/handleCategoryPress
            above) instead of only filtering the small Saved Recipes
            list */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 16 }}>
          {CATS.map(c => (
            <Pressable key={c} style={[s.catPill, cat === c && s.catPillActive]} onPress={() => handleCategoryPress(c)}>
              <Text style={[s.catPillText, cat === c && s.catPillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={18} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor="#999"
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </Pressable>
          ) : null}
        </View>

        {searchQuery ? (
          <>
            {/* Search Results */}
            <SectionHeader title={`Results for "${searchQuery}"`} />
            {searchLoading ? (
              <View style={[s.gridWrap, { marginBottom: 24 }]}>
                <LoadingSkeleton width="100%" height={140} borderRadius={12} />
              </View>
            ) : !searchResults?.length ? (
              <Text style={[s.recipeMetaText, { paddingHorizontal: 20, marginBottom: 24 }]}>No recipes found for that search.</Text>
            ) : (
              <View style={[s.gridWrap, { marginBottom: 24 }]}>
                {searchResults.map((item) => (
                  <RecipeCard key={item.id} item={item} onPress={() => handleCardPress(item)} />
                ))}
              </View>
            )}
          </>
        ) : cat !== 'All' ? (
          <>
            {/* Category Results - real, live Spoonacular results for
                the selected pill */}
            <SectionHeader title={cat} />
            {categoryLoading ? (
              <View style={[s.gridWrap, { marginBottom: 24 }]}>
                <LoadingSkeleton width="100%" height={140} borderRadius={12} />
              </View>
            ) : !categoryResults?.length ? (
              <Text style={[s.recipeMetaText, { paddingHorizontal: 20, marginBottom: 24 }]}>Nothing to show right now.</Text>
            ) : (
              <View style={[s.gridWrap, { marginBottom: 24 }]}>
                {categoryResults.map((item) => (
                  <RecipeCard key={item.id} item={item} onPress={() => handleCardPress(item)} />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Loading and Empty States */}
            {isLoading ? (
              <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                <LoadingSkeleton width="100%" height={160} borderRadius={12} />
              </View>
            ) : (savedRecipes || []).length === 0 ? (
              <EmptyState
                icon="BookOpen"
                title="No saved recipes"
                subtitle="Import a recipe from any URL to get started"
                buttonText="Import Recipe"
                onPress={() => setShowImportModal(true)}
              />
            ) : null}
            {/* Saved Recipes Carousel */}
            <SectionHeader
              title="Saved Recipes"
              right={<Text style={s.savedCount}>{displayRecipes.length} saved</Text>}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 24 }}>
              {displayRecipes.map(item => <SavedCard key={item.id} item={item} onLongPress={() => {
                Alert.alert('Remove Recipe', 'Remove this recipe from saved?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeRecipe(item.id, user?.uid) },
                ]);
              }} />)}
            </ScrollView>

            {/* Featured Recipe */}
            <SectionHeader title="Featured" />
            {browseLoading ? (
              <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                <LoadingSkeleton width="100%" height={200} borderRadius={16} />
              </View>
            ) : featuredItem ? (
              <Pressable style={s.featuredCard} onPress={() => handleCardPress(featuredItem)}>
                <View style={s.featuredImage}>
                  {featuredItem.imageUrl ? (
                    <Image source={{ uri: featuredItem.imageUrl }} style={s.featuredImagePhoto} resizeMode="cover" />
                  ) : (
                    <Ionicons name="flame-outline" size={32} color="#CCC" />
                  )}
                </View>
                <View style={s.featuredContent}>
                  <Text style={s.featuredTitle}>{featuredItem.name}</Text>
                  <Text style={s.featuredMeta}>
                    {[featuredItem.cal, featuredItem.time].filter(Boolean).join('  \u00B7  ')}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Text style={[s.recipeMetaText, { paddingHorizontal: 20, marginBottom: 24 }]}>
                Nothing to show right now.{recipeExtractionService.lastDiagnostic ? ` (${recipeExtractionService.lastDiagnostic})` : ''}
              </Text>
            )}

            {/* AI Recommendations */}
            {renderBrowseSection('AI Recommendations', 'aiRecommendations')}

            {/* Post-Workout */}
            {renderBrowseSection('Post-Workout', 'postWorkout')}

            {/* Meal Prep */}
            {renderBrowseSection('Meal Prep', 'mealPrep')}

            {/* Quick & Easy */}
            {renderBrowseSection('Quick & Easy', 'quickEasy', 12)}
          </>
        )}

        {/* Add Recipe Button */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 24 }}>
          <Pressable style={s.addRecipeBtn} onPress={() => setShowImportModal(true)}>
            <Ionicons name="link-outline" size={18} color="#FFF" />
            <Text style={s.addRecipeBtnText}>Add Recipe</Text>
          </Pressable>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: NAV_BAR_CLEARANCE },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#000', paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },

  /* Category Pills */
  catPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  catPillActive: { backgroundColor: '#000' },
  catPillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  catPillTextActive: { color: '#FFF' },

  /* Search Bar */
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 20 },
  searchInput: { flex: 1, fontSize: 15, color: '#000' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  viewAll: { fontSize: 14, fontWeight: '600', color: '#000' },
  savedCount: { fontSize: 12, color: '#999', backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  /* Recipe Card */
  recipeCard: { width: 140, marginRight: 12, marginBottom: 16 },
  recipeImage: { width: 140, height: 100, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  recipeImagePhoto: { width: '100%', height: '100%' },
  recipeName: { fontSize: 13, fontWeight: '600', color: '#000', marginTop: 6 },
  recipeMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  recipeMetaText: { fontSize: 11, color: '#999' },

  /* Grid (expanded "View All" state, search results, category results) */
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, justifyContent: 'flex-start' },

  /* Saved Card */
  savedCard: { width: 180, marginRight: 14 },
  savedImage: { width: 180, height: 140, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  savedImagePhoto: { width: '100%', height: '100%' },
  sourceBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sourceBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  bookmarkIcon: { position: 'absolute', top: 8, right: 8 },
  savedTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 8 },
  savedMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  savedMetaText: { fontSize: 11, color: '#999' },

  /* Featured */
  featuredCard: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 24, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 }, default: {} }) },
  featuredImage: { height: 160, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  featuredImagePhoto: { width: '100%', height: '100%' },
  featuredContent: { padding: 14, backgroundColor: '#FFF' },
  featuredTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  featuredMeta: { fontSize: 13, color: '#999', marginTop: 4 },

  /* Add Recipe */
  addRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', height: 52, borderRadius: 26 },
  addRecipeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, minHeight: 400 },
  dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 20 },

  sourceRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  sourceCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sourceP: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  urlRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  urlInput: { flex: 1, fontSize: 15, color: '#000', marginLeft: 8 },
  errText: { fontSize: 12, color: '#FF3B30', marginTop: 8 },

  importBtn: { marginTop: 16, backgroundColor: '#000', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  importBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  /* Preview */
  previewCard: { backgroundColor: '#F8F8F8', borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  previewImage: { height: 160, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '700', color: '#000', padding: 12, paddingBottom: 4 },
  previewDesc: { fontSize: 13, color: '#666', paddingHorizontal: 12, paddingBottom: 8, lineHeight: 18 },
  previewMeta: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingBottom: 12 },
  previewMetaText: { fontSize: 12, color: '#999', backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  limitedNote: { fontSize: 11, color: '#999', fontStyle: 'italic', paddingHorizontal: 12, paddingBottom: 12 },
  cancelLink: { alignItems: 'center', marginTop: 12 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#999' },
});

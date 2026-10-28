import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image,
  RefreshControl, Pressable, Platform, TextInput, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRecipeStore } from '@/store/recipeStore';
import GroceryListButton from '@/components/GroceryListButton';
import { useUserStore } from '@/store/userStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { eatGoal } from '@/lib/calorieGoals';
import { sessionsOf, countOnDay } from '@/lib/activity';
import { foodTotals } from '@/lib/nutritionHistory';
import { localDateKey } from '@/lib/localDate';
import RecipeImportModal from '@/components/RecipeImportModal';
import RecipePreviewModal from '@/components/RecipePreviewModal';
import recipeExtractionService from '@/services/recipeExtractionService';
import {
  CATEGORIES, MEAL_CHIPS, resolveDietaryPreferences, buildHomeSections, buildRelaxedPoolParams, buildCategoryParams,
  buildSearchParams, buildKitchenParams, kitchenLine, cacheKeyFor,
} from '@/lib/recipeBrowse';
import { dayContext, rankRecipes, layoutPicks, diversify, sizingLine, SLOT_NAME } from '@/lib/recipePicks';
import { loadBrowseCache, rememberBrowse, isFresh, isShowable } from '@/lib/recipeCache';
import { loadRecentPicks, recordPicks } from '@/lib/recipeHistory';
import { withCacheKeys, fetchHome, fetchOne, cacheEntries, itemsToShow } from '@/lib/recipeLoader';
import { findSavedMatch, isSavedRecipe } from '@/lib/recipeSaved';
import RecipeCard from '@/components/recipes/RecipeCard';
import HeroPick from '@/components/recipes/HeroPick';
import MacroChips from '@/components/recipes/MacroChips';
import KitchenSheet from '@/components/recipes/KitchenSheet';

const NAV_BAR_CLEARANCE = Platform.OS === 'ios' ? 120 : 110;

const EMPTY_HOME = { pool: [], postWorkout: [], mealPrep: [], quickEasy: [] };

// What the tab does, in order:
//   1. It reads what it kept from last time (the recipes, and which ones were top picks on which days) and puts the recipes on
//      screen at once, so there is never a blank page while the function that fetches them wakes up (lib/recipeCache.js).
//   2. If that is old, or from another day, it asks again in ONE call and swaps the new recipes in quietly (lib/recipeLoader.js).
//   3. It ranks the wide set of recipes for the meal that fits the time of day against the person's own day: calories and protein
//      left, training today, goals, cuisines they saved, and what they were shown the last few days (lib/recipePicks.js).
// A recipe is never kept or shown for a different diet, allergy or food to avoid than the person has now: they are part of every
// question and of the name each answer is kept under (lib/recipeBrowse.js).

function SectionHeader({ title, onViewAll, expanded, right, testID }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {right}
        {onViewAll ? (
          <Pressable testID={testID} onPress={onViewAll}>
            <Text style={s.viewAll}>{expanded ? 'Show Less' : 'View All'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// A recipe the person saved. These carry the nutrition the saved recipe has (nothing is made up for one that has none), and open
// the full recipe. Press and hold removes it.
function SavedCard({ item, onPress, onLongPress }) {
  const calories = typeof item.calories === 'number' ? Math.round(item.calories) : null;
  return (
    <Pressable testID={`saved-${item.id}`} style={s.savedCard} onPress={onPress} onLongPress={onLongPress}>
      <View style={s.savedImage}>
        {item.imageUrl || item.image ? (
          <Image source={{ uri: item.imageUrl || item.image }} style={s.savedImagePhoto} resizeMode="cover" />
        ) : (
          <Ionicons name="restaurant-outline" size={28} color="#CCC" />
        )}
        <View style={s.bookmarkIcon}>
          <Ionicons name="bookmark" size={18} color="#FFD700" />
        </View>
      </View>
      <Text style={s.savedTitle} numberOfLines={2}>{item.title || item.name}</Text>
      {calories !== null ? <Text style={s.savedMetaText}>{calories} cal</Text> : null}
      <View style={{ marginTop: 6 }}><MacroChips item={item} /></View>
    </Pressable>
  );
}

export default function RecipesScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const gridCardWidth = Math.floor((screenWidth - 40 - 12) / 2);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('All');
  const [showImportModal, setShowImportModal] = useState(false);
  const { savedRecipes, loadRecipes, removeRecipe, addRecipe } = useRecipeStore();
  const { user } = useUserStore();
  const uid = user?.uid;

  const eatTarget = useNutritionStore((st) => eatGoal(st));
  const meals = useNutritionStore((st) => st.meals);
  const dailyGoals = useNutritionStore((st) => st.dailyGoals);
  const completedWorkouts = useWorkoutStore((st) => st.completedWorkouts);
  const runs = useRunningStore((st) => st.runs);
  const completedHikes = useHikingStore((st) => st.completedHikes);

  const [preview, setPreview] = useState(null); // { id, plan }
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categoryResults, setCategoryResults] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [kitchenList, setKitchenList] = useState([]);
  const [kitchenResults, setKitchenResults] = useState(null);
  const [kitchenLoading, setKitchenLoading] = useState(false);
  const [savingIds, setSavingIds] = useState({});
  const [picksExpanded, setPicksExpanded] = useState(false);
  const [expanded, setExpanded] = useState({ postWorkout: false, mealPrep: false, quickEasy: false });

  const [booted, setBooted] = useState(false);
  const [recent, setRecent] = useState({});
  const cacheRef = useRef({});
  const [home, setHome] = useState(EMPTY_HOME);
  const [homeLoading, setHomeLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const forceRef = useRef(false);

  useEffect(() => {
    if (uid) loadRecipes(uid);
  }, [uid]);

  // ---- the person -------------------------------------------------------------------------------------------------------------

  const todayKey = localDateKey();
  // The diet, allergies and foods to avoid, and the EAT goal that sizes a meal (not the burn goal on the home Calories card, which
  // says nothing about how much to eat: lib/calorieGoals.js). eatTarget is null until a real target exists.
  const prefs = useMemo(() => resolveDietaryPreferences(user, eatTarget), [user, eatTarget]);
  const prefsKey = `${prefs.signature}|${prefs.dailyCalorieGoal || ''}`;

  const eaten = useMemo(() => {
    const foods = (Array.isArray(meals) ? meals : [])
      .filter((m) => m && m.date === todayKey)
      .flatMap((m) => (Array.isArray(m.foods) ? m.foods : []));
    const totals = foodTotals(foods);
    return { calories: totals.calories, protein: totals.protein };
  }, [meals, todayKey]);
  const trained = useMemo(
    () => countOnDay(sessionsOf({ workouts: completedWorkouts, runs, hikes: completedHikes }), todayKey) > 0,
    [completedWorkouts, runs, completedHikes, todayKey],
  );
  const goalsReal = eatTarget != null;
  const goalKey = prefs.goals.join(',');

  // The person's day for a meal. `nominal` leaves out what they ate and did today: it sizes the questions asked of Spoonacular, so
  // logging a food does not send the tab off to fetch again (the ranking, which does use the day, happens here on the phone).
  const ctxFor = useCallback((slot, nominal = false) => dayContext({
    now: new Date(),
    slot,
    goals: dailyGoals,
    goalsReal,
    eaten: nominal ? undefined : eaten,
    trained: nominal ? false : trained,
    goalList: prefs.goals,
    saved: nominal ? [] : savedRecipes,
  }), [dailyGoals, goalsReal, eaten, trained, goalKey, savedRecipes]);
  const ctx = useMemo(() => ctxFor(undefined), [ctxFor]);
  const nominalCtx = useMemo(() => ctxFor(ctx.slot, true), [ctxFor, ctx.slot]);

  // ---- what was kept from last time ---------------------------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    setBooted(false);
    Promise.all([loadBrowseCache(uid), loadRecentPicks(uid)]).then(([cache, picks]) => {
      if (cancelled) return;
      cacheRef.current = cache;
      setRecent(picks);
      setBooted(true);
    });
    return () => { cancelled = true; };
  }, [uid]);

  const remember = useCallback((entries) => {
    if (!Object.keys(entries).length) return;
    rememberBrowse(uid, entries).then((all) => { cacheRef.current = all; });
  }, [uid]);

  // ---- the home page: the pool of recipes and the three rows, in one call ---------------------------------------------------------

  useEffect(() => {
    if (!booted) return undefined;
    let cancelled = false;
    const force = forceRef.current;
    forceRef.current = false;
    const sections = withCacheKeys(buildHomeSections(prefs, nominalCtx, new Date()));
    const cache = cacheRef.current;
    const cached = {};
    sections.forEach((sec) => { if (isShowable(cache[sec.cacheKey])) cached[sec.key] = cache[sec.cacheKey].items; });
    // Only what is kept for THESE questions is shown: after the diet or an allergy changes, the old recipes are not.
    setHome({ ...EMPTY_HOME, ...cached });
    const stale = sections.filter((sec) => force || !isFresh(cache[sec.cacheKey], todayKey));
    if (!stale.length) {
      setHomeLoading(false);
      return undefined;
    }
    setHomeLoading(!cached.pool);
    fetchHome({
      service: recipeExtractionService,
      sections: stale,
      relaxedPool: stale.some((sec) => sec.key === 'pool') ? buildRelaxedPoolParams(prefs) : null,
    }).then((byKey) => {
      if (cancelled) return;
      remember(cacheEntries(stale, byKey, { now: Date.now(), dayKey: todayKey }));
      setHome((h) => {
        const next = { ...h };
        stale.forEach((sec) => { next[sec.key] = itemsToShow(byKey[sec.key], h[sec.key]); });
        return next;
      });
    }).catch(() => {}).finally(() => {
      if (!cancelled) setHomeLoading(false);
    });
    return () => { cancelled = true; };
  }, [booted, prefsKey, nominalCtx.calTarget, ctx.slot, refreshTick]);

  const ranked = useMemo(() => rankRecipes(home.pool, ctx, { recent, todayKey }), [home.pool, ctx, recent, todayKey]);
  const layout = useMemo(() => layoutPicks(ranked, { picks: 6, more: 8 }), [ranked]);
  const rows = useMemo(() => {
    const seen = new Set([layout.hero, ...layout.picks].filter(Boolean).map((i) => i.id));
    // A recipe is shown once on the page: not in a row if it is a top pick, nor in a second row.
    const take = (list) => list.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
    return { postWorkout: take(home.postWorkout), mealPrep: take(home.mealPrep), quickEasy: take(home.quickEasy) };
  }, [home, layout]);

  // ---- a chip, a search, "cook with what I have" --------------------------------------------------------------------------------

  const searching = !!searchQuery;
  const kitchenActive = kitchenList.length > 0;
  const chipActive = cat !== 'All';
  const homeMode = !searching && !kitchenActive && !chipActive;
  const chipSlot = MEAL_CHIPS[cat] || null;
  const chipNominalCal = chipSlot ? ctxFor(chipSlot, true).calTarget : null;

  useEffect(() => {
    if (!booted || !chipActive || searching || kitchenActive) {
      setCategoryResults(null);
      setCategoryLoading(false);
      return undefined;
    }
    const params = buildCategoryParams(cat, prefs, chipSlot ? ctxFor(chipSlot, true) : null);
    if (!params) return undefined;
    let cancelled = false;
    const cacheKey = cacheKeyFor(`cat:${cat}`, params);
    const entry = cacheRef.current[cacheKey];
    setCategoryResults(isShowable(entry) ? entry.items : null);
    if (isFresh(entry, todayKey)) {
      setCategoryLoading(false);
      return undefined;
    }
    setCategoryLoading(!isShowable(entry));
    fetchOne({ service: recipeExtractionService, params, number: params.number }).then((items) => {
      if (cancelled) return;
      if (items.length) {
        remember({ [cacheKey]: { items, at: Date.now(), day: todayKey } });
        setCategoryResults(items);
      } else {
        setCategoryResults((cur) => cur || []);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setCategoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [booted, cat, searching, kitchenActive, prefsKey, chipNominalCal]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults(null);
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    recipeExtractionService.getSpoonacularBrowse(buildSearchParams(searchQuery, prefs), 20).then((results) => {
      if (!cancelled) setSearchResults(results);
    }).finally(() => {
      if (!cancelled) setSearchLoading(false);
    });
    return () => { cancelled = true; };
  }, [searchQuery, prefsKey]);

  const kitchenKey = kitchenList.join(',');
  useEffect(() => {
    if (!kitchenList.length) {
      setKitchenResults(null);
      return undefined;
    }
    let cancelled = false;
    setKitchenLoading(true);
    const params = buildKitchenParams(kitchenList, prefs);
    fetchOne({ service: recipeExtractionService, params, number: params.number }).then((results) => {
      if (!cancelled) setKitchenResults(results);
    }).finally(() => {
      if (!cancelled) setKitchenLoading(false);
    });
    return () => { cancelled = true; };
  }, [kitchenKey, prefsKey]);

  const rankedChip = useMemo(
    () => (categoryResults ? diversify(rankRecipes(categoryResults, chipSlot ? ctxFor(chipSlot) : ctx, { recent, todayKey }), 20) : null),
    [categoryResults, chipSlot, ctxFor, ctx, recent, todayKey],
  );

  // The top picks are remembered, so the same few are not at the top every day.
  const shownIds = homeMode ? [layout.hero, ...layout.picks].filter(Boolean).map((i) => i.id) : [];
  const shownKey = shownIds.join(',');
  useEffect(() => {
    if (booted && shownIds.length) recordPicks(uid, shownIds, todayKey);
  }, [booted, shownKey]);

  // ---- saving ----------------------------------------------------------------------------------------------------------------

  const saveStateOf = (item) => (savingIds[item.id] ? 'saving' : isSavedRecipe(savedRecipes, item) ? 'saved' : 'idle');

  const confirmRemove = (saved) => {
    Alert.alert('Remove Recipe', 'Remove this recipe from saved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeRecipe(saved.id, uid) },
    ]);
  };

  // The bookmark on a card: saves the recipe without opening it (its steps and ingredients are fetched for the save), or offers to
  // remove it when it is already saved.
  const toggleSave = async (item) => {
    const match = findSavedMatch(savedRecipes, item);
    if (match) {
      confirmRemove(match);
      return;
    }
    if (savingIds[item.id]) return;
    setSavingIds((cur) => ({ ...cur, [item.id]: true }));
    try {
      const detail = await recipeExtractionService.getSpoonacularById(item.id);
      if (!detail) {
        Alert.alert('Could not save', 'This recipe could not be loaded. Please try again.');
        return;
      }
      if ((await addRecipe(detail, uid)) === null) Alert.alert('Could not save', 'This recipe could not be saved. Please try again.');
    } catch (e) {
      Alert.alert('Could not save', 'This recipe could not be saved. Please try again.');
    } finally {
      setSavingIds((cur) => { const next = { ...cur }; delete next[item.id]; return next; });
    }
  };

  // ---- the page --------------------------------------------------------------------------------------------------------------

  const onRefresh = async () => {
    setRefreshing(true);
    forceRef.current = true;
    setRefreshTick((t) => t + 1);
    try {
      if (uid) await loadRecipes(uid);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const retry = () => {
    forceRef.current = true;
    setRefreshTick((t) => t + 1);
  };

  const openRecipe = (item) => setPreview({ id: item.id, plan: false });
  const toggleRow = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Search, a chip and "cook with what I have" are three ways of looking: starting one ends the others.
  const handleSearchSubmit = () => {
    setCat('All');
    setKitchenList([]);
    setSearchQuery(searchInput.trim());
  };
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };
  const handleCategoryPress = (category) => {
    setSearchInput('');
    setSearchQuery('');
    setKitchenList([]);
    setCat(category);
  };
  const handleKitchenSubmit = (list) => {
    setKitchenOpen(false);
    setSearchInput('');
    setSearchQuery('');
    setCat('All');
    setKitchenList(list);
  };

  const card = (item, extra = {}) => (
    <RecipeCard
      key={item.id}
      item={item}
      saveState={saveStateOf(item)}
      onPress={() => openRecipe(item)}
      onToggleSave={() => toggleSave(item)}
      {...extra}
    />
  );
  const grid = (list, extraFor) => (
    <View style={[s.gridWrap, { marginBottom: 24 }]}>
      {list.map((item) => card(item, { width: gridCardWidth, style: { marginRight: 0 }, ...(extraFor ? extraFor(item) : {}) }))}
    </View>
  );
  const rail = (list, marginBottom = 24) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom }}>
      {list.map((item) => card(item))}
    </ScrollView>
  );

  const renderRow = (title, key, marginBottom = 24) => {
    const list = rows[key];
    if (!list.length) return null;
    return (
      <>
        <SectionHeader title={title} onViewAll={() => toggleRow(key)} expanded={expanded[key]} />
        {expanded[key] ? grid(list) : rail(list, marginBottom)}
      </>
    );
  };

  const skeleton = (height, marginBottom = 24) => (
    <View style={{ paddingHorizontal: 20, marginBottom }}><LoadingSkeleton width="100%" height={height} borderRadius={16} /></View>
  );

  const rowsHaveAny = rows.postWorkout.length + rows.mealPrep.length + rows.quickEasy.length > 0;
  const homeEmpty = !homeLoading && !layout.hero && !rowsHaveAny;
  const diagnostic = recipeExtractionService.lastDiagnostic;
  const pickList = picksExpanded ? [...layout.picks, ...layout.more] : layout.picks;

  const kitchenLines = (item) => ({ lines: kitchenLine(item, kitchenList.length) });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <RecipeImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => uid && loadRecipes(uid)}
      />
      <RecipePreviewModal
        visible={!!preview}
        recipeId={preview?.id}
        planOnOpen={!!preview?.plan}
        onClose={() => setPreview(null)}
        onSaved={() => uid && loadRecipes(uid)}
        addRecipe={addRecipe}
        uid={uid}
        findSaved={(r) => findSavedMatch(savedRecipes, { id: r.sourceId, name: r.name })}
        onViewPlan={(date) => router.push({ pathname: '/nutrition/plan', params: { date } })}
      />
      {kitchenOpen ? (
        <KitchenSheet initial={kitchenList} onSubmit={handleKitchenSubmit} onClose={() => setKitchenOpen(false)} />
      ) : null}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <View style={s.pageTitleRow}>
          <Text style={s.pageTitleText}>Recipes</Text>
          <GroceryListButton />
        </View>

        {/* Each chip except All runs a real search. The four meals are sized for that meal and ranked for the person. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 16 }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`chip-${c}`} style={[s.catPill, cat === c && s.catPillActive]} onPress={() => handleCategoryPress(c)}>
              <Text style={[s.catPillText, cat === c && s.catPillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

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
            <Pressable testID="search-clear" onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </Pressable>
          ) : null}
        </View>

        <Pressable testID="kitchen-open" accessibilityRole="button" style={s.kitchenBtn} onPress={() => setKitchenOpen(true)}>
          <Ionicons name="basket-outline" size={17} color="#000" />
          <Text style={s.kitchenBtnText}>Cook with what I have</Text>
        </Pressable>

        {searching ? (
          <>
            <SectionHeader title={`Results for "${searchQuery}"`} />
            {searchLoading ? (
              skeleton(140)
            ) : !searchResults?.length ? (
              <Text style={[s.mutedText, { marginBottom: 24 }]}>No recipes found for that search.</Text>
            ) : grid(searchResults)}
          </>
        ) : kitchenActive ? (
          <>
            <View testID="kitchen-banner" style={s.kitchenBanner}>
              <Text style={s.kitchenBannerText} numberOfLines={2}>Made with {kitchenList.join(', ')}</Text>
              <Pressable testID="kitchen-edit" onPress={() => setKitchenOpen(true)} hitSlop={8}><Text style={s.viewAll}>Edit</Text></Pressable>
              <Pressable testID="kitchen-clear" onPress={() => setKitchenList([])} hitSlop={8}><Text style={s.viewAll}>Clear</Text></Pressable>
            </View>
            {kitchenLoading ? (
              skeleton(140)
            ) : !kitchenResults?.length ? (
              <Text testID="kitchen-empty" style={[s.mutedText, { marginBottom: 24 }]}>
                {kitchenList.length > 1 ? 'Nothing used all of those. Try taking one out.' : 'No recipes found for that.'}
              </Text>
            ) : grid(kitchenResults, kitchenLines)}
          </>
        ) : chipActive ? (
          <>
            <SectionHeader title={cat} />
            {chipSlot && rankedChip?.length ? <Text testID="chip-sizing-line" style={s.sizing}>{sizingLine(ctxFor(chipSlot))}</Text> : null}
            {categoryLoading ? (
              skeleton(140)
            ) : !rankedChip?.length ? (
              <Text style={[s.mutedText, { marginBottom: 24 }]}>Nothing to show right now.</Text>
            ) : grid(rankedChip)}
          </>
        ) : (
          <>
            {homeLoading && !layout.hero ? (
              <>
                {skeleton(300)}
                {skeleton(170)}
              </>
            ) : null}

            {homeEmpty ? (
              <View testID="home-empty" style={s.emptyBox}>
                <Text style={s.emptyTitle}>Nothing to show right now</Text>
                <Text style={s.emptyText}>Check your connection and try again.{diagnostic ? ` (${diagnostic})` : ''}</Text>
                <Pressable testID="home-retry" accessibilityRole="button" style={s.retryBtn} onPress={retry}>
                  <Text style={s.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {layout.hero ? (
              <HeroPick
                item={layout.hero}
                eyebrow={`Top pick for ${SLOT_NAME[ctx.slot]}`}
                saveState={saveStateOf(layout.hero)}
                onPress={() => openRecipe(layout.hero)}
                onToggleSave={() => toggleSave(layout.hero)}
                onPlan={() => setPreview({ id: layout.hero.id, plan: true })}
              />
            ) : null}

            {layout.picks.length ? (
              <>
                <SectionHeader
                  title="Picked for you"
                  onViewAll={layout.more.length ? () => setPicksExpanded((v) => !v) : undefined}
                  expanded={picksExpanded}
                  testID="picks-view-all"
                />
                <Text testID="sizing-line" style={s.sizing}>{sizingLine(ctx)}</Text>
                {picksExpanded ? grid(pickList) : rail(pickList)}
              </>
            ) : null}

            {savedRecipes && savedRecipes.length > 0 ? (
              <>
                <SectionHeader title="Saved Recipes" right={<Text style={s.savedCount}>{savedRecipes.length} saved</Text>} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 24 }}>
                  {savedRecipes.map((item) => (
                    <SavedCard
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/recipe/${item.id}`)}
                      onLongPress={() => confirmRemove(item)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {renderRow('Post-Workout', 'postWorkout')}
            {renderRow('Meal Prep', 'mealPrep')}
            {renderRow('Quick & Easy', 'quickEasy', 12)}
          </>
        )}

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
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  pageTitleText: { fontSize: 24, fontWeight: '800', color: '#000' },

  /* Category Pills */
  catPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  catPillActive: { backgroundColor: '#000' },
  catPillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  catPillTextActive: { color: '#FFF' },

  /* Search Bar */
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, color: '#000' },
  kitchenBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 20, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#000' },
  kitchenBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  kitchenBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F5F5F5' },
  kitchenBannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  viewAll: { fontSize: 14, fontWeight: '600', color: '#000' },
  savedCount: { fontSize: 12, color: '#999', backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sizing: { fontSize: 12, color: '#777', lineHeight: 17, paddingHorizontal: 20, marginTop: -4, marginBottom: 12 },
  mutedText: { fontSize: 12, color: '#999', paddingHorizontal: 20 },

  /* Grid (expanded "View All" state, search, chips, ingredient search) */
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, justifyContent: 'flex-start' },

  /* Saved Card */
  savedCard: { width: 180, marginRight: 14 },
  savedImage: { width: 180, height: 140, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  savedImagePhoto: { width: '100%', height: '100%' },
  bookmarkIcon: { position: 'absolute', top: 8, right: 8 },
  savedTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 8 },
  savedMetaText: { fontSize: 11, color: '#999', marginTop: 4 },

  /* Nothing to show */
  emptyBox: { marginHorizontal: 20, marginBottom: 24, padding: 20, borderRadius: 16, backgroundColor: '#F7F7F7', alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  emptyText: { fontSize: 13, color: '#777', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  retryBtn: { marginTop: 14, backgroundColor: '#000', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
  retryText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  /* Add Recipe */
  addRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', height: 52, borderRadius: 26 },
  addRecipeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

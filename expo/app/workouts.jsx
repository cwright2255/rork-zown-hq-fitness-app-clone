import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput,
  RefreshControl, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useExerciseStore } from '@/store/exerciseStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRecentExercisesStore } from '@/store/recentExercisesStore';
import { useUserStore } from '@/store/userStore';
import { useLifetimeStore } from '@/store/lifetimeStore';
import { lifetimeOf } from '@/lib/lifetimeTotals';
import { getGoalLabels, profileForWorkouts } from '@/lib/userProfileData';
import { getProfileFromStores } from '@/services/coachSnapshotService';
import { planRedirect } from '@/lib/upgradePrompt';
import { getFeaturedProgram } from '@/data/workoutPrograms';
import { titlesForPlan, titleForPlan, goalsFromPrompt } from '@/lib/workoutNames';
import { workoutsThisWeek } from '@/lib/workoutWeek';
import { dayHasExercises, workoutFromPlanDay, planDayWorkoutId } from '@/lib/planDayWorkout';
import { programProgress, progressLabel } from '@/lib/trainingProgramProgress';
import { bodyPartChoices, exercisesToShow, BROWSE_FILTERED_COUNT } from '@/lib/exerciseBrowse';

// The plan shows this many days until the person asks for all of them.
const PLAN_DAYS_SHOWN = 3;
// While someone is searching, the phone may fetch this many more pages of exercises (50 each) looking for a match, and no more: a
// search that matches nothing must not walk the whole library.
const SEARCH_EXTRA_PAGES = 5;

function SectionHeader({ title, onViewAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onViewAll && (
        <Pressable onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatBox({ value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function ExerciseCard({ item }) {
  const subtitle = [item.bodyParts?.[0], item.equipments?.[0]].filter(Boolean).join(' · ');
  return (
    <Pressable style={styles.featuredCard} onPress={() => router.push(`/exercise/${item.exerciseId}`)}>
      {item.gifUrl ? (
        <Image source={{ uri: item.gifUrl }} style={styles.featuredImage} resizeMode="cover" />
      ) : (
        <View style={styles.featuredImage}>
          <Ionicons name="barbell-outline" size={32} color="#999" />
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
    </Pressable>
  );
}

// The one card the My Workouts row and the Training Program row both use, so they cannot drift apart.
function WorkoutTile({ title, subtitle, details, onPress, testID }) {
  return (
    <Pressable style={styles.programCard} onPress={onPress} testID={testID}>
      <View style={styles.programImage}>
        <Ionicons name="clipboard-outline" size={28} color="#999" />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
      {(details || []).filter(Boolean).map((line) => (
        <Text key={line} style={styles.cardSubtitle} numberOfLines={1}>{line}</Text>
      ))}
    </Pressable>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress} testID={`chip-${label}`}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MyWorkoutCard({ item }) {
  const subtitle = [item.duration ? `${item.duration} min` : null, item.difficulty]
    .filter(Boolean).join(' · ');
  return (
    <WorkoutTile
      title={item.name}
      subtitle={subtitle}
      onPress={() => router.push(`/workout/${item.id}`)}
      testID={`workout-card-${item.id}`}
    />
  );
}

// A program's line under the name stays exactly as the program says it ("9 weeks • 3x/week"); its level goes on the line below,
// because the two together are too long for one line on a tile this wide. Once the person has finished a day, where they are in it
// ("Week 2 of 9") goes on the line after that.
function ProgramCard({ program, progress }) {
  return (
    <WorkoutTile
      title={program.title}
      subtitle={program.subtitle}
      details={[program.level, progress]}
      onPress={() => router.push(`/workout/program/${program.id}`)}
      testID="program-card"
    />
  );
}

export default function WorkoutsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);
  const [openingDay, setOpeningDay] = useState(null);
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState('all');
  const [searchPages, setSearchPages] = useState(0);
  const { user } = useUserStore();
  const {
    exercises, isLoading: isLoadingExercises, hasNextPage, loadExercises,
  } = useExerciseStore();
  const {
    workouts, completedWorkouts, loadWorkoutTemplates, getWorkoutStreak, addWorkout,
    workoutRecommendation, isLoadingRecommendation,
    loadWorkoutRecommendation, generateNewWorkoutRecommendation,
  } = useWorkoutStore();
  const recent = useRecentExercisesStore((s) => s.recent);

  useEffect(() => {
    if (exercises.length === 0) loadExercises(true);
  }, []);

  useEffect(() => {
    if (user?.uid) {
      loadWorkoutTemplates(user.uid);
      loadWorkoutRecommendation(user.uid);
    }
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadExercises(true),
        user?.uid ? loadWorkoutTemplates(user.uid) : Promise.resolve(),
        user?.uid ? loadWorkoutRecommendation(user.uid) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGetRecommendation = async () => {
    try {
      await generateNewWorkoutRecommendation({
        uid: user?.uid,
        fitnessLevel: user?.fitnessLevel,
        goals: getGoalLabels(user),
        profile: profileForWorkouts(getProfileFromStores(user)),
      });
    } catch (e) {
      // AI workout plans are part of Pro: a Free person is taken to the plans. Any other error is already logged in the
      // store; a real, visible failure state renders below via isLoadingRecommendation/workoutRecommendation.
      const toPlans = planRedirect(e);
      if (toPlans) router.push(toPlans);
    }
  };

  const streak = getWorkoutStreak();
  // Total Workouts is every workout ever saved (the server's count), not just the newest 240 the phone holds.
  const serverTotals = useLifetimeStore((s) => s.totals);
  const totalWorkouts = lifetimeOf({ held: completedWorkouts, server: serverTotals }).totalWorkouts;
  // This Week is the week as it runs, Monday to now (lib/workoutWeek.js), not the last seven days.
  const thisWeekCount = workoutsThisWeek(completedWorkouts);

  // Browse Exercises: the first ten as before, or what the person searched for, one body part, or what they opened lately (lib/exerciseBrowse.js).
  const activeChoice = choice === 'recent' && recent.length === 0 ? 'all' : choice;
  const shown = useMemo(
    () => exercisesToShow({ exercises, recent, query, choice: activeChoice }),
    [exercises, recent, query, activeChoice],
  );
  const searching = shown.filtering && activeChoice !== 'recent';
  const bodyParts = useMemo(() => {
    const list = bodyPartChoices(exercises);
    const picked = activeChoice.startsWith('bp:') ? activeChoice.slice(3) : '';
    if (picked && !list.some((b) => b.value === picked)) list.push({ value: picked, label: picked.replace(/\b\w/g, (c) => c.toUpperCase()) });
    return list;
  }, [exercises, activeChoice]);
  // The phone holds the exercises it has loaded, so a search that finds too few asks for the next page, a few times at most.
  useEffect(() => {
    if (!searching || shown.total >= BROWSE_FILTERED_COUNT) return;
    if (!hasNextPage || isLoadingExercises || searchPages >= SEARCH_EXTRA_PAGES) return;
    setSearchPages((n) => n + 1);
    loadExercises(false);
  }, [searching, shown.total, hasNextPage, isLoadingExercises, exercises.length, searchPages]);
  const stillSearching = searching && shown.total < BROWSE_FILTERED_COUNT && (isLoadingExercises || (hasNextPage && searchPages < SEARCH_EXTRA_PAGES));
  const planDays = workoutRecommendation?.structuredData?.days || [];
  // Made-up names from the list (lib/workoutNames.js), the same ones Quick Workout gives day one. The plan keeps the name it was made under:
  // its goals are read back from the request that made it, and only when that says nothing are the person's goals now used.
  const planSeed = workoutRecommendation?.id || '';
  const dayNames = titlesForPlan(planDays, { seed: planSeed });
  const planGoals = goalsFromPrompt(workoutRecommendation?.prompt);
  const planName = titleForPlan({ seed: planSeed, goals: planGoals.length > 0 ? planGoals : getGoalLabels(user) });
  const featuredProgram = getFeaturedProgram();
  // Where the person is in it, read from the program days they have finished (lib/trainingProgramProgress.js).
  const programLine = progressLabel(programProgress(featuredProgram, completedWorkouts));

  // All the plan's days when the person asks for them, three otherwise.
  const visibleDays = showAllDays ? planDays : planDays.slice(0, PLAN_DAYS_SHOWN);

  // Tapping a day saves it as a workout and opens it, as Quick Workout does with day one (lib/planDayWorkout.js). A day already saved
  // (it has one fixed id) is opened as it is, not saved again.
  const openPlanDay = async (index) => {
    const day = planDays[index];
    if (openingDay !== null || !dayHasExercises(day)) return;
    const id = planDayWorkoutId(planSeed, index);
    if (id && workouts.some((w) => String(w.id) === id)) {
      router.push(`/workout/${id}`);
      return;
    }
    setOpeningDay(index);
    try {
      const saved = await addWorkout(workoutFromPlanDay(day, {
        name: dayNames[index],
        difficulty: user?.fitnessLevel || 'intermediate',
        goalLabel: planGoals[0] || getGoalLabels(user)[0] || 'General Fitness',
        planId: planSeed,
        dayIndex: index,
      }), user?.uid);
      router.push(`/workout/${saved.id}`);
    } finally {
      setOpeningDay(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      >
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.pageTitle}>Workouts</Text>

        {/* The two main actions, first on the page. */}
        <View style={styles.actions}>
          <Pressable style={styles.createBtn} onPress={() => router.push('/workout/quick')}>
            <Ionicons name="flash" size={20} color="#FFF" />
            <Text style={styles.createBtnText}>Quick Workout</Text>
          </Pressable>

          <Pressable style={[styles.createBtn, styles.sessionBtn]} onPress={() => router.push('/workout/session')}>
            <Ionicons name="barbell" size={20} color="#000" />
            <Text style={[styles.createBtnText, styles.sessionBtnText]}>Today's Session</Text>
          </Pressable>
        </View>

        <SectionHeader title="Your Stats" />
        <View style={styles.statsRow}>
          <StatBox value={totalWorkouts} label="Total Workouts" />
          <StatBox value={streak.current} label="Day Streak" />
          <StatBox value={thisWeekCount} label="This Week" />
        </View>

        <SectionHeader title="Recommended For You" />
        <View style={styles.recCard}>
          {isLoadingRecommendation ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#000" />
              <Text style={styles.recLoadingText}>Building your plan…</Text>
            </View>
          ) : planDays.length > 0 ? (
            <View>
              <Text style={styles.recPlanName} testID="plan-name">{planName}</Text>
              <Text style={styles.recSubtitle}>Based on your recent workouts and goals</Text>
              {visibleDays.map((day, i) => {
                const last = i === visibleDays.length - 1;
                const tappable = dayHasExercises(day);
                const rowStyle = [styles.recDayRow, last && { borderBottomWidth: 0 }];
                const content = (
                  <>
                    <Text style={styles.recDayLabel}>{day.day}</Text>
                    <View style={styles.recDayName}>
                      <Text style={styles.recDayTitle} numberOfLines={1} testID={`plan-day-name-${i}`}>{dayNames[i]}</Text>
                      {!!day.focus && <Text style={styles.recDayFocus} numberOfLines={1}>{day.focus}</Text>}
                    </View>
                    <View style={styles.recChevron}>
                      {tappable && (openingDay === i
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Ionicons name="chevron-forward" size={16} color="#999" />)}
                    </View>
                  </>
                );
                return tappable ? (
                  <Pressable key={i} style={rowStyle} onPress={() => openPlanDay(i)} disabled={openingDay !== null} testID={`plan-day-${i}`}>
                    {content}
                  </Pressable>
                ) : (
                  <View key={i} style={rowStyle} testID={`plan-day-${i}`}>{content}</View>
                );
              })}
              {planDays.length > PLAN_DAYS_SHOWN && (
                <Pressable style={styles.recToggle} onPress={() => setShowAllDays((v) => !v)} testID="plan-toggle">
                  <Text style={styles.recToggleText}>{showAllDays ? 'Show fewer days' : `Show all ${planDays.length} days`}</Text>
                </Pressable>
              )}
              <Pressable style={styles.recBtn} onPress={handleGetRecommendation}>
                <Text style={styles.recBtnText}>Refresh Plan</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.recSubtitle}>
                Get a personalized 7-day plan built from your real workout history and goals.
              </Text>
              <Pressable style={styles.recBtn} onPress={handleGetRecommendation}>
                <Text style={styles.recBtnText}>Get Recommendation</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Training Program -- real content from data/workoutPrograms.js.
            getFeaturedProgram() deterministically rotates which program
            is shown here based on the current date (9-week rotation,
            the midpoint of the requested 8-10 week range) - every
            device computes the same program for the same day with no
            server or stored state needed, and it keeps advancing on its
            own. It is the same tile as the My Workouts cards (WorkoutTile)
            and, like them, navigates to the real program overview screen
            (app/workout/program/[id].jsx) with its own Program -> Week
            -> Day -> Start Session flow. */}
        <SectionHeader title="Training Program" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          <ProgramCard program={featuredProgram} progress={programLine} />
        </ScrollView>

        <SectionHeader title="My Workouts" />
        {workouts.length === 0 ? (
          <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
            <EmptyState
              icon="Dumbbell"
              title="No workouts yet"
              subtitle="Get a real workout built for you in seconds"
              buttonText="Quick Workout"
              onPress={() => router.push('/workout/quick')}
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {workouts.map((item) => (
              <MyWorkoutCard key={item.id} item={item} />
            ))}
          </ScrollView>
        )}

        <SectionHeader
          title="Browse Exercises"
          onViewAll={() => router.push('/exercise')}
        />
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor="#999"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            testID="exercise-search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} testID="exercise-search-clear">
              <Ionicons name="close-circle" size={18} color="#BBB" />
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          <Chip label="All" active={activeChoice === 'all'} onPress={() => setChoice('all')} />
          {recent.length > 0 && (
            <Chip label="Recent" active={activeChoice === 'recent'} onPress={() => setChoice('recent')} />
          )}
          {bodyParts.map((bp) => (
            <Chip
              key={bp.value}
              label={bp.label}
              active={activeChoice === `bp:${bp.value}`}
              onPress={() => setChoice(activeChoice === `bp:${bp.value}` ? 'all' : `bp:${bp.value}`)}
            />
          ))}
        </ScrollView>
        {isLoadingExercises && exercises.length === 0 && activeChoice !== 'recent' ? (
          <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
            <LoadingSkeleton width="100%" height={150} borderRadius={12} style={{ marginBottom: 12 }} />
          </View>
        ) : exercises.length === 0 && activeChoice !== 'recent' ? (
          <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
            <EmptyState
              icon="Dumbbell"
              title="Couldn't load exercises"
              subtitle="Pull down to refresh and try again"
              buttonText="Retry"
              onPress={() => loadExercises(true)}
            />
          </View>
        ) : shown.items.length === 0 ? (
          <View style={styles.noResults}>
            {stillSearching && <ActivityIndicator color="#000" style={{ marginBottom: 6 }} />}
            <Text style={styles.noResultsText} testID="exercise-no-results">
              {stillSearching ? 'Searching more exercises…' : 'No exercises match. Try another word, or View All.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            keyboardShouldPersistTaps="handled"
          >
            {shown.items.map((item) => (
              <ExerciseCard key={item.exerciseId} item={item} />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  logoRow: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  logo: { width: 120, height: 36 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#000', marginBottom: 20, paddingHorizontal: 20 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  viewAll: { fontSize: 13, color: '#666', fontWeight: '600' },

  actions: { marginBottom: 24 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  statBox: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  statBoxValue: { fontSize: 17, fontWeight: '800', color: '#000' },
  statBoxLabel: { fontSize: 11, color: '#999', marginTop: 2, textAlign: 'center' },

  recCard: {
    marginHorizontal: 20, marginBottom: 24, backgroundColor: '#F5F5F5',
    borderRadius: 16, padding: 16,
  },
  recSubtitle: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 14 },
  recLoadingText: { fontSize: 13, color: '#999', marginTop: 8 },
  recDayRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#E5E5E5',
  },
  recDayLabel: { fontSize: 13, fontWeight: '700', color: '#000', width: 90 },
  recPlanName: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 2 },
  recDayName: { flex: 1, alignItems: 'flex-end' },
  recDayTitle: { fontSize: 14, fontWeight: '700', color: '#000', textAlign: 'right' },
  recDayFocus: { fontSize: 12, color: '#666', textAlign: 'right' },
  recChevron: { width: 20, marginLeft: 8, alignSelf: 'center', alignItems: 'center' },
  recToggle: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  recToggleText: { fontSize: 13, fontWeight: '600', color: '#666' },
  recBtn: {
    marginTop: 14, backgroundColor: '#000', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  recBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 40,
    marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 12,
    backgroundColor: '#F5F5F5', borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#000', paddingVertical: 0 },
  chipRow: { paddingLeft: 20, paddingRight: 6, gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F0F0F0' },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  chipTextActive: { color: '#FFF' },
  noResults: { paddingHorizontal: 20, marginBottom: 24, alignItems: 'center' },
  noResultsText: { fontSize: 13, color: '#999', textAlign: 'center' },

  carousel: { paddingLeft: 20, paddingRight: 6, marginBottom: 24 },

  featuredCard: { width: 200, marginRight: 14 },
  featuredImage: {
    height: 120, borderRadius: 14, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },

  programCard: { width: 160, marginRight: 14 },
  programImage: {
    height: 100, borderRadius: 14, backgroundColor: '#E8E8E8',
    justifyContent: 'center', alignItems: 'center',
  },

  cardTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 8 },
  cardSubtitle: { fontSize: 12, color: '#999', marginTop: 2 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 14,
    marginHorizontal: 20, marginTop: 4,
  },
  createBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  sessionBtn: { backgroundColor: '#F0F0F0', marginTop: 10 },
  sessionBtnText: { color: '#000' },
});

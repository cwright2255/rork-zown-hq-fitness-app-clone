import EmptyState from '@/src/components/EmptyState';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
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
import { COMMUNITY_CATEGORIES } from '@/data/communityWorkouts';
import {
  communityWorkoutsFor, communityWorkoutMinutes, levelLabel, workoutFromCommunity, communityWorkoutId,
} from '@/lib/communityWorkouts';

// The plan shows this many days until the person asks for all of them.
const PLAN_DAYS_SHOWN = 3;

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

// The one card the My Workouts row, the Training Program row and the Community Workouts row all use, so they cannot drift apart.
// `busy` dims it while the workout it opens is being saved.
function WorkoutTile({ title, subtitle, details, onPress, testID, busy }) {
  return (
    <Pressable style={[styles.programCard, busy && styles.tileBusy]} onPress={onPress} testID={testID}>
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

// A pre-made workout (data/communityWorkouts.js): its length and level on the line under the name, then how many exercises and what it needs.
function CommunityCard({ workout, onPress, busy }) {
  return (
    <WorkoutTile
      title={workout.name}
      subtitle={`${communityWorkoutMinutes(workout)} min · ${levelLabel(workout.difficulty)}`}
      details={[`${workout.exercises.length} exercises`, workout.equipment]}
      onPress={onPress}
      testID={`community-card-${workout.slug}`}
      busy={busy}
    />
  );
}

export default function WorkoutsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);
  const [openingDay, setOpeningDay] = useState(null);
  const [communityChoice, setCommunityChoice] = useState('All');
  const [openingCommunity, setOpeningCommunity] = useState(null);
  const { user } = useUserStore();
  const {
    workouts, completedWorkouts, loadWorkoutTemplates, getWorkoutStreak, addWorkout,
    workoutRecommendation, isLoadingRecommendation,
    loadWorkoutRecommendation, generateNewWorkoutRecommendation,
  } = useWorkoutStore();

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

  const communityShown = communityWorkoutsFor(communityChoice);
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

  // Tapping a community workout saves it to My Workouts and opens it, the same way (lib/communityWorkouts.js). One already saved (it has one
  // fixed id) is opened as it is, not saved again.
  const openCommunityWorkout = async (community) => {
    if (openingCommunity !== null) return;
    const id = communityWorkoutId(community.slug);
    if (workouts.some((w) => String(w.id) === id)) {
      router.push(`/workout/${id}`);
      return;
    }
    setOpeningCommunity(community.slug);
    try {
      const saved = await addWorkout(workoutFromCommunity(community), user?.uid);
      router.push(`/workout/${saved.id}`);
    } finally {
      setOpeningCommunity(null);
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

        {/* Community Workouts -- ready-made workouts from data/communityWorkouts.js, in the same card as My Workouts. A tap saves one to
            My Workouts and opens it (lib/communityWorkouts.js), as a day of the plan above does. */}
        <SectionHeader title="Community Workouts" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {['All', ...COMMUNITY_CATEGORIES].map((label) => (
            <Chip key={label} label={label} active={communityChoice === label} onPress={() => setCommunityChoice(label)} />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          testID="community-row"
        >
          {communityShown.map((item) => (
            <CommunityCard
              key={item.slug}
              workout={item}
              busy={openingCommunity === item.slug}
              onPress={() => openCommunityWorkout(item)}
            />
          ))}
        </ScrollView>

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

        {/* The movements themselves (the exercise library) are one tap away, at the bottom. */}
        <Pressable style={styles.moreLink} onPress={() => router.push('/exercise')} hitSlop={8} testID="browse-movements">
          <Text style={styles.moreLinkText}>Browse all movements</Text>
          <Ionicons name="chevron-forward" size={14} color="#666" />
        </Pressable>
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

  chipRow: { paddingLeft: 20, paddingRight: 6, gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F0F0F0' },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  chipTextActive: { color: '#FFF' },

  carousel: { paddingLeft: 20, paddingRight: 6, marginBottom: 24 },

  programCard: { width: 160, marginRight: 14 },
  tileBusy: { opacity: 0.5 },
  programImage: {
    height: 100, borderRadius: 14, backgroundColor: '#E8E8E8',
    justifyContent: 'center', alignItems: 'center',
  },

  moreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, marginBottom: 8 },
  moreLinkText: { fontSize: 13, fontWeight: '600', color: '#666' },

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

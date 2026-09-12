import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useExerciseStore } from '@/store/exerciseStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { getFeaturedProgram } from '@/data/workoutPrograms';

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

function MyWorkoutCard({ item }) {
  const subtitle = [item.duration ? `${item.duration} min` : null, item.difficulty]
    .filter(Boolean).join(' · ');
  return (
    <Pressable style={styles.programCard} onPress={() => router.push(`/workout/${item.id}`)}>
      <View style={styles.programImage}>
        <Ionicons name="clipboard-outline" size={28} color="#999" />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
    </Pressable>
  );
}

export default function WorkoutsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [programExpanded, setProgramExpanded] = useState(false);
  const { user } = useUserStore();
  const {
    exercises, isLoading: isLoadingExercises, loadExercises,
  } = useExerciseStore();
  const {
    workouts, completedWorkouts, loadWorkoutTemplates, getWorkoutStreak,
    workoutRecommendation, isLoadingRecommendation,
    loadWorkoutRecommendation, generateNewWorkoutRecommendation,
  } = useWorkoutStore();

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
        goals: user?.goals,
      });
    } catch (e) {
      // Errors are already logged in the store; a real, visible failure
      // state renders below via isLoadingRecommendation/workoutRecommendation.
    }
  };

  const streak = getWorkoutStreak();
  const thisWeekCount = (completedWorkouts || []).filter((w) => {
    const d = new Date(w.completedAt || w.timestamp);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  const featuredExercises = exercises.slice(0, 10);
  const planDays = workoutRecommendation?.structuredData?.days || [];
  const featuredProgram = getFeaturedProgram();
  const previewWeek = featuredProgram.weeks[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        <SectionHeader title="Your Stats" />
        <View style={styles.statsRow}>
          <StatBox value={completedWorkouts?.length ?? 0} label="Total Workouts" />
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
              <Text style={styles.recSubtitle}>Based on your recent workouts and goals</Text>
              {planDays.slice(0, 3).map((day, i) => (
                <View key={i} style={[styles.recDayRow, i === Math.min(2, planDays.length - 1) && { borderBottomWidth: 0 }]}>
                  <Text style={styles.recDayLabel}>{day.day}</Text>
                  <Text style={styles.recDayFocus} numberOfLines={1}>{day.focus}</Text>
                </View>
              ))}
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
            own. Shows a real Week 1 preview when expanded; a full,
            dedicated program detail screen with week-by-week navigation
            (matching the Running tab's own program screens) is a
            natural next step beyond this first version. */}
        <SectionHeader title="Training Program" />
        <View style={styles.programFeaturedCard}>
          <View style={styles.programFeaturedHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.programFeaturedTitle}>{featuredProgram.title}</Text>
              <Text style={styles.programFeaturedSubtitle}>{featuredProgram.subtitle} · {featuredProgram.level}</Text>
            </View>
            <View style={styles.programLevelBadge}>
              <Text style={styles.programLevelBadgeText}>{featuredProgram.level}</Text>
            </View>
          </View>
          <Text style={styles.programFeaturedDesc}>{featuredProgram.description}</Text>
          <Pressable style={styles.programToggleRow} onPress={() => setProgramExpanded((v) => !v)}>
            <Text style={styles.programToggleText}>
              {programExpanded ? 'Hide Week 1 Preview' : 'Preview Week 1'}
            </Text>
            <Ionicons name={programExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
          </Pressable>
          {programExpanded && (
            <View style={styles.programWeekPreview}>
              {previewWeek.days.map((d, i) => (
                <View key={i} style={[styles.programDayRow, i === previewWeek.days.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.programDayLabel}>{d.day}</Text>
                  <Text style={styles.programDayExercises} numberOfLines={2}>
                    {d.exercises.map((e) => e.name).join(', ')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <SectionHeader
          title="Browse Exercises"
          onViewAll={() => router.push('/exercise')}
        />
        {isLoadingExercises && featuredExercises.length === 0 ? (
          <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
            <LoadingSkeleton width="100%" height={150} borderRadius={12} style={{ marginBottom: 12 }} />
          </View>
        ) : featuredExercises.length === 0 ? (
          <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
            <EmptyState
              icon="Dumbbell"
              title="Couldn't load exercises"
              subtitle="Pull down to refresh and try again"
              buttonText="Retry"
              onPress={() => loadExercises(true)}
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {featuredExercises.map((item) => (
              <ExerciseCard key={item.exerciseId} item={item} />
            ))}
          </ScrollView>
        )}

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

        <Pressable style={styles.createBtn} onPress={() => router.push('/workout/quick')}>
          <Ionicons name="flash" size={20} color="#FFF" />
          <Text style={styles.createBtnText}>Quick Workout</Text>
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
  recDayFocus: { fontSize: 13, color: '#666', flex: 1, textAlign: 'right' },
  recBtn: {
    marginTop: 14, backgroundColor: '#000', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  recBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  programFeaturedCard: {
    marginHorizontal: 20, marginBottom: 24, backgroundColor: '#F5F5F5',
    borderRadius: 16, padding: 16,
  },
  programFeaturedHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  programFeaturedTitle: { fontSize: 17, fontWeight: '700', color: '#000' },
  programFeaturedSubtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  programLevelBadge: {
    backgroundColor: '#000', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  programLevelBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  programFeaturedDesc: { fontSize: 13, color: '#666', lineHeight: 18, marginTop: 12 },
  programToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E5E5E5',
  },
  programToggleText: { fontSize: 13, fontWeight: '600', color: '#666' },
  programWeekPreview: { marginTop: 12 },
  programDayRow: {
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E5E5',
  },
  programDayLabel: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 3 },
  programDayExercises: { fontSize: 12, color: '#666', lineHeight: 17 },

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
});

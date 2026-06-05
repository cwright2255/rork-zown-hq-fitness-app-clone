import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchExercises } from '@/services/exerciseDbService';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{error?.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/* ── Static placeholder data ── */

const FEATURED_WORKOUTS = [
  { id: '1', title: 'Full Body HIIT', subtitle: '30 min \u2022 Intermediate' },
  { id: '2', title: 'Upper Body Strength', subtitle: '45 min \u2022 Advanced' },
  { id: '3', title: 'Core Crusher', subtitle: '20 min \u2022 Beginner' },
  { id: '4', title: 'Leg Day', subtitle: '40 min \u2022 Intermediate' },
  { id: '5', title: 'Cardio Blast', subtitle: '25 min \u2022 Beginner' },
];

const PROGRAMS = [
  { id: '1', title: '12-Week Shred', subtitle: '12 weeks \u2022 4x/week' },
  { id: '2', title: 'Beginner Basics', subtitle: '8 weeks \u2022 3x/week' },
  { id: '3', title: 'Marathon Prep', subtitle: '16 weeks \u2022 5x/week' },
  { id: '4', title: 'Yoga Flow', subtitle: '6 weeks \u2022 4x/week' },
  { id: '5', title: 'Strength Builder', subtitle: '10 weeks \u2022 4x/week' },
];

const YOUTUBE_WORKOUTS = [
  { id: '1', channel: 'JEFIT', title: '15 Min Full Body No Equipment', duration: '15:32' },
  { id: '2', channel: 'Blogilates', title: 'Ab Workout for Beginners', duration: '12:45' },
  { id: '3', channel: 'MadFit', title: 'Intense HIIT Cardio', duration: '22:10' },
  { id: '4', channel: 'Athlean-X', title: 'Perfect Push-Up Workout', duration: '18:03' },
  { id: '5', channel: 'Pamela Reif', title: '20 Min Full Body Stretch', duration: '20:00' },
];

/* ── Section header ── */

function SectionHeader({ title, onViewAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onViewAll}>
        <Text style={styles.viewAll}>View All</Text>
      </Pressable>
    </View>
  );
}

/* ── Cards ── */

function FeaturedCard({ item }) {
  return (
    <Pressable
      style={styles.featuredCard}
      onPress={() => router.push(`/workout/${item.id}`)}
    >
      <View style={styles.featuredImage}>
        <Ionicons name="barbell-outline" size={32} color="#999" />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

function ProgramCard({ item }) {
  return (
    <Pressable
      style={styles.programCard}
      onPress={() => {
        // TODO: navigate to program detail when route exists
        router.push(`/workout/${item.id}`);
      }}
    >
      <View style={styles.programImage}>
        <Ionicons name="calendar-outline" size={28} color="#999" />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

function YouTubeCard({ item }) {
  return (
    <Pressable
      style={styles.youtubeCard}
      onPress={() => {
        // TODO: open YouTube link or in-app player
      }}
    >
      <View style={styles.youtubeThumbnail}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={20} color="#FFF" />
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>
      </View>
      <Text style={styles.channelName}>{item.channel}</Text>
      <Text style={styles.cardTitle}>{item.title}</Text>
    </Pressable>
  );
}

/* ── Main screen ── */

export default function WorkoutsScreen() {
  const [apiExercises, setApiExercises] = useState([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadExercises = async () => {
      try {
        const result = await fetchExercises({ limit: 10 });
        const exercises = result?.data || result || [];
        if (mounted && Array.isArray(exercises)) {
          setApiExercises(exercises.map(e => ({
            id: e.id || e.exerciseId,
            title: e.name || 'Exercise',
            subtitle: (e.bodyPart || '') + (e.equipment ? ' \u00B7 ' + e.equipment : ''),
            gifUrl: e.gifUrl || null,
            bodyPart: e.bodyPart || '',
            target: e.target || '',
          })));
        }
      } catch (e) {
        console.warn('ExerciseDB fetch failed:', e?.message);
      } finally {
        if (mounted) setIsLoadingExercises(false);
      }
    };
    loadExercises();
    return () => { mounted = false; };
  }, []);

  const displayWorkouts = apiExercises.length > 0 ? apiExercises : FEATURED_WORKOUTS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Zown logo */}
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Page title */}
        <Text style={styles.pageTitle}>Workouts</Text>

        {/* Carousel 1 - Featured Workouts */}
        <SectionHeader
          title="Featured Workouts"
          onViewAll={() => {
            // TODO: navigate to filtered workouts list
            router.push('/workouts');
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {displayWorkouts.map((item) => (
            <FeaturedCard key={item.id} item={item} />
          ))}
        </ScrollView>

        {/* Carousel 2 - Programs */}
        <SectionHeader
          title="Programs"
          onViewAll={() => {
            // TODO: navigate to programs list
            router.push('/workouts');
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {PROGRAMS.map((item) => (
            <ProgramCard key={item.id} item={item} />
          ))}
        </ScrollView>

        {/* Carousel 3 - YouTube Workouts */}
        <SectionHeader
          title="YouTube Workouts"
          onViewAll={() => {
            // TODO: navigate to YouTube workouts list
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {YOUTUBE_WORKOUTS.map((item) => (
            <YouTubeCard key={item.id} item={item} />
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  logoRow: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  logo: {
    width: 120,
    height: 36,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    marginBottom: 20,
    paddingHorizontal: 20,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  viewAll: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },

  /* Carousel */
  carousel: {
    paddingLeft: 20,
    paddingRight: 6,
    marginBottom: 24,
  },

  /* Featured cards */
  featuredCard: {
    width: 200,
    marginRight: 14,
  },
  featuredImage: {
    height: 120,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Program cards */
  programCard: {
    width: 160,
    marginRight: 14,
  },
  programImage: {
    height: 100,
    borderRadius: 14,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* YouTube cards */
  youtubeCard: {
    width: 220,
    marginRight: 14,
  },
  youtubeThumbnail: {
    height: 130,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },

  /* Shared card text */
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  channelName: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
  },
});

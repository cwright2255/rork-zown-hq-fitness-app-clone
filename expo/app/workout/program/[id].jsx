// app/workout/program/[id].jsx
//
// Program overview for a workout program from data/workoutPrograms.js -
// modeled directly on app/running/[id].jsx (the exact same role for
// running programs), completing the same Program -> Week -> Day ->
// Start Session flow for strength programs. No progress-tracking or
// "Continue Program" shortcut yet (running's own version has one,
// backed by store/runningStore.js's programProgress) - this first
// version is the browsing/preview structure itself; per-user progress
// tracking would be a natural next addition on top of this.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProgram } from '@/data/workoutPrograms';

function WeekRow({ item, onPress }) {
  return (
    <Pressable style={styles.weekRow} onPress={onPress}>
      <View style={styles.weekCircle}>
        <Text style={styles.weekNum}>{item.week}</Text>
      </View>
      <View style={styles.weekInfo}>
        <Text style={styles.weekTitle}>Week {item.week}: {item.title}</Text>
        <Text style={styles.weekDesc}>{item.dayCount} day{item.dayCount === 1 ? '' : 's'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

export default function WorkoutProgramOverviewScreen() {
  const params = useLocalSearchParams();
  const programId = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();

  const program = getProgram(programId);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/workouts');
    }
  };

  if (!program) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Program not found.</Text>
        </View>
      </View>
    );
  }

  const weekRows = program.weeks.map((w) => ({
    week: w.week,
    title: w.title,
    dayCount: w.days.length,
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Ionicons name="barbell-outline" size={60} color="#999" />

          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#000" />
          </Pressable>

          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{program.title}</Text>
            <Text style={styles.heroDesc}>{program.subtitle}</Text>
            <View style={styles.overlayBottomRow}>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>{program.level.toUpperCase()}</Text>
              </View>
              <Text style={styles.categoryLabel}>Training Program</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Details</Text>
          <Text style={styles.descriptionText}>{program.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Plan</Text>
          {weekRows.map((item) => (
            <WeekRow
              key={item.week}
              item={item}
              onPress={() => router.push(`/workout/program/week/${programId}-w${item.week}`)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 14, color: '#999' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  hero: {
    height: 220,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  overlayBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  difficultyBadge: { backgroundColor: '#E8873A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  difficultyText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  categoryLabel: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  backBtn: {
    position: 'absolute', top: 50, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },

  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  descriptionText: { fontSize: 14, color: '#444', lineHeight: 22, marginTop: 8 },

  weekRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  weekCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },
  weekNum: { fontSize: 14, fontWeight: '700', color: '#000' },
  weekInfo: { flex: 1, marginLeft: 12 },
  weekTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  weekDesc: { fontSize: 12, color: '#999', marginTop: 2 },
});

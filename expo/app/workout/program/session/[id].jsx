// app/workout/program/session/[id].jsx
//
// Preview + launch screen for one specific day within a workout program
// (e.g. "Full Body Foundations, Week 3, Day A"). Modeled directly on
// app/running/session/[id].jsx - same role, same bottom-bar "Start
// Session" pattern. Route id is a composite
// "${programId}-w${weekNumber}-d${dayIndex}" string, matching the same
// convention already used for running program routes.
//
// Start Session launches app/workout/active.jsx with programId/week/
// dayIndex params - see that file's own handling of these (added
// alongside this screen) for how it loads this day's real exercises
// instead of a saved workout template.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { getProgram, getProgramWeek } from '@/data/workoutPrograms';

export default function WorkoutProgramSessionDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const match = rawId.match(/^(.+)-w(\d+)-d(\d+)$/);
  const programId = match?.[1] || '';
  const weekNumber = match?.[2] ? parseInt(match[2], 10) : null;
  const dayIndex = match?.[3] ? parseInt(match[3], 10) : null;

  const program = getProgram(programId);
  const week = weekNumber != null ? getProgramWeek(programId, weekNumber) : null;
  const day = dayIndex != null ? week?.days[dayIndex] : null;

  const handleStart = () => {
    router.push({
      pathname: '/workout/active',
      params: {
        programId, week: String(weekNumber), dayIndex: String(dayIndex),
      },
    });
  };

  if (!program || !week || !day) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack title="Session" variant="light" />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Session not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader showBack title={`${program.title} - Week ${weekNumber}`} variant="light" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.dayTitle}>{day.day}</Text>
        <Text style={styles.sessionMeta}>
          {day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Exercise Plan</Text>
          {day.exercises.map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <Text style={styles.exerciseText}>{ex.name}</Text>
              <Text style={styles.exerciseSets}>{ex.sets} x {ex.reps}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="Start Session" onPress={handleStart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#999', fontSize: 14 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  dayTitle: { color: '#000', fontSize: 20, fontWeight: '700' },
  sessionMeta: { color: '#999', fontSize: 13, marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16,
  },
  cardLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
    color: '#999', marginBottom: 10,
  },
  exerciseRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  exerciseText: { flex: 1, color: '#000', fontSize: 14, fontWeight: '600' },
  exerciseSets: { color: '#999', fontSize: 13 },
  // Real, checked: app/_layout.jsx's nav-bar visibility check excludes
  // EVERY path under /workout/ (unlike /running/, which only excludes
  // single-segment paths) - so the bottom nav bar never shows on this
  // screen, and bottom: 24 (not 100) is the correct value here.
  // Verified this directly against the real regex rather than assuming
  // it matched the /running/session/[id].jsx situation, since that one
  // genuinely is different (nav bar visible there, not here).
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

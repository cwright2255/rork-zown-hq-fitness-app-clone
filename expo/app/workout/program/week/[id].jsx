// app/workout/program/week/[id].jsx
//
// Shows the real days within one specific week of a workout program,
// each tappable through to the day/session detail screen. Modeled
// directly on app/running/week/[id].jsx - same composite route id
// convention ("${programId}-w${weekNumber}"), same day-row structure.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import { getProgram, getProgramWeek } from '@/data/workoutPrograms';

export default function WorkoutProgramWeekDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const match = rawId.match(/^(.+)-w(\d+)$/);
  const programId = match?.[1] || '';
  const weekNumber = match?.[2] ? parseInt(match[2], 10) : null;

  const program = getProgram(programId);
  const week = weekNumber != null ? getProgramWeek(programId, weekNumber) : null;

  if (!program || !week) {
    return (
      <View style={styles.container}>
        <ScreenHeader showBack title="Week" variant="light" />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Week not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader showBack title={`Week ${weekNumber}: ${week.title}`} variant="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {week.days.map((day, dayIndex) => (
          <Pressable
            key={dayIndex}
            style={styles.dayRow}
            onPress={() => router.push(`/workout/program/session/${programId}-w${weekNumber}-d${dayIndex}`)}
          >
            <View style={styles.dayCircle}>
              <Text style={styles.dayNum}>{dayIndex + 1}</Text>
            </View>
            <View style={styles.dayInfo}>
              <Text style={styles.dayTitle}>{day.day}</Text>
              <Text style={styles.dayDesc}>
                {day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 14, color: '#999' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  dayCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E5E5',
    justifyContent: 'center', alignItems: 'center',
  },
  dayNum: { fontSize: 15, fontWeight: '700', color: '#000' },
  dayInfo: { flex: 1 },
  dayTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  dayDesc: { fontSize: 12, color: '#999', marginTop: 2 },
});

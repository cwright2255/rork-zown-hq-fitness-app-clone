// app/running/week/[id].jsx
//
// New screen, filling a real gap in the navigation hierarchy: previously
// tapping a week on the program preview (app/running/[id].jsx) did
// nothing at all - weeks were static display rows, not a real
// navigation step. This shows the real sessions/days within one
// specific week, each tappable through to the real session detail
// screen (app/running/session/[id].jsx) - completing the intended
// Program -> Week -> Day -> Start Run flow.
//
// Route id is a composite "${programId}-w${weekNumber}" string, matching
// the same convention already used for session ids elsewhere in this
// feature (e.g. "c25k-w1-s0").
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import { useRunningStore } from '@/store/runningStore';
import { getProgram, getProgramWeek, getSessionIntervals } from '@/data/runningPrograms';

function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function WeekDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const match = rawId.match(/^(.+)-w(\d+)$/);
  const programId = match?.[1] || '';
  const weekNumber = match?.[2] ? parseInt(match[2], 10) : null;

  const { programProgress } = useRunningStore();
  const program = getProgram(programId);
  const week = weekNumber != null ? getProgramWeek(programId, weekNumber) : null;
  const progress = programProgress[programId];
  const completedIndexes = (progress?.currentWeek === weekNumber && progress?.completedSessionIndexes) || [];

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

  const sessions = Array.from({ length: week.sessionsPerWeek || 1 }, (_, i) => i);

  return (
    <View style={styles.container}>
      <ScreenHeader showBack title={`Week ${weekNumber}: ${week.title}`} variant="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sessions.map((sessionIndex) => {
          const intervals = getSessionIntervals(programId, weekNumber, sessionIndex);
          const totalSeconds = intervals ? intervals.reduce((s, iv) => s + iv.seconds, 0) : 0;
          const runSeconds = intervals
            ? intervals.filter((iv) => iv.type === 'run').reduce((s, iv) => s + iv.seconds, 0)
            : 0;
          const isDone = completedIndexes.includes(sessionIndex);

          return (
            <Pressable
              key={sessionIndex}
              style={styles.dayRow}
              onPress={() => router.push({
                pathname: '/running/session/[id]',
                params: {
                  id: `${programId}-w${weekNumber}-s${sessionIndex}`,
                  programId, week: String(weekNumber), sessionIndex: String(sessionIndex),
                },
              })}
            >
              <View style={[styles.dayCircle, isDone && styles.dayCircleDone]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                ) : (
                  <Text style={styles.dayNum}>{sessionIndex + 1}</Text>
                )}
              </View>
              <View style={styles.dayInfo}>
                <Text style={styles.dayTitle}>Day {sessionIndex + 1}</Text>
                <Text style={styles.dayDesc}>
                  {formatMinSec(totalSeconds)} total{runSeconds > 0 ? `, ${formatMinSec(runSeconds)} running` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </Pressable>
          );
        })}
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
  dayCircleDone: { backgroundColor: '#22C55E' },
  dayNum: { fontSize: 15, fontWeight: '700', color: '#000' },
  dayInfo: { flex: 1 },
  dayTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  dayDesc: { fontSize: 12, color: '#999', marginTop: 2 },
});

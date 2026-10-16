// app/profile/streak.jsx
//
// Profile > Streak Calendar. The last 30 days with a workout, a run or a hike coloured in, and the streak worked out
// from those same records (services/streakService.js). It shows only what the records say: no rewards, no XP.
// It replaces the old Progress screen, which nothing opened and which made up streak rewards and XP figures.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StreakCalendar from '@/components/StreakCalendar';
import { useActivityDays, useActivityStreak } from '@/services/streakService';
import { localDateKey, shiftDateKey } from '@/lib/localDate';

const WINDOW_DAYS = 30; // what StreakCalendar draws

export default function StreakCalendarScreen() {
  const days = useActivityDays();
  const { current, longest } = useActivityStreak();
  const today = localDateKey();
  const first = shiftDateKey(today, -(WINDOW_DAYS - 1));
  const activeInWindow = days.filter((day) => day >= first && day <= today).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Streak Calendar</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last {WINDOW_DAYS} days</Text>
          <StreakCalendar compact={false} days={days} />
          <Text style={styles.caption} testID="streak-calendar-caption">
            {days.length === 0
              ? 'Nothing logged yet. Finish a workout, a run or a hike and today lights up.'
              : `${activeInWindow} of the last ${WINDOW_DAYS} days had a workout, a run or a hike.`}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue} testID="streak-current">{current}</Text>
              <Text style={styles.statLabel}>Current streak</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue} testID="streak-longest">{longest}</Text>
              <Text style={styles.statLabel}>Longest streak</Text>
            </View>
          </View>
          <Text style={styles.note}>
            A streak is the days in a row with a workout, a run or a hike. If you have not trained yet today, yesterday
            still keeps it going. A whole day without one ends it.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  headerRightPlaceholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  caption: { fontSize: 13, color: '#555', marginTop: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '800', color: '#000' },
  statLabel: { fontSize: 13, color: '#555', marginTop: 2 },
  divider: { width: 1, height: 40, backgroundColor: '#F0F0F0' },
  note: { fontSize: 13, color: '#555', marginTop: 16, lineHeight: 18 },
});

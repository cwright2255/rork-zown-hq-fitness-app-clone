import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';
import { localDateKey } from '@/lib/localDate';







// The last 7 days (compact) or 30 days (full) with the days that had a workout, a run or a hike coloured in.
// `days` is the list of those calendar days ("YYYY-MM-DD"), e.g. from useActivityDays() in services/streakService.js.
const StreakCalendar = ({ compact = false, days = [] }) => {
  const doneDays = new Set(Array.isArray(days) ? days : []);

  // Get the last 7 days for compact view, or last 30 days for full view
  const daysToShow = compact ? 7 : 30;

  // Generate dates for the last N days
  const dates = [];
  const today = new Date();

  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = localDateKey(date);

    dates.push({
      date: dateString,
      day: date.getDate(),
      completed: doneDays.has(dateString),
      isFuture: i === 0 ? false : date > today,
      isToday: i === 0
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.daysContainer}>
        {dates.map((date, index) =>
        <View key={date.date} style={[
        styles.dayContainer,
        compact && styles.compactDayContainer]
        }>
            {!compact &&
          <Text style={styles.dayText}>{date.day}</Text>
          }
            <View style={[
          styles.dayIndicator,
          date.completed && styles.completedDay,
          date.isToday && styles.todayIndicator,
          compact && styles.compactDayIndicator]
          } />
          </View>
        )}
      </View>
    </View>);

};

const styles = StyleSheet.create({
  container: {
    marginTop: 4
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dayContainer: {
    alignItems: 'center',
    width: 24
  },
  compactDayContainer: {
    width: 12
  },
  dayText: {
    fontSize: 12,
    color: tokens.colors.text.base,
    marginBottom: 4
  },
  dayIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.sky.light
  },
  compactDayIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  completedDay: {
    backgroundColor: tokens.colors.brand.base
  },
  todayIndicator: {
    borderWidth: 2,
    borderColor: tokens.colors.brand.base
  }
});

export default StreakCalendar;
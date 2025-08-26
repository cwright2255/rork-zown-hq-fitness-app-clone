import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserStore } from '@/store/userStore';
import { StreakData } from '@/types';

interface StreakCalendarProps {
  compact?: boolean;
  streakData?: StreakData;
}

const StreakCalendar = ({ compact = false, streakData }: StreakCalendarProps) => {
  const { user } = useUserStore();
  
  // Use provided streakData or get it from user store
  const streakInfo = streakData || (user ? user.streakData : { currentStreak: 0, longestStreak: 0, streakHistory: [] });
  
  if (!streakInfo) return null;
  
  const streakHistory = streakInfo.streakHistory || [];
  
  // Get the last 7 days for compact view, or last 30 days for full view
  const daysToShow = compact ? 7 : 30;
  
  // Generate dates for the last N days
  const dates = [];
  const today = new Date();
  
  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    // Check if this date is in the streak history
    const historyEntry = streakHistory.find(entry => entry.date === dateString);
    
    dates.push({
      date: dateString,
      day: date.getDate(),
      completed: historyEntry ? historyEntry.completed : false,
      isFuture: i === 0 ? false : date > today,
      isToday: i === 0
    });
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.daysContainer}>
        {dates.map((date, index) => (
          <View key={date.date} style={[
            styles.dayContainer,
            compact && styles.compactDayContainer
          ]}>
            {!compact && (
              <Text style={styles.dayText}>{date.day}</Text>
            )}
            <View style={[
              styles.dayIndicator,
              date.completed && styles.completedDay,
              date.isToday && styles.todayIndicator,
              compact && styles.compactDayIndicator
            ]} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayContainer: {
    alignItems: 'center',
    width: 24,
  },
  compactDayContainer: {
    width: 12,
  },
  dayText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dayIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  compactDayIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completedDay: {
    backgroundColor: '#6366f1',
  },
  todayIndicator: {
    borderWidth: 2,
    borderColor: '#6366f1',
  },
});

export default StreakCalendar;
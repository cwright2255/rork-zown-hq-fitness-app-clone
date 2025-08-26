import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Badge from '@/components/Badge';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 7;

interface WorkoutEvent {
  id: string;
  title: string;
  type: 'workout' | 'reminder' | 'goal' | 'habit';
  time?: string;
  duration?: number;
  completed?: boolean;
  color: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: WorkoutEvent[];
}

interface WorkoutCalendarProps {
  onDateSelect?: (date: Date) => void;
  onEventPress?: (event: WorkoutEvent) => void;
  onAddEvent?: (date: Date) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Mock events data
const mockEvents: { [key: string]: WorkoutEvent[] } = {
  '2025-01-20': [
    {
      id: 'event-1',
      title: 'Morning HIIT',
      type: 'workout',
      time: '07:00',
      duration: 30,
      completed: true,
      color: Colors.primary
    },
    {
      id: 'event-2',
      title: 'Drink 8 glasses of water',
      type: 'habit',
      completed: false,
      color: Colors.info
    }
  ],
  '2025-01-21': [
    {
      id: 'event-3',
      title: 'Strength Training',
      type: 'workout',
      time: '18:00',
      duration: 45,
      completed: false,
      color: Colors.secondary
    }
  ],
  '2025-01-22': [
    {
      id: 'event-4',
      title: 'Rest Day Reminder',
      type: 'reminder',
      time: '09:00',
      completed: false,
      color: Colors.warning
    }
  ],
  '2025-01-23': [
    {
      id: 'event-5',
      title: 'Run 5K Goal',
      type: 'goal',
      time: '06:30',
      duration: 30,
      completed: false,
      color: Colors.success
    }
  ]
};

export default function WorkoutCalendar({ onDateSelect, onEventPress, onAddEvent }: WorkoutCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dateKey = date.toISOString().split('T')[0];
      const events = mockEvents[dateKey] || [];
      
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        events
      });
    }

    return days;
  }, [currentDate]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  }, []);

  const handleDatePress = useCallback((day: CalendarDay) => {
    setSelectedDate(day.date);
    onDateSelect?.(day.date);
  }, [onDateSelect]);

  const handleAddEvent = useCallback((date: Date) => {
    onAddEvent?.(date);
  }, [onAddEvent]);

  const renderEventDot = useCallback((event: WorkoutEvent, index: number) => {
    return (
      <View
        key={event.id}
        style={[
          styles.eventDot,
          { 
            backgroundColor: event.completed ? event.color : `${event.color}40`,
            left: index * 6
          }
        ]}
      />
    );
  }, []);

  const renderCalendarDay = useCallback((day: CalendarDay, index: number) => {
    const isSelected = selectedDate && day.date.getTime() === selectedDate.getTime();
    
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.dayCell,
          !day.isCurrentMonth && styles.dayOutsideMonth,
          day.isToday && styles.dayToday,
          isSelected && styles.daySelected
        ]}
        onPress={() => handleDatePress(day)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayText,
          !day.isCurrentMonth && styles.dayTextOutsideMonth,
          day.isToday && styles.dayTextToday,
          isSelected && styles.dayTextSelected
        ]}>
          {day.date.getDate()}
        </Text>
        
        {day.events.length > 0 && (
          <View style={styles.eventsContainer}>
            {day.events.slice(0, 3).map((event, eventIndex) => 
              renderEventDot(event, eventIndex)
            )}
            {day.events.length > 3 && (
              <Text style={styles.moreEventsText}>+{day.events.length - 3}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedDate, handleDatePress, renderEventDot]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split('T')[0];
    return mockEvents[dateKey] || [];
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      {/* Calendar Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateMonth('prev')}
        >
          <ChevronLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        
        <Text style={styles.monthTitle}>
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateMonth('next')}
        >
          <ChevronRight size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Days of Week Header */}
      <View style={styles.daysHeader}>
        {DAYS.map(day => (
          <View key={day} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => renderCalendarDay(day, index))}
      </View>

      {/* Selected Day Events */}
      {selectedDate && (
        <Card style={styles.selectedDayCard}>
          <View style={styles.selectedDayHeader}>
            <Text style={styles.selectedDayTitle}>
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            <TouchableOpacity 
              style={styles.addEventButton}
              onPress={() => handleAddEvent(selectedDate)}
            >
              <Plus size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          
          {selectedDayEvents.length > 0 ? (
            <ScrollView style={styles.eventsScrollView} showsVerticalScrollIndicator={false}>
              {selectedDayEvents.map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventItem}
                  onPress={() => onEventPress?.(event)}
                >
                  <View style={[styles.eventColorBar, { backgroundColor: event.color }]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Badge 
                        variant={event.type === 'workout' ? 'primary' : 
                                event.type === 'goal' ? 'success' : 
                                event.type === 'reminder' ? 'warning' : 'secondary'}
                        style={styles.eventTypeBadge}
                      >
                        {event.type.toUpperCase()}
                      </Badge>
                    </View>
                    
                    {event.time && (
                      <View style={styles.eventMeta}>
                        <Clock size={14} color={Colors.text.secondary} />
                        <Text style={styles.eventTime}>{event.time}</Text>
                        {event.duration && (
                          <Text style={styles.eventDuration}>• {event.duration}min</Text>
                        )}
                      </View>
                    )}
                    
                    {event.completed && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>✓ Completed</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noEventsContainer}>
              <CalendarIcon size={32} color={Colors.text.tertiary} />
              <Text style={styles.noEventsText}>No events scheduled</Text>
              <Text style={styles.noEventsSubtext}>Tap + to add a workout or reminder</Text>
            </View>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  daysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  dayOutsideMonth: {
    opacity: 0.3,
  },
  dayToday: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  daySelected: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  dayTextOutsideMonth: {
    color: Colors.text.tertiary,
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: Colors.text.inverse,
    fontWeight: '700',
  },
  eventsContainer: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 8,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
  },
  moreEventsText: {
    fontSize: 8,
    color: Colors.text.secondary,
    marginLeft: 18,
  },
  selectedDayCard: {
    margin: 20,
    padding: 16,
    maxHeight: 300,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  addEventButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsScrollView: {
    maxHeight: 200,
  },
  eventItem: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  eventTypeBadge: {
    height: 20,
    paddingHorizontal: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  eventDuration: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  completedBadge: {
    alignSelf: 'flex-start',
  },
  completedText: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noEventsText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 8,
  },
  noEventsSubtext: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
});
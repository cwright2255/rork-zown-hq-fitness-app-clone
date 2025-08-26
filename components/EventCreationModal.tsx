import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { X, Clock, Bell, Repeat } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';


interface EventCreationModalProps {
  visible: boolean;
  selectedDate: Date;
  onClose: () => void;
  onSave: (event: any) => void;
}

const EVENT_TYPES = [
  { id: 'workout', label: 'Workout', icon: '💪', color: Colors.primary },
  { id: 'reminder', label: 'Reminder', icon: '🔔', color: Colors.warning },
  { id: 'goal', label: 'Goal', icon: '🎯', color: Colors.success },
  { id: 'habit', label: 'Habit', icon: '✅', color: Colors.info },
];

const REMINDER_TIMES = [
  '15 minutes before',
  '30 minutes before',
  '1 hour before',
  '1 day before',
];

export default function EventCreationModal({ visible, selectedDate, onClose, onSave }: EventCreationModalProps) {
  const [eventType, setEventType] = useState('workout');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('15 minutes before');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState('daily');

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your event');
      return;
    }

    const selectedEventType = EVENT_TYPES.find(type => type.id === eventType);
    
    const newEvent = {
      id: `event-${Date.now()}`,
      title: title.trim(),
      type: eventType,
      time: time || undefined,
      duration: duration ? parseInt(duration) : undefined,
      completed: false,
      color: selectedEventType?.color || Colors.primary,
      date: selectedDate.toISOString().split('T')[0],
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : undefined,
      isRecurring,
      recurringPattern: isRecurring ? recurringPattern : undefined,
    };

    onSave(newEvent);
    
    // Reset form
    setTitle('');
    setTime('');
    setDuration('');
    setReminderEnabled(false);
    setIsRecurring(false);
    setEventType('workout');
    
    onClose();
  }, [title, eventType, time, duration, reminderEnabled, reminderTime, isRecurring, recurringPattern, selectedDate, onSave, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Card style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Event</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.dateText}>
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Event Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Type</Text>
            <View style={styles.eventTypeGrid}>
              {EVENT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.eventTypeCard,
                    eventType === type.id && styles.eventTypeCardSelected
                  ]}
                  onPress={() => setEventType(type.id)}
                >
                  <Text style={styles.eventTypeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.eventTypeLabel,
                    eventType === type.id && styles.eventTypeLabelSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title..."
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          {/* Time Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time (Optional)</Text>
            <View style={styles.timeInputContainer}>
              <Clock size={20} color={Colors.text.secondary} />
              <TextInput
                style={styles.timeInput}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM (e.g., 07:30)"
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
          </View>

          {/* Duration Input */}
          {(eventType === 'workout' || eventType === 'goal') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duration (Minutes)</Text>
              <TextInput
                style={styles.textInput}
                value={duration}
                onChangeText={setDuration}
                placeholder="30"
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Reminder Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reminder</Text>
              <TouchableOpacity
                style={[styles.toggle, reminderEnabled && styles.toggleActive]}
                onPress={() => setReminderEnabled(!reminderEnabled)}
              >
                <View style={[styles.toggleThumb, reminderEnabled && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            
            {reminderEnabled && (
              <View style={styles.reminderOptions}>
                {REMINDER_TIMES.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.reminderOption,
                      reminderTime === option && styles.reminderOptionSelected
                    ]}
                    onPress={() => setReminderTime(option)}
                  >
                    <Bell size={16} color={reminderTime === option ? Colors.primary : Colors.text.secondary} />
                    <Text style={[
                      styles.reminderOptionText,
                      reminderTime === option && styles.reminderOptionTextSelected
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Recurring Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recurring</Text>
              <TouchableOpacity
                style={[styles.toggle, isRecurring && styles.toggleActive]}
                onPress={() => setIsRecurring(!isRecurring)}
              >
                <View style={[styles.toggleThumb, isRecurring && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            
            {isRecurring && (
              <View style={styles.recurringOptions}>
                {['daily', 'weekly', 'monthly'].map(pattern => (
                  <TouchableOpacity
                    key={pattern}
                    style={[
                      styles.recurringOption,
                      recurringPattern === pattern && styles.recurringOptionSelected
                    ]}
                    onPress={() => setRecurringPattern(pattern)}
                  >
                    <Repeat size={16} color={recurringPattern === pattern ? Colors.primary : Colors.text.secondary} />
                    <Text style={[
                      styles.recurringOptionText,
                      recurringPattern === pattern && styles.recurringOptionTextSelected
                    ]}>
                      {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={styles.cancelButton}
          />
          <Button
            title="Save Event"
            variant="primary"
            onPress={handleSave}
            style={styles.saveButton}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxHeight: '80%',
    margin: 20,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  eventTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  eventTypeCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  eventTypeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  eventTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  eventTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  eventTypeLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.inactive,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.text.inverse,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  reminderOptions: {
    gap: 8,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    gap: 8,
  },
  reminderOptionSelected: {
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  reminderOptionText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  reminderOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '500',
  },
  recurringOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  recurringOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    gap: 6,
  },
  recurringOptionSelected: {
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  recurringOptionText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  recurringOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
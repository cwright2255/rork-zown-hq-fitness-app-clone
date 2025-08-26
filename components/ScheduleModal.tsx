import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { X, Calendar, Clock, Repeat, Bell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (schedule: any) => void;
}

const ACTIVITY_TYPES = [
  { id: 'workout', label: 'Workout', icon: '💪', color: Colors.primary },
  { id: 'meal', label: 'Meal', icon: '🍽️', color: Colors.success },
  { id: 'meditation', label: 'Meditation', icon: '🧘', color: Colors.info },
  { id: 'meeting', label: 'Meeting', icon: '👥', color: Colors.secondary },
  { id: 'study', label: 'Study', icon: '📚', color: Colors.warning },
  { id: 'other', label: 'Other', icon: '📝', color: Colors.text.secondary },
];

const TIME_SLOTS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
];

const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
];

const REPEAT_OPTIONS = [
  { id: 'none', label: 'No Repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
];

export default function ScheduleModal({ visible, onClose, onSave }: ScheduleModalProps) {
  const [selectedType, setSelectedType] = useState('workout');
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('07:00');
  const [duration, setDuration] = useState(30);
  const [repeatOption, setRepeatOption] = useState('none');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [notes, setNotes] = useState('');

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your scheduled activity');
      return;
    }

    const selectedTypeData = ACTIVITY_TYPES.find(type => type.id === selectedType);
    
    const newSchedule = {
      id: `schedule-${Date.now()}`,
      title: title.trim(),
      type: selectedType,
      typeColor: selectedTypeData?.color || Colors.primary,
      date: selectedDate.toISOString().split('T')[0],
      time: selectedTime,
      duration,
      repeatOption,
      reminderEnabled,
      reminderMinutes: reminderEnabled ? reminderMinutes : undefined,
      notes: notes.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    onSave(newSchedule);
    
    // Reset form
    setTitle('');
    setSelectedType('workout');
    setSelectedDate(new Date());
    setSelectedTime('07:00');
    setDuration(30);
    setRepeatOption('none');
    setReminderEnabled(true);
    setReminderMinutes(15);
    setNotes('');
    
    onClose();
  }, [title, selectedType, selectedDate, selectedTime, duration, repeatOption, reminderEnabled, reminderMinutes, notes, onSave, onClose]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Card style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Schedule Activity</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Activity Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Type</Text>
            <View style={styles.typeGrid}>
              {ACTIVITY_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    selectedType === type.id && styles.typeCardSelected
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeLabel,
                    selectedType === type.id && styles.typeLabelSelected
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
              placeholder="Enter activity title..."
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date</Text>
            <View style={styles.dateSelector}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => handleDateChange(-1)}
              >
                <Text style={styles.dateButtonText}>Yesterday</Text>
              </TouchableOpacity>
              
              <View style={styles.selectedDateContainer}>
                <Calendar size={16} color={Colors.primary} />
                <Text style={styles.selectedDateText}>{formatDate(selectedDate)}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => handleDateChange(1)}
              >
                <Text style={styles.dateButtonText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.timeScrollView}
            >
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map(time => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeSlot,
                      selectedTime === time && styles.timeSlotSelected
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Clock size={14} color={selectedTime === time ? Colors.primary : Colors.text.secondary} />
                    <Text style={[
                      styles.timeSlotText,
                      selectedTime === time && styles.timeSlotTextSelected
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Duration Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.durationGrid}>
              {DURATIONS.map(dur => (
                <TouchableOpacity
                  key={dur.minutes}
                  style={[
                    styles.durationButton,
                    duration === dur.minutes && styles.durationButtonSelected
                  ]}
                  onPress={() => setDuration(dur.minutes)}
                >
                  <Text style={[
                    styles.durationButtonText,
                    duration === dur.minutes && styles.durationButtonTextSelected
                  ]}>
                    {dur.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Repeat Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repeat</Text>
            <View style={styles.repeatGrid}>
              {REPEAT_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.repeatButton,
                    repeatOption === option.id && styles.repeatButtonSelected
                  ]}
                  onPress={() => setRepeatOption(option.id)}
                >
                  <Repeat size={14} color={repeatOption === option.id ? Colors.primary : Colors.text.secondary} />
                  <Text style={[
                    styles.repeatButtonText,
                    repeatOption === option.id && styles.repeatButtonTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
                {[5, 10, 15, 30, 60].map(minutes => (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.reminderOption,
                      reminderMinutes === minutes && styles.reminderOptionSelected
                    ]}
                    onPress={() => setReminderMinutes(minutes)}
                  >
                    <Bell size={14} color={reminderMinutes === minutes ? Colors.primary : Colors.text.secondary} />
                    <Text style={[
                      styles.reminderOptionText,
                      reminderMinutes === minutes && styles.reminderOptionTextSelected
                    ]}>
                      {minutes} min before
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes..."
              placeholderTextColor={Colors.text.tertiary}
              multiline
              numberOfLines={3}
            />
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
            title="Schedule"
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
    maxHeight: '90%',
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    flex: 1,
    minWidth: '30%',
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  typeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  typeLabelSelected: {
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 6,
  },
  dateButtonText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  selectedDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
  },
  selectedDateText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  timeScrollView: {
    maxHeight: 120,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 20,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeSlotSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  timeSlotText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  durationButtonSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  durationButtonText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  durationButtonTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  repeatGrid: {
    gap: 8,
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  repeatButtonSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  repeatButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  repeatButtonTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reminderOptionSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  reminderOptionText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  reminderOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
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
import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localDateKey, parseDateKey, shiftDateKey } from '@/lib/localDate';
import {
  KIND_CHOICES, REMINDER_CHOICES, REPEAT_END_CHOICES, WEEKDAY_SHORT, MAX_TITLE, MAX_NOTES,
  clockLabel, dateLabel, endsWeeksOf, formFromEvent, moveFormDate, repeatEndKey, shiftTime,
} from '@/lib/calendarEvents';

const DEFAULT_TIME = '07:00';
const MAX_WORKOUT_CHIPS = 20;

const blankForm = (date) => ({
  title: '', kind: 'workout', date: parseDateKey(date) ? date : localDateKey(), time: DEFAULT_TIME, notes: '', workoutId: null, repeat: null,
  remindMinutes: 0,
});

// The sheet for adding an event to the calendar, or changing one: what it is, when, whether it repeats, and when to remind.
// It is shown for as long as it is rendered, so the screen renders it only when open.
//
//   event         the event being changed, or nothing for a new one
//   initialDate   the day a new event starts on ("YYYY-MM-DD")
//   workouts      the person's saved workouts, [{ id, name }], to link a workout to the event
//   onSave(form)  makes the change and says how it went: { ok: true } or { ok: false, error }
//   onOpenWorkout(id)  opens a linked workout
//   onClose()
export default function CalendarEventSheet({ event, initialDate, workouts = [], onSave, onOpenWorkout, onClose }) {
  const insets = useSafeAreaInsets();
  const editing = !!event;
  const [form, setForm] = React.useState(() => (event ? formFromEvent(event) : blankForm(initialDate)));
  // A person who has picked a reminder keeps it when they change the kind; until then a meal has none and anything else is at its time.
  const [remindChosen, setRemindChosen] = React.useState(editing);
  const [error, setError] = React.useState('');

  const change = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(''); };
  // A repeating event keeps the day it started on, so its day is not changed here.
  const dayLocked = editing && !!event.repeat;
  const moveDay = (days) => setForm((f) => moveFormDate(f, shiftDateKey(f.date, days)));

  const chooseKind = (kind) => {
    change({ kind, workoutId: kind === 'workout' ? form.workoutId : null, ...(remindChosen ? {} : { remindMinutes: kind === 'nutrition' ? null : 0 }) });
  };
  const chooseWorkout = (workout) => {
    change(workout
      ? { workoutId: workout.id, title: form.title.trim() ? form.title : String(workout.name || '').slice(0, MAX_TITLE) }
      : { workoutId: null });
  };

  const chooseRepeat = (mode) => {
    const until = form.repeat ? form.repeat.until : null;
    if (mode === 'none') change({ repeat: null });
    else if (mode === 'day') change({ repeat: { every: 'day', until } });
    else change({ repeat: { every: 'week', days: [parseDateKey(form.date).getDay()], until } });
  };
  const toggleWeekday = (day) => {
    const days = form.repeat.days || [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
    if (next.length === 0) return;
    change({ repeat: { ...form.repeat, days: next } });
  };

  const endsWeeks = form.repeat ? endsWeeksOf(form.repeat, form.date) : undefined;

  const save = () => {
    const result = onSave(form);
    if (result && result.ok === false) setError(result.error || 'Could not save that.');
    else onClose();
  };

  const startWeekday = parseDateKey(form.date) ? parseDateKey(form.date).getDay() : 0;
  const days = form.repeat && form.repeat.every === 'week' ? form.repeat.days : [];
  const shownWorkouts = workouts.slice(0, MAX_WORKOUT_CHIPS);
  const linked = form.workoutId ? workouts.find((w) => w.id === form.workoutId) : null;

  const chip = (testID, label, active, onPress, extra) => (
    <TouchableOpacity
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive, extra]}
      onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
  const step = (testID, label, onPress, accessibilityLabel) => (
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.stepBtn} onPress={onPress} hitSlop={6}>
      <Text style={styles.stepText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View testID="event-sheet" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title}>{editing ? 'Edit event' : 'New event'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              testID="event-title"
              style={styles.input}
              value={form.title}
              onChangeText={(title) => change({ title })}
              placeholder="Leg day, easy run, lunch with Sam..."
              placeholderTextColor="#999999"
              maxLength={MAX_TITLE}
              returnKeyType="done"
            />

            <Text style={styles.label}>Kind</Text>
            <View style={styles.row}>
              {KIND_CHOICES.map((k) => chip(`event-kind-${k.id}`, k.label, form.kind === k.id, () => chooseKind(k.id), styles.flexChip))}
            </View>

            {form.kind === 'workout' && shownWorkouts.length > 0 ? (
              <>
                <Text style={styles.label}>Workout</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {chip('event-workout-none', 'None', !form.workoutId, () => chooseWorkout(null))}
                  {shownWorkouts.map((w) => chip(`event-workout-${w.id}`, String(w.name || 'Workout'), form.workoutId === w.id, () => chooseWorkout(w)))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>{dayLocked ? 'Starts' : 'Day'}</Text>
            <View style={styles.stepRow}>
              {dayLocked ? null : step('event-date-prev-week', '«', () => moveDay(-7), 'A week earlier')}
              {dayLocked ? null : step('event-date-prev-day', '‹', () => moveDay(-1), 'A day earlier')}
              <Text testID="event-date-label" style={styles.stepValue}>{dateLabel(form.date)}</Text>
              {dayLocked ? null : step('event-date-next-day', '›', () => moveDay(1), 'A day later')}
              {dayLocked ? null : step('event-date-next-week', '»', () => moveDay(7), 'A week later')}
            </View>

            <Text style={styles.label}>Time</Text>
            <View style={styles.stepRow}>
              {step('event-time-minus-60', '«', () => change({ time: shiftTime(form.time, -60) }), 'An hour earlier')}
              {step('event-time-minus-15', '‹', () => change({ time: shiftTime(form.time, -15) }), '15 minutes earlier')}
              <Text testID="event-time-label" style={styles.stepValue}>{clockLabel(form.time)}</Text>
              {step('event-time-plus-15', '›', () => change({ time: shiftTime(form.time, 15) }), '15 minutes later')}
              {step('event-time-plus-60', '»', () => change({ time: shiftTime(form.time, 60) }), 'An hour later')}
            </View>

            <Text style={styles.label}>Repeat</Text>
            <View style={styles.row}>
              {chip('event-repeat-none', 'Never', !form.repeat, () => chooseRepeat('none'), styles.flexChip)}
              {chip('event-repeat-day', 'Every day', form.repeat?.every === 'day', () => chooseRepeat('day'), styles.flexChip)}
              {chip('event-repeat-week', 'Weekly', form.repeat?.every === 'week', () => chooseRepeat('week'), styles.flexChip)}
            </View>
            {form.repeat?.every === 'week' ? (
              <View style={[styles.row, styles.weekRow]}>
                {WEEKDAY_SHORT.map((name, d) => chip(`event-weekday-${d}`, name.slice(0, 2), days.includes(d), () => toggleWeekday(d), styles.dayChip))}
              </View>
            ) : null}
            {form.repeat ? (
              <>
                <Text style={styles.label}>Ends</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {REPEAT_END_CHOICES.map((c) => chip(
                    `event-ends-${c.weeks === null ? 'never' : c.weeks}`,
                    c.label,
                    endsWeeks === c.weeks,
                    () => change({ repeat: { ...form.repeat, until: repeatEndKey(form.date, c.weeks) } }),
                  ))}
                  {endsWeeks === undefined && form.repeat.until
                    ? chip('event-ends-custom', `Until ${dateLabel(form.repeat.until)}`, true, () => {})
                    : null}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>Reminder</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {REMINDER_CHOICES.map((r) => chip(
                `event-remind-${r.minutes === null ? 'none' : r.minutes}`,
                r.label,
                form.remindMinutes === r.minutes,
                () => { setRemindChosen(true); change({ remindMinutes: r.minutes }); },
              ))}
            </ScrollView>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              testID="event-notes"
              style={[styles.input, styles.notes]}
              value={form.notes}
              onChangeText={(notes) => change({ notes })}
              placeholder="Optional"
              placeholderTextColor="#999999"
              maxLength={MAX_NOTES}
              multiline
            />

            {linked && onOpenWorkout ? (
              <TouchableOpacity testID="event-open-workout" accessibilityRole="button" style={styles.linkBtn} onPress={() => onOpenWorkout(linked.id)}>
                <Text style={styles.linkText}>Open {String(linked.name || 'workout')}</Text>
              </TouchableOpacity>
            ) : null}

            {error ? <Text testID="event-error" accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.buttons}>
            <TouchableOpacity testID="event-cancel" accessibilityRole="button" style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="event-save" accessibilityRole="button" style={[styles.button, styles.confirm]} onPress={save}>
              <Text style={styles.confirmText}>{editing ? 'Save' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  title: { fontSize: 18, fontWeight: '700', color: '#000000' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999999', marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#000000' },
  notes: { minHeight: 64, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  weekRow: { marginTop: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F0F0F0', alignItems: 'center' },
  flexChip: { flex: 1, paddingHorizontal: 6 },
  dayChip: { flex: 1, paddingHorizontal: 0, paddingVertical: 9 },
  chipActive: { backgroundColor: '#000000' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666666' },
  chipTextActive: { color: '#FFFFFF' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '700', color: '#000000', lineHeight: 24 },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#000000' },
  linkBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#000000', alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', color: '#000000' },
  error: { marginTop: 14, fontSize: 14, color: '#C62828' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  cancel: { borderWidth: 1, borderColor: '#000000' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  confirm: { backgroundColor: '#000000' },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

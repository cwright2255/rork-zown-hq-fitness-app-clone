import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MEAL_SLOTS, SLOT_IDS, slotForHour } from '@/lib/foodLog';
import { localDateKey, shiftDateKey } from '@/lib/localDate';
import { dayParts } from '@/lib/mealPlan';

/** How many days, starting today, can be picked. */
export const TARGET_DAYS = 14;

// A sheet for choosing the day (today and the 13 after it) and the meal slot of a
// plan item: where to add a recipe, or where to move or copy an item to. It is
// shown for as long as it is rendered, so the screen renders it only when open.
export default function PlanTargetSheet({ title, confirmLabel = 'Add', initialDate, initialSlot, onConfirm, onClose }) {
  const insets = useSafeAreaInsets();
  const today = localDateKey();
  const days = React.useMemo(() => Array.from({ length: TARGET_DAYS }, (_, i) => shiftDateKey(today, i)), [today]);
  // Starts on the day and meal asked for (today, and the meal that fits the time of day, if those are not valid).
  const [date, setDate] = React.useState(() => (days.includes(initialDate) ? initialDate : today));
  const [slot, setSlot] = React.useState(() => (SLOT_IDS.includes(initialSlot) ? initialSlot : slotForHour(new Date().getHours())));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID="plan-target-sheet" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.label}>Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {days.map((key) => {
              const parts = dayParts(key);
              const active = key === date;
              return (
                <TouchableOpacity
                  key={key}
                  testID={`plan-target-day-${key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.dayChip, active && styles.chipActive]}
                  onPress={() => setDate(key)}>
                  <Text style={[styles.dayName, active && styles.chipTextActive]}>{key === today ? 'Today' : parts.weekday}</Text>
                  <Text style={[styles.dayNumber, active && styles.chipTextActive]}>{parts.day}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Meal</Text>
          <View style={styles.slotRow}>
            {MEAL_SLOTS.map((s) => {
              const active = s.id === slot;
              return (
                <TouchableOpacity
                  key={s.id}
                  testID={`plan-target-slot-${s.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.slotChip, active && styles.chipActive]}
                  onPress={() => setSlot(s.id)}>
                  <Text style={[styles.slotText, active && styles.chipTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity testID="plan-target-cancel" accessibilityRole="button" style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="plan-target-confirm" accessibilityRole="button" style={[styles.button, styles.confirm]} onPress={() => onConfirm({ date, slot })}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#000000' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999999', marginTop: 18, marginBottom: 8 },
  chips: { gap: 8, paddingRight: 8 },
  dayChip: { minWidth: 56, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#F0F0F0', alignItems: 'center' },
  chipActive: { backgroundColor: '#000000' },
  chipTextActive: { color: '#FFFFFF' },
  dayName: { fontSize: 12, fontWeight: '600', color: '#666666' },
  dayNumber: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 2 },
  slotRow: { flexDirection: 'row', gap: 8 },
  slotChip: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F0F0F0', alignItems: 'center' },
  slotText: { fontSize: 13, fontWeight: '600', color: '#666666' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  cancel: { borderWidth: 1, borderColor: '#000000' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  confirm: { backgroundColor: '#000000' },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

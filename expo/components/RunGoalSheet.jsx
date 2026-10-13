// components/RunGoalSheet.jsx
//
// The sheet that opens from the "Distance Goal" row on the run screen: round
// distances in the person's own unit (Settings > Distance Units), with the current
// goal marked and a way to clear it. Picking one hands it back in kilometres,
// like every other distance in Zown (lib/runGoal.js).

import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { goalOptions, isSameGoal } from '../lib/runGoal';

export default function RunGoalSheet({ visible, units, goalKm, onChoose, onClose }) {
  const options = goalOptions(units);
  const hasGoal = goalKm !== null && goalKm !== undefined;

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="run-goal-backdrop">
        <Pressable style={styles.sheet} onPress={() => {}} testID="run-goal-sheet">
          <View style={styles.grabber} />
          <Text style={styles.title}>Distance goal</Text>
          <Text style={styles.subtitle}>How far do you want to go?</Text>
          <View style={styles.options}>
            {options.map((option) => {
              const selected = isSameGoal(goalKm, option);
              return (
                <Pressable
                  key={option.label}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => onChoose(option.km)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`run-goal-option-${option.value}`}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {hasGoal && (
            <Pressable style={styles.clear} onPress={() => onChoose(null)} accessibilityRole="button" testID="run-goal-clear">
              <Text style={styles.clearText}>Clear goal</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  option: {
    minWidth: 92, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24,
    borderWidth: 1, borderColor: '#555', alignItems: 'center',
  },
  optionSelected: { backgroundColor: '#FFF', borderColor: '#FFF' },
  optionText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  optionTextSelected: { color: '#000' },
  clear: { marginTop: 20, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  clearText: { fontSize: 14, fontWeight: '600', color: '#999' },
});

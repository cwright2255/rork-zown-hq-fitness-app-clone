import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const MOODS = ['😴', '😔', '😐', '🙂', '😁'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MoodTrackingScreen() {
  const [mood, setMood] = useState(3);
  const [journal, setJournal] = useState('');

  const weekHistory = [3, 2, 4, 3, 4, 4, 3];

  const moodColor = (v) => {
    const colors = ['#666', '#EF4444', '#F97316', '#3B82F6', '#22C55E'];
    return colors[v] || '#666';
  };

  const handleSave = () => {
    Alert.alert('Saved', 'Your mood has been recorded.');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mood" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text style={styles.sectionLabel}>How are you feeling?</Text>
        <View style={styles.card}>
          <View style={styles.moodRow}>
            {MOODS.map((emoji, i) => {
              const active = mood === i;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMood(i)}
                  style={[styles.moodBtn, active && styles.moodBtnActive]}>
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Journal</Text>
        <TextInput
          style={styles.input}
          value={journal}
          onChangeText={setJournal}
          placeholder="How was your day?"
          placeholderTextColor="#666"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>This Week</Text>
        <View style={styles.weekRow}>
          {DAYS.map((d, i) => (
            <View key={i} style={styles.dayCol}>
              <View style={[styles.dayDot, { backgroundColor: moodColor(weekHistory[i]) }]} />
              <Text style={styles.dayLabel}>{d}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton title="Save" onPress={handleSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 8, marginTop: 12,
  },
  card: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnActive: { backgroundColor: '#fff' },
  moodEmoji: { fontSize: 26 },
  input: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16,
    color: '#fff', fontSize: 15, minHeight: 120,
  },
  weekRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayDot: { width: 16, height: 16, borderRadius: 8 },
  dayLabel: { color: '#999', fontSize: 12 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

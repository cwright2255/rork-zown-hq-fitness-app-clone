import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { tokens } from '../../theme/tokens';



const MOODS = ['ÃÂ°ÃÂÃÂÃÂ´', 'ÃÂ°ÃÂÃÂÃÂ', 'ÃÂ°ÃÂÃÂÃÂ', 'ÃÂ°ÃÂÃÂÃÂ', 'ÃÂ°ÃÂÃÂÃÂ'];
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
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 140 }}>
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
          placeholderTextColor="#999999"
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

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. input keeps a visible border (#E5E5E5) rather than
// shadow, matching app/community.jsx's text-input convention. Note:
// the MOODS array's emoji characters have the same pre-existing
// encoding issue as app/wellbeing.jsx's - untouched here too, for the
// same reason.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 3 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: tokens.spacing.sm, marginTop: 12,
  },
  card: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    width: 48, height: 48, borderRadius: tokens.radius.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnActive: { backgroundColor: '#000000' },
  moodEmoji: { fontSize: 26 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5',
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
    color: '#000000', fontSize: 15, minHeight: 120,
  },
  weekRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayDot: { width: 16, height: 16, borderRadius: tokens.radius.sm },
  dayLabel: { color: '#999999', fontSize: 12 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});

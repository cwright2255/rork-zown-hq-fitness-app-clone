// components/JourneyFinishedCard.jsx
//
// "You finished a journey": shown on the summary of the run or walk that took someone
// over the line (app/workout/complete.jsx). What it pays is set in lib/virtualJourneys.js
// (journeyXp) and services/journeyRewards.js (the Trailblazer badge).
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { journeyLength, journeyXp } from '@/lib/virtualJourneys';

/**
 * @param journey a catalogue entry
 * @param units   'metric' or 'imperial' (Settings > Distance Units)
 * @param onPress opens the journey
 */
export default function JourneyFinishedCard({ journey, units, onPress }) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Journey complete. ${journey.title}.`}
      testID={`journey-finished-${journey.id}`}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="trophy" size={24} color="#000" />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>Journey complete</Text>
        <Text style={styles.title} testID={`journey-finished-${journey.id}-title`}>{journey.title}</Text>
        <Text style={styles.text} testID={`journey-finished-${journey.id}-text`}>
          {`You covered all ${journeyLength(journey.distanceKm, units)}. +${journeyXp(journey.distanceKm)} XP and the Trailblazer badge.`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFE08A', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: '#999' },
  title: { fontSize: 16, fontWeight: '800', color: '#000', marginTop: 2 },
  text: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },
});

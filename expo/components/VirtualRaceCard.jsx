// components/VirtualRaceCard.jsx
//
// One virtual race on the Running screen: the Local 5K (every week) or the
// Worldwide 10K (every month). Shows how long is left, and your own time once
// you have finished it. Tapping opens the race screen (app/running/races/[kind].jsx).
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVirtualRaceStore } from '@/store/virtualRaceStore';
import {
  currentRace, raceDistanceText, raceSchedule, raceEntryId, formatRaceTime,
} from '@/lib/virtualRaces';

export default function VirtualRaceCard({ kind }) {
  const { user } = useUserStore();
  const units = useSettingsStore((s) => s.units); // Settings > Distance Units
  const race = currentRace(kind);
  const key = raceEntryId(race.id, user?.uid);
  const finished = useVirtualRaceStore((s) => s.finished[key]);
  const joined = useVirtualRaceStore((s) => s.joined[key]);

  let status = '';
  if (finished) status = `Your time ${formatRaceTime(finished.timeSec)}`;
  else if (joined) status = 'Joined';

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/running/races/${kind}`)}
      accessibilityRole="button"
      accessibilityLabel={`${race.name}. ${raceSchedule(race)}. ${status}`.trim()}
      testID={`race-card-${kind}`}
    >
      <View style={styles.icon}>
        <Ionicons name={kind === 'local' ? 'location' : 'globe-outline'} size={22} color="#FFF" />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{race.name}</Text>
        <Text style={styles.subtitle}>{`${raceDistanceText(race, units)} · ${raceSchedule(race)}`}</Text>
        {status !== '' && <Text style={styles.status} testID={`race-card-status-${kind}`}>{status}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: '#F5F5F5', borderRadius: 16, padding: 14,
  },
  icon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  texts: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#000' },
  subtitle: { fontSize: 12, color: '#999', marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', color: '#16A34A', marginTop: 2 },
});

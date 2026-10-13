// components/VirtualRaceCard.jsx
//
// One timed virtual race as a card: the Local 5K (every week) or the Worldwide 10K
// (every month). Shows how long is left, and your own time once you have finished it.
// Tapping opens the race screen (app/running/races/[kind].jsx).
import React from 'react';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVirtualRaceStore } from '@/store/virtualRaceStore';
import {
  currentRace, raceDistanceText, raceSchedule, raceEntryId, formatRaceTime,
} from '@/lib/virtualRaces';
import RaceTile from './RaceTile';

export default function VirtualRaceCard({ kind, width }) {
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
    <RaceTile
      icon={kind === 'local' ? 'location' : 'globe-outline'}
      title={race.name}
      subtitle={`${raceDistanceText(race, units)} · ${raceSchedule(race)}`}
      label={status}
      width={width}
      onPress={() => router.push(`/running/races/${kind}`)}
      accessibilityLabel={`${race.name}. ${raceSchedule(race)}. ${status}`.trim()}
      testID={`race-card-${kind}`}
      labelTestID={`race-card-status-${kind}`}
    />
  );
}

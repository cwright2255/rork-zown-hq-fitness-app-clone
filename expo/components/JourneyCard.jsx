// components/JourneyCard.jsx
//
// One virtual journey as a card: the route, its length and milestones, and, once
// joined, how far along you are. Tapping opens the journey (app/running/journeys/[id].jsx).
import React from 'react';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVirtualChallengeStore } from '@/store/virtualChallengeStore';
import { journeyProgress, journeySubtitle } from '@/lib/virtualJourneys';
import RaceTile from './RaceTile';

export default function JourneyCard({ journey, width }) {
  const { user } = useUserStore();
  const uid = user && user.uid;
  const units = useSettingsStore((s) => s.units); // Settings > Distance Units
  const record = useVirtualChallengeStore((s) => (uid ? (s.byUser[uid] || {})[journey.id] : undefined));
  const progress = journeyProgress(journey, record);

  let status = '';
  if (progress.completed) status = 'Completed';
  else if (progress.joined) status = `${progress.percent}%`;

  return (
    <RaceTile
      icon={progress.completed ? 'checkmark-circle-outline' : 'map-outline'}
      title={journey.title}
      subtitle={journeySubtitle(journey, units)}
      label={status}
      progress={progress.joined ? progress.fraction : null}
      width={width}
      onPress={() => router.push(`/running/journeys/${journey.id}`)}
      accessibilityLabel={`${journey.title}. ${journeySubtitle(journey, units)}. ${status}`.trim()}
      testID={`journey-card-${journey.id}`}
    />
  );
}

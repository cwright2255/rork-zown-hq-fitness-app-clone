// components/HikeRecoveryPrompt.jsx
//
// Asks what to do with a hike that was being recorded when the app was last
// closed (found on the phone as the app opened, see store/runTrackerStore.js).
// Open it to carry on or save it (the hike screen takes it from there), or throw
// it away after a second question. Renders nothing; asks once, as soon as `enabled`.

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useRunTrackerStore } from '@/store/runTrackerStore';
import { stopTracking } from '@/services/runTracking';
import { hikeTrailId, recoveryMessage } from '@/lib/hikeRecovery';

export default function HikeRecoveryPrompt({ enabled = true }) {
  const recovered = useRunTrackerStore((s) => s.recovered);
  const asked = useRef(false);

  useEffect(() => {
    if (!enabled || !recovered || asked.current) return;
    asked.current = true;

    const open = () => {
      const { tracker, context, acknowledgeRecovery } = useRunTrackerStore.getState();
      acknowledgeRecovery();
      router.push({
        pathname: '/running/hiking/monitor',
        params: { id: hikeTrailId(tracker.kind), resume: '1', ...context },
      });
    };

    const ask = () => {
      const { tracker } = useRunTrackerStore.getState();
      Alert.alert('Unfinished hike', recoveryMessage(tracker, Date.now()), [
        { text: 'Discard', style: 'destructive', onPress: confirmDiscard },
        { text: 'Open hike', onPress: open },
      ], { cancelable: false });
    };

    function confirmDiscard() {
      Alert.alert('Discard this hike?', 'The distance and route recorded so far will be lost.', [
        { text: 'Keep it', style: 'cancel', onPress: ask },
        {
          text: 'Discard hike',
          style: 'destructive',
          onPress: () => {
            stopTracking();
            useRunTrackerStore.getState().reset();
          },
        },
      ], { cancelable: false });
    }

    ask();
  }, [enabled, recovered]);

  return null;
}

// services/offRouteWatch.js
//
// Watches a hike in progress against the trail the hiker chose and warns when
// they stray from it (the rules are in lib/offRoute.js). It listens to the run
// tracker store, which is fed by the background GPS, so it keeps working with
// the screen locked and does not depend on the hike screen re-drawing.
//
// How a warning reaches the hiker:
//   - a buzz, always;
//   - the app open: spoken aloud (unless the hike screen's sound is turned off);
//   - the app in the background (phone in a pocket): a notification, but only if
//     the person has already allowed notifications. Nothing here asks for it.

import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useRunTrackerStore } from '@/store/runTrackerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { createOffRoute, stepOffRoute, describeOffRoute } from '@/lib/offRoute';

// The distance on the screen only changes in steps of this many metres, so it
// does not redraw on every reading.
const DISPLAY_STEP_M = 10;

async function notifyInBackground(message) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title: message.title, body: message.body, sound: true, data: { type: 'off-route' } },
      trigger: null,
    });
  } catch (e) {
    console.warn('[offRoute] could not send the notification:', e?.message);
  }
}

/**
 * Gives the warning for an event ('off', 'remind' or 'back').
 * @param speak  whether to speak it aloud when the app is open
 */
export async function alertOffRoute(event, distanceM, { speak = true } = {}) {
  // The Settings distance unit, read when the warning is given (it may have changed since the hike began).
  const message = describeOffRoute(event, distanceM, useSettingsStore.getState().units);
  if (!message) return;
  try {
    await Haptics.notificationAsync(
      event === 'back' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
  } catch (e) {
    // No buzz on this phone; the rest still happens.
  }
  if (AppState.currentState === 'active') {
    if (speak) {
      try {
        Speech.stop();
        Speech.speak(message.speech, { rate: 0.95 });
      } catch (e) {
        console.warn('[offRoute] could not speak:', e?.message);
      }
    }
  } else if (event !== 'back') {
    await notifyInBackground(message);
  }
}

/**
 * Starts watching. Only readings that arrive from now on are judged, and only
 * while the hike is running (a paused hike is not warned about).
 *
 * @param route     the trail as [{ latitude, longitude }]
 * @param onChange  called with { off, distanceM, event } when a warning is given,
 *                  when the hiker is back, and while off the trail whenever the
 *                  distance has changed enough to show
 * @param speak     () => boolean, read each time a warning is spoken
 * @param store     the tracker store (a parameter so it can be replaced in tests)
 * @returns {{ stop(): void, mute(): void }}  mute() silences the rest of this hike
 */
export function watchOffRoute({ route, onChange, speak = () => true, store = useRunTrackerStore } = {}) {
  let state = createOffRoute();
  let muted = false;
  let lastFixT = store.getState().tracker.lastFixT;
  let shown = { off: false, step: null }; // as last passed to onChange

  const report = (off, distanceM, event) => {
    if (typeof onChange === 'function') onChange({ off, distanceM, event });
  };

  const unsubscribe = store.subscribe((s) => {
    const tracker = s.tracker;
    if (!tracker || tracker.lastFixT === lastFixT) return; // not a new reading
    lastFixT = tracker.lastFixT;
    if (tracker.status !== 'running') return;

    const result = stepOffRoute(state, {
      position: tracker.current,
      route,
      t: tracker.lastFixT,
      accuracy: tracker.acc,
    });
    state = result.state;
    if (muted || result.distanceM === null) return;

    if (result.event) {
      alertOffRoute(result.event, result.distanceM, { speak: !!speak() }).catch(() => {});
    }
    const step = Math.round(result.distanceM / DISPLAY_STEP_M);
    if (result.event || (state.off && (shown.off !== state.off || shown.step !== step))) {
      shown = { off: state.off, step };
      report(state.off, result.distanceM, result.event);
    }
  });

  return {
    stop: () => unsubscribe(),
    mute: () => {
      if (muted) return;
      muted = true;
      report(false, null, null);
    },
  };
}

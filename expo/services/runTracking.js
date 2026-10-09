// services/runTracking.js
//
// Keeps GPS flowing into the run tracker (store/runTrackerStore.js) while a
// run is recorded, including when the phone is locked or the app is in the
// background.
//
//   startTracking()  begin delivering readings; call it while the app is open
//                    (pass { label: 'hike' } to name the outing in the Android
//                    "recording" notification)
//   stopTracking()   stop (always call when a run ends)
//
// On a build that has expo-task-manager this uses a background location task
// (iOS "location" background mode, Android foreground service). On an older
// build without it, or on web, it falls back to watching the position while
// the app is open, so the run screen still works everywhere.
//
// This file must be imported once at app start (app/_layout.jsx) because the
// background task has to be registered when the app launches, not when the run
// screen opens.

import * as Location from 'expo-location';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { pauseTimedOut } from '../lib/runTracker';

export const RUN_TRACKING_TASK = 'zown-run-tracking';

let TaskManager = null;
try {
  // Optional: missing from builds made before the native module was added.
  // eslint-disable-next-line global-require
  TaskManager = require('expo-task-manager');
} catch (e) {
  TaskManager = null;
}

let watchSubscription = null;

/** Hands readings to the tracker, or switches GPS off if nothing is recording. */
export function handleLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) return;
  const { tracker, ingest } = useRunTrackerStore.getState();
  // The phone can wake the app for a run that no longer exists (for example
  // after it was closed mid-run). Don't keep the GPS on for nothing.
  if (tracker.status === 'idle' || pauseTimedOut(tracker)) {
    stopTracking();
    return;
  }
  ingest(locations);
}

if (TaskManager) {
  try {
    TaskManager.defineTask(RUN_TRACKING_TASK, ({ data, error }) => {
      if (error) {
        console.warn('Run tracking error:', error.message || error);
        return;
      }
      handleLocations(data && data.locations);
    });
  } catch (e) {
    TaskManager = null;
  }
}

async function isBackgroundTaskRunning() {
  if (!TaskManager) return false;
  try {
    return !!(await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK));
  } catch (e) {
    return false;
  }
}

/**
 * Begins delivering GPS to the tracker. Resolves 'background' or 'foreground'.
 * `label` is what the notification says is being recorded ("Recording your hike").
 */
export async function startTracking({ label = 'run' } = {}) {
  if (await isBackgroundTaskRunning()) return 'background';
  if (watchSubscription) return 'foreground';

  if (TaskManager) {
    try {
      await Location.startLocationUpdatesAsync(RUN_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'ZOWN HQ',
          notificationBody: `Recording your ${label}`,
          notificationColor: '#22C55E',
        },
      });
      return 'background';
    } catch (e) {
      console.warn('Background tracking unavailable, using foreground GPS:', e && e.message);
    }
  }

  watchSubscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
    (location) => handleLocations([location]),
  );
  return 'foreground';
}

/** Stops delivering GPS. Safe to call when nothing is running. */
export async function stopTracking() {
  if (watchSubscription) {
    try { watchSubscription.remove(); } catch (e) { /* already gone */ }
    watchSubscription = null;
  }
  if (!TaskManager) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK)) {
      await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK);
    }
  } catch (e) {
    console.warn('Could not stop run tracking:', e && e.message);
  }
}

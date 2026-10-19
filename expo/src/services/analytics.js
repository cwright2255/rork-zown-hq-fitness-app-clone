// The analytics events the app sends, and how they get to Firebase.
//
// They go through @react-native-firebase/analytics, the phone's own Firebase module (the same family Crashlytics uses, see
// lib/crashReporting.js). This file used to use the web package, firebase/analytics. That one cannot run on a phone: its
// isSupported() is false there, so every event was thrown away without a word.
//
// The module is native, so it is only in a build made after it was added. In an older build, in Expo Go and in tests it is
// missing and everything here does nothing (Expo Go prints the event instead). Logging must never get in the way of the
// screen that asked for it, so nothing in here throws and nothing returns a promise to wait for.
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

let api = null;
let instance = null;
let tried = false;

function load() {
  if (tried) return instance !== null;
  tried = true;
  try {
    // eslint-disable-next-line global-require
    api = require('@react-native-firebase/analytics');
    instance = api.getAnalytics() || null;
  } catch (e) {
    api = null;
    instance = null;
  }
  return instance !== null;
}

// Firebase's own limits: a name of letters, digits and underscores that starts with a letter (40 characters at most), up to
// 25 values on an event, and text of 100 characters at most. A value it would refuse (missing, NaN, a list, an object) is
// left out, so the rest of the event is still sent.
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const MAX_VALUES = 25;
const MAX_TEXT = 100;

function cleanValues(values) {
  const out = {};
  if (!values) return out;
  for (const [key, value] of Object.entries(values)) {
    if (Object.keys(out).length >= MAX_VALUES) break;
    if (!NAME.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, MAX_TEXT);
  }
  return out;
}

// For an event that has no helper below. The helpers are what the screens use.
export const logEvent = (name, values) => {
  if (typeof name !== 'string' || !NAME.test(name)) return;
  const clean = cleanValues(values);
  if (IS_EXPO_GO) {
    console.log('[Analytics]', name, clean);
    return;
  }
  if (!load()) return;
  try {
    api.logEvent(instance, name, clean);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] could not log', name, e?.message);
  }
};

// Ties the events to the signed-in person's Firebase account ID (an opaque id, no name or email; Crashlytics gets the same
// one). Called with nothing when they sign out, so the next person on the phone is not counted as this one.
export const setAnalyticsUser = (uid) => {
  if (IS_EXPO_GO || !load()) return;
  try {
    Promise.resolve(api.setUserId(instance, typeof uid === 'string' && uid ? uid : null)).catch(() => {});
  } catch (e) {
    if (__DEV__) console.warn('[analytics] could not set the user', e?.message);
  }
};

// A workout's id reaches Firebase as text whether the app holds it as a number or a string, so the same workout is the same
// value in every event.
const idOf = (id) => (id === null || id === undefined ? undefined : String(id));

export const logWorkoutStarted = (workoutId, workoutName) =>
  logEvent('workout_started', { workout_id: idOf(workoutId), workout_name: workoutName });

export const logWorkoutCompleted = (
workoutId,
duration,
calories) =>

logEvent('workout_completed', {
  workout_id: idOf(workoutId),
  duration_minutes: duration,
  calories
});

export const logAICoachUsed = (featureType) =>
logEvent('ai_coach_used', { feature_type: featureType });

export const logSpotifyConnected = () => logEvent('spotify_connected');

export const initCrashlytics = () => {
  if (IS_EXPO_GO) {
    console.log('[Crashlytics] no-op in Expo Go');
    return;
  }
};

export const recordError = (err) => {
  if (IS_EXPO_GO) {
    if (__DEV__) console.error('[Crashlytics:noop]', err);
    return;
  }
};

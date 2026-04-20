import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

let analytics = null;

const getAnalytics = async () => {
  if (analytics) return analytics;
  try {
    const { getAnalytics: getFirebaseAnalytics, isSupported } = await import(
      'firebase/analytics'
    );
    const supported = await isSupported();
    if (supported) {
      const app = (await import('../config/firebase')).default;
      analytics = getFirebaseAnalytics(app);
    }
  } catch {}
  return analytics;
};

const logEvent = async (
name,
params) =>
{
  if (IS_EXPO_GO) {
    console.log('[Analytics]', name, params);
    return;
  }
  try {
    const { logEvent: firebaseLogEvent } = await import('firebase/analytics');
    const a = await getAnalytics();
    if (a) firebaseLogEvent(a, name, params);
  } catch {}
};

export const logWorkoutStarted = (workoutId, workoutName) =>
logEvent('workout_started', { workout_id: workoutId, workout_name: workoutName });

export const logWorkoutCompleted = (
workoutId,
duration,
calories) =>

logEvent('workout_completed', {
  workout_id: workoutId,
  duration_minutes: duration,
  calories
});

export const logAICoachUsed = (featureType) =>
logEvent('ai_coach_used', { feature_type: featureType });

export const logSpotifyConnected = () => logEvent('spotify_connected');

export const setUserProperties = (
userId,
fitnessLevel,
goals) =>
{
  console.log('[Analytics] setUserProperties', { userId, fitnessLevel, goals });
};

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
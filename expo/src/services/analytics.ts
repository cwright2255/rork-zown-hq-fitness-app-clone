import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

let analytics: any = null;

const getAnalytics = async (): Promise<any> => {
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
  name: string,
  params?: Record<string, unknown>,
): Promise<void> => {
  if (IS_EXPO_GO) {
    console.log('[Analytics]', name, params);
    return;
  }
  try {
    const { logEvent: firebaseLogEvent } = await import('firebase/analytics');
    const a = await getAnalytics();
    if (a) firebaseLogEvent(a, name, params as any);
  } catch {}
};

export const logWorkoutStarted = (workoutId: string, workoutName: string) =>
  logEvent('workout_started', { workout_id: workoutId, workout_name: workoutName });

export const logWorkoutCompleted = (
  workoutId: string,
  duration: number,
  calories?: number,
) =>
  logEvent('workout_completed', {
    workout_id: workoutId,
    duration_minutes: duration,
    calories,
  });

export const logAICoachUsed = (featureType: string) =>
  logEvent('ai_coach_used', { feature_type: featureType });

export const logSpotifyConnected = () => logEvent('spotify_connected');

export const setUserProperties = (
  userId: string,
  fitnessLevel: string,
  goals: string[],
): void => {
  console.log('[Analytics] setUserProperties', { userId, fitnessLevel, goals });
};

export const initCrashlytics = (): void => {
  if (IS_EXPO_GO) {
    console.log('[Crashlytics] no-op in Expo Go');
    return;
  }
};

export const recordError = (err: Error): void => {
  if (IS_EXPO_GO) {
    if (__DEV__) console.error('[Crashlytics:noop]', err);
    return;
  }
};

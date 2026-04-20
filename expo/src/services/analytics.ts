import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

type Analytics = {
  logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
  setUserProperties: (props: Record<string, string | null>) => Promise<void>;
};

type Crashlytics = {
  recordError: (err: Error) => void;
  setUserId: (id: string) => void;
  log: (msg: string) => void;
};

let analytics: Analytics | null = null;
let crashlytics: Crashlytics | null = null;

async function loadAnalytics(): Promise<void> {
  if (IS_EXPO_GO || analytics) return;
  try {
    // @ts-ignore - optional peer dependency, loaded only when installed
    const mod: any = await import('@react-native-firebase/analytics').catch(() => null);
    if (mod?.default) {
      const inst = mod.default();
      analytics = {
        logEvent: (name, params) => inst.logEvent(name, params ?? {}),
        setUserId: (id) => inst.setUserId(id),
        setUserProperties: (props) => inst.setUserProperties(props),
      };
    }
  } catch {
    analytics = null;
  }
}

async function safeLog(name: string, params?: Record<string, unknown>): Promise<void> {
  await loadAnalytics();
  if (!analytics) {
    if (__DEV__) console.log(`[analytics:noop] ${name}`, params);
    return;
  }
  try {
    await analytics.logEvent(name, params);
  } catch (err) {
    if (__DEV__) console.warn('analytics.logEvent failed', err);
  }
}

export const logWorkoutStarted = (workoutId: string, name: string) =>
  safeLog('workout_started', { workout_id: workoutId, workout_name: name });

export const logWorkoutCompleted = (workoutId: string, durationMinutes: number) =>
  safeLog('workout_completed', { workout_id: workoutId, duration_minutes: durationMinutes });

export const logAICoachUsed = (type: string) =>
  safeLog('ai_coach_used', { recommendation_type: type });

export const logSpotifyConnected = () => safeLog('spotify_connected');

export async function setUserProperties(
  userId: string | null,
  properties: Record<string, string | null> = {},
): Promise<void> {
  await loadAnalytics();
  if (!analytics) return;
  try {
    await analytics.setUserId(userId);
    if (Object.keys(properties).length > 0) {
      await analytics.setUserProperties(properties);
    }
  } catch (err) {
    if (__DEV__) console.warn('setUserProperties failed', err);
  }
}

export async function initCrashlytics(): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    // @ts-ignore - optional peer dependency, loaded only when installed
    const mod: any = await import('@react-native-firebase/crashlytics').catch(() => null);
    if (mod?.default) {
      const inst = mod.default();
      crashlytics = {
        recordError: (err) => inst.recordError(err),
        setUserId: (id) => inst.setUserId(id),
        log: (msg) => inst.log(msg),
      };
      await inst.setCrashlyticsCollectionEnabled(true);
    }
  } catch {
    crashlytics = null;
  }
}

export function recordError(err: Error): void {
  if (crashlytics) crashlytics.recordError(err);
  else if (__DEV__) console.error('[crashlytics:noop]', err);
}

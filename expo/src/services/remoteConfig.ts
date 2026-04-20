import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export interface FeatureFlags {
  aiCoachEnabled: boolean;
  spotifyEnabled: boolean;
  newWorkoutUIEnabled: boolean;
}

const DEFAULTS: FeatureFlags = {
  aiCoachEnabled: true,
  spotifyEnabled: true,
  newWorkoutUIEnabled: false,
};

let remoteConfig: any = null;

export const fetchAndActivate = async (): Promise<void> => {
  if (IS_EXPO_GO) return;
  try {
    const { getRemoteConfig, fetchAndActivate: firebaseFetchAndActivate } =
      await import('firebase/remote-config');
    const app = (await import('../config/firebase')).default;
    remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
    remoteConfig.defaultConfig = DEFAULTS as any;
    await firebaseFetchAndActivate(remoteConfig);
  } catch {}
};

export const getFeatureFlag = <K extends keyof FeatureFlags>(
  key: K,
  defaultValue?: FeatureFlags[K],
): FeatureFlags[K] => {
  if (!remoteConfig) return (DEFAULTS[key] ?? defaultValue) as FeatureFlags[K];
  try {
    const { getValue } = require('firebase/remote-config');
    return getValue(remoteConfig, key as string).asBoolean() as FeatureFlags[K];
  } catch {
    return (DEFAULTS[key] ?? defaultValue) as FeatureFlags[K];
  }
};

export const getAllFeatureFlags = (): FeatureFlags => ({ ...DEFAULTS });

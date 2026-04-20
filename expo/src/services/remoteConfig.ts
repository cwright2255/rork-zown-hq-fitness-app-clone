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

let loaded: FeatureFlags = { ...DEFAULTS };
let initialized = false;
let remoteConfig: any = null;

export async function fetchAndActivate(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (IS_EXPO_GO) {
    loaded = { ...DEFAULTS };
    return;
  }
  try {
    // @ts-ignore - optional peer dependency, loaded only when installed
    const mod: any = await import('@react-native-firebase/remote-config').catch(() => null);
    if (!mod?.default) {
      loaded = { ...DEFAULTS };
      return;
    }
    remoteConfig = mod.default();
    await remoteConfig.setDefaults({
      aiCoachEnabled: DEFAULTS.aiCoachEnabled,
      spotifyEnabled: DEFAULTS.spotifyEnabled,
      newWorkoutUIEnabled: DEFAULTS.newWorkoutUIEnabled,
    });
    await remoteConfig.setConfigSettings({ minimumFetchIntervalMillis: 60 * 60 * 1000 });
    await remoteConfig.fetchAndActivate();

    loaded = {
      aiCoachEnabled: remoteConfig.getValue('aiCoachEnabled').asBoolean(),
      spotifyEnabled: remoteConfig.getValue('spotifyEnabled').asBoolean(),
      newWorkoutUIEnabled: remoteConfig.getValue('newWorkoutUIEnabled').asBoolean(),
    };
  } catch {
    loaded = { ...DEFAULTS };
  }
}

export function getFeatureFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return loaded[key];
}

export function getAllFeatureFlags(): FeatureFlags {
  return { ...loaded };
}

import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

const DEFAULTS = {
  aiCoachEnabled: true,
  spotifyEnabled: true,
  newWorkoutUIEnabled: false
};

let remoteConfig = null;

export const fetchAndActivate = async () => {
  if (IS_EXPO_GO) return;
  try {
    const { getRemoteConfig, fetchAndActivate: firebaseFetchAndActivate } =
    await import('firebase/remote-config');
    const app = (await import('../config/firebase')).default;
    remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
    remoteConfig.defaultConfig = DEFAULTS;
    await firebaseFetchAndActivate(remoteConfig);
  } catch {}
};

export const getFeatureFlag = (
key,
defaultValue) =>
{
  if (!remoteConfig) return DEFAULTS[key] ?? defaultValue;
  try {
    const { getValue } = require('firebase/remote-config');
    return getValue(remoteConfig, key).asBoolean();
  } catch {
    return DEFAULTS[key] ?? defaultValue;
  }
};

export const getAllFeatureFlags = () => ({ ...DEFAULTS });
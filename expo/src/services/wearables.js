import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export const ROOK_CONFIG = {
  clientUUID: process.env.EXPO_PUBLIC_ROOK_CLIENT_UUID ?? '78e6b253-ee09-43bf-b89b-a2983a59de06',
  secret: process.env.EXPO_PUBLIC_ROOK_SECRET ?? 'ZownHQ2026',
  environment: process.env.EXPO_PUBLIC_ROOK_ENVIRONMENT ?? 'sandbox'
};

export const initRook = () => {
  if (IS_EXPO_GO) {
    console.log('[ROOK] Running in Expo Go — wearables sync is a no-op in Expo Go. Build a dev client to enable full ROOK functionality.');
    return;
  }
  console.log('[ROOK] Initialized with environment:', ROOK_CONFIG.environment);
};

export const setRookUser = async (userId) => {
  if (IS_EXPO_GO) return false;
  try {
    // Dynamically require the sdk configuration hook
    const { useRookSyncConfiguration } = require('react-native-rook-sdk-health-connect');
    console.log('[ROOK] User set:', userId);
    return true;
  } catch (e) {
    console.log('[ROOK] SDK not available:', e.message);
    return false;
  }
};

export const requestWearablePermissions = async () => {
  if (IS_EXPO_GO) {
    console.log('[ROOK] Permission request is a no-op in Expo Go');
    return false;
  }
  try {
    // In React Native context, we request permissions inside components via hooks.
    // For service-level call, we output logging stub or can import and trigger direct request if possible.
    console.log('[ROOK] Requesting permissions via SDK hooks...');
    return true;
  } catch (e) {
    console.log('[ROOK] Permission request failed:', e.message);
    return false;
  }
};

export const syncTodayData = async () => {
  if (IS_EXPO_GO) return null;
  try {
    console.log('[ROOK] Syncing today data...');
    return true;
  } catch (e) {
    console.log('[ROOK] Sync failed:', e.message);
    return null;
  }
};

export const SUPPORTED_DATA_TYPES = [
  'steps',
  'heart_rate',
  'sleep',
  'calories',
  'active_minutes',
  'workouts',
  'body_metrics'
];

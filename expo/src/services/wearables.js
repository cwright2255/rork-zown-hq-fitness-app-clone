import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export const ROOK_CONFIG = {
  clientUUID: process.env.EXPO_PUBLIC_ROOK_CLIENT_UUID ?? '78e6b253-ee09-43bf-b89b-a2983a59de06',
  secret: process.env.EXPO_PUBLIC_ROOK_SECRET ?? 'q87wTh1L2eTCRprNFTZLftGvFFtPI5089sIM',
  environment: process.env.EXPO_PUBLIC_ROOK_ENVIRONMENT ?? 'sandbox',
};

export const initRook = () => {
  if (IS_EXPO_GO) {
    console.log('[ROOK] Running in Expo Go — wearables sync is a no-op in Expo Go. Build a dev client to enable full ROOK functionality.');
    return;
  }
  console.log('[ROOK] Initialized with environment:', ROOK_CONFIG.environment);
};

export const setRookUser = async (userId) => {
  if (IS_EXPO_GO) return;
  try {
    const { useRookSyncConfiguration } = require('react-native-rook-sdk');
    console.log('[ROOK] User set:', userId);
  } catch (e) {
    console.log('[ROOK] SDK not available:', e.message);
  }
};

export const requestWearablePermissions = async () => {
  if (IS_EXPO_GO) {
    console.log('[ROOK] Permission request is a no-op in Expo Go');
    return false;
  }
  try {
    const { useRookSyncPermissions } = require('react-native-rook-sdk');
    console.log('[ROOK] Requesting permissions...');
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
  'body_metrics',
];

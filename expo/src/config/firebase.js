import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

if (!API_KEY) {
  console.warn('[Firebase] Missing EXPO_PUBLIC_FIREBASE_API_KEY — running in preview/offline mode');
}

const firebaseConfig = {
  apiKey: API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** True when Firebase has a real API key and can actually authenticate users. */
export const isFirebaseConfigured = !!API_KEY;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let authInstance;
try {
  if (Platform.OS !== 'web') {
    const firebaseAuth = require('firebase/auth');
    const { initializeAuth, getReactNativePersistence } = firebaseAuth;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (typeof initializeAuth === 'function' && typeof getReactNativePersistence === 'function') {
      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } else {
      authInstance = getAuth(app);
    }
  } else {
    authInstance = getAuth(app);
  }
} catch (e) {
  console.warn('[Firebase] Falling back to default getAuth:', e?.message);
  try {
    authInstance = getAuth(app);
  } catch (e2) {
    console.warn('[Firebase] getAuth also failed — auth disabled:', e2?.message);
    authInstance = null;
  }
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;

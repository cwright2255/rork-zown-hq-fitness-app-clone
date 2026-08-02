import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Real fix: this previously hardcoded a Firebase config directly in
// source, never reading the EXPO_PUBLIC_FIREBASE_* environment variables
// that eas.json's build profiles and the GitHub Actions secrets were
// actually set up to provide. Two real problems with that: the hardcoded
// appId ("...:web:...") was registered as a Firebase web app, not iOS,
// while eas.json's env-provided appId is the correct iOS registration
// ("...:ios:..."); and the hardcoded apiKey didn't match the one in
// eas.json at all. Using the wrong app registration's key from a native
// build is a real, documented source of auth/invalid-credential errors,
// separate from the credentials someone actually types in.
// The hardcoded values are kept as fallbacks (not removed) so this still
// works in Expo Go or local dev where these env vars may not be set.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBK867YDgtUxrY03-uf5qi5g3ZE_7gMJG8",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "zown-3c512.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "zown-3c512",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "zown-3c512.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "431690627943",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:431690627943:web:2bf506340a081bec99cdc2",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-F86JQ2XEFD",
};

/** True when Firebase has a real API key and can actually authenticate users. */
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let authInstance;
try {
  if (Platform.OS !== 'web') {
    const firebaseAuth = require('firebase/auth');
    const { initializeAuth, getReactNativePersistence } = firebaseAuth;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (typeof initializeAuth === 'function' && typeof getReactNativePersistence === 'function') {
      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
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
    console.warn('[Firebase] getAuth also failed - auth disabled:', e2?.message);
    authInstance = null;
  }
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;

import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBK867YDgtUxrY03-uf5qi5g3ZE_7gMJG8",
  authDomain: "zown-3c512.firebaseapp.com",
  projectId: "zown-3c512",
  storageBucket: "zown-3c512.firebasestorage.app",
  messagingSenderId: "431690627943",
  appId: "1:431690627943:web:2bf506340a081bec99cdc2",
  measurementId: "G-F86JQ2XEFD",
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

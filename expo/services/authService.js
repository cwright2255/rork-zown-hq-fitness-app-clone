import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

const buildUserShape = (fbUser, overrides = {}) => {
  const email = overrides.email || fbUser?.email || 'user@example.com';
  const name = overrides.name || fbUser?.displayName || (email ? email.split('@')[0] : 'User');
  return {
    id: overrides.id || fbUser?.uid || Math.random().toString(36).slice(2, 11),
    name,
    email,
    profileImage: overrides.profileImage || fbUser?.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    joinDate: new Date().toISOString(),
    fitnessLevel: overrides.fitnessLevel || 'beginner',
    goals: overrides.goals || [],
    exp: 0,
    level: 1,
    expToNextLevel: 100,
    streak: 0,
    streakData: { currentStreak: 0, longestStreak: 0, streakDates: [] },
    preferences: {
      units: 'metric',
      notifications: { workouts: true, nutrition: true, social: true },
      privacy: { profileVisible: true, shareProgress: true }
    },
    fitnessMetrics: { weight: 0, height: 0, bodyFat: 0, muscleMass: 0 },
    expSystem: {
      totalExp: 0,
      level: 1,
      expToNextLevel: 100,
      expSources: { workouts: 0, nutrition: 0, social: 0 },
      levelRequirements: { 1: 0, 2: 100, 3: 300, 4: 700, 5: 1200 }
    },
    xp: 0,
    subscription: {
      tier: 'free',
      status: 'active',
      startDate: new Date().toISOString(),
      autoRenew: false
    }
  };
};

const mapFirebaseAuthError = (error) => {
  const code = error?.code || '';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return new Error('Invalid email or password');
  }
  if (code === 'auth/invalid-email') return new Error('Please enter a valid email address');
  if (code === 'auth/email-already-in-use') return new Error('An account with that email already exists');
  if (code === 'auth/weak-password') return new Error('Password is too weak - use at least 6 characters');
  if (code === 'auth/too-many-requests') return new Error('Too many attempts. Please wait and try again.');
  if (code === 'auth/network-request-failed') return new Error('Network error. Check your connection and try again.');
  return new Error(error?.message || 'Authentication failed');
};

class AuthService {
  async login(email, password) {
    try {
      const { isFirebaseConfigured, auth } = require('../src/config/firebase');
      if (!isFirebaseConfigured || !auth) {
        console.warn('[AuthService] Firebase not configured - using offline login');
        const user = buildUserShape(null, { email, name: email.split('@')[0] });
        const token = 'offline-session-' + Date.now();
        await this._storeToken(token);
        return { user, token, requiresMFA: false };
      }
      const { signInWithEmailAndPassword } = require('firebase/auth');

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      const user = buildUserShape(fbUser, { email: fbUser.email || email });
      const token = await fbUser.getIdToken().catch(() => 'firebase-session');
      await this._storeToken(token);

      return {
        user,
        token,
        requiresMFA: false
      };
    } catch (error) {
      console.error('[AuthService] Login error:', error?.code, error?.message);
      throw mapFirebaseAuthError(error);
    }
  }

  async register(name, email, password) {
    try {
      const { isFirebaseConfigured, auth } = require('../src/config/firebase');
      if (!isFirebaseConfigured || !auth) {
        console.warn('[AuthService] Firebase not configured - using offline registration');
        const user = buildUserShape(null, { email, name: name || email.split('@')[0] });
        const token = 'offline-session-' + Date.now();
        await this._storeToken(token);
        return { user, token, requiresMFA: false };
      }
      const { createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      if (name && fbUser) {
        try {
          await updateProfile(fbUser, { displayName: name });
        } catch (e) {
          console.log('[AuthService] updateProfile failed (non-fatal):', e?.message);
        }
      }

      const user = buildUserShape(fbUser, { name, email: fbUser.email || email });
      const token = await fbUser.getIdToken().catch(() => 'firebase-session');
      await this._storeToken(token);

      return { user, token };
    } catch (error) {
      console.error('[AuthService] Register error:', error?.code, error?.message);
      throw mapFirebaseAuthError(error);
    }
  }

  async sendPasswordReset(email) {
    try {
      const { isFirebaseConfigured, auth } = require('../src/config/firebase');
      if (!isFirebaseConfigured || !auth) {
        console.warn('[AuthService] Firebase not configured - password reset unavailable');
        throw new Error('Password reset is not available in preview mode');
      }
      const { sendPasswordResetEmail } = require('firebase/auth');
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      console.error('[AuthService] Password reset error:', error?.code, error?.message);
      throw mapFirebaseAuthError(error);
    }
  }

  async loginWithProvider(provider) {
    if (IS_EXPO_GO && (provider === 'apple' || provider === 'google' || provider === 'meta')) {
      throw new Error(
        `${provider} Sign-In is not available in Expo Go. Please build a dev client or use email/password.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    const displayName = provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Meta';
    const user = buildUserShape(null, {
      id: `${provider}-${Math.random().toString(36).slice(2, 10)}`,
      name: `${displayName} User`,
      email: `${provider}.user@example.com`,
      profileImage: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=150&h=150&fit=crop&crop=faces'
    });
    const token = `${provider}-mock-token`;
    await this._storeToken(token);
    return { user, token };
  }

  async verifyMFA(email, code) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (code !== '123456') {
        throw new Error('Invalid MFA code');
      }
      const user = buildUserShape(null, { email, name: email.split('@')[0] });
      const token = 'mfa-session-token';
      await this._storeToken(token);
      return { user, token };
    } catch {
      throw new Error('MFA verification failed');
    }
  }

  async logout() {
    try {
      console.log('[AuthService] Logging out - clearing auth token');
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('auth_token_issued_at');

      try {
        const { signOut } = require('firebase/auth');
        const { auth } = require('../src/config/firebase');
        if (auth?.currentUser) {
          await signOut(auth);
        }
      } catch (e) {
        console.log('[AuthService] Firebase signOut skipped:', e?.message);
      }

      console.log('[AuthService] Auth token cleared successfully');
    } catch (error) {
      console.error('[AuthService] Failed to clear auth token:', error);
      throw error;
    }
  }

  async getStoredToken() {
    return await AsyncStorage.getItem('auth_token');
  }

  // Stores the token alongside the moment it was issued - isAuthenticated()
  // below is what actually uses that timestamp to decide whether a
  // "remembered" session has expired.
  async _storeToken(token) {
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_token_issued_at', new Date().toISOString());
  }

  // Session length is user-configurable (Settings     Account     "Keep me
  // signed in") rather than hardcoded, so this reads the live setting
  // rather than assuming a fixed duration. Reading Zustand state directly
  // here (outside a React component) is the same pattern used elsewhere
  // in this app for cross-store reads - see e.g. useWorkoutStore.getState()
  // calls in app/workout/active.jsx.
  async isAuthenticated() {
    const token = await this.getStoredToken();
    if (!token) return false;

    let duration = 'indefinite';
    try {
      const { useSettingsStore } = require('@/store/settingsStore');
      duration = useSettingsStore.getState().rememberMeDuration || 'indefinite';
    } catch (e) {
      // Settings store not ready yet (e.g. very first cold start before
      // persisted state rehydrates) - fail open to "indefinite" rather
      // than logging a real, valid session out over a timing race.
    }

    if (duration === 'indefinite') return true;

    const issuedAtRaw = await AsyncStorage.getItem('auth_token_issued_at');
    if (!issuedAtRaw) {
      // A token exists but predates this feature (no timestamp was ever
      // recorded for it) - treat as freshly issued rather than
      // immediately expiring a session that was working fine yesterday.
      await AsyncStorage.setItem('auth_token_issued_at', new Date().toISOString());
      return true;
    }

    const issuedAt = new Date(issuedAtRaw).getTime();
    const maxAgeMs = duration === '1month'
      ? 30 * 24 * 60 * 60 * 1000
      : duration === '3months'
        ? 90 * 24 * 60 * 60 * 1000
        : Infinity;

    const expired = Date.now() - issuedAt > maxAgeMs;
    if (expired) {
      await this.logout();
      return false;
    }
    return true;
  }
}

export const authService = new AuthService();

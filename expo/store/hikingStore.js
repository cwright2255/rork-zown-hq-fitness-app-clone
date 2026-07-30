// store/hikingStore.js
//
// Real nearby-trail state: gets the user's actual GPS position (same
// expo-location pattern already used in app/running/active.jsx), searches
// real trails around it via services/hikingService.js, and optionally
// saves favorites per user (Firestore, same users/{uid}/data/{key}
// pattern already covered by the app's existing security rules).

import { create } from 'zustand';
import * as Location from 'expo-location';
import { searchNearbyTrails } from '@/services/hikingService';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useHikingStore = create((set, get) => ({
  trails: [],
  userLocation: null,
  isLoading: false,
  error: null,
  savedTrailIds: [],
  completedHikes: [],

  // Real location permission + real GPS fix — not a default/assumed
  // location. Returns null (rather than throwing) if permission is
  // denied, so the screen can show a real "enable location" state.
  loadNearbyTrails: async (radiusMeters = 24000) => {
    set({ isLoading: true, error: null });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ isLoading: false, error: 'location_permission_denied' });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      set({ userLocation });

      const trails = await searchNearbyTrails({ ...userLocation, radiusMeters });
      // Closest first — this is a "near you" feature, distance is the
      // primary sort, not an afterthought.
      trails.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      set({ trails, isLoading: false });
    } catch (e) {
      console.warn('[hikingStore] loadNearbyTrails error:', e?.message);
      set({ error: e?.message, isLoading: false });
    }
  },

  loadSavedTrails: async (uid) => {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'data', 'savedTrails'));
      if (snap.exists()) set({ savedTrailIds: snap.data().trailIds || [] });
    } catch (e) {
      console.warn('[hikingStore] loadSavedTrails error:', e?.message);
    }
  },

  toggleSaveTrail: (trailId, uid) => {
    set((s) => ({
      savedTrailIds: s.savedTrailIds.includes(trailId)
        ? s.savedTrailIds.filter((id) => id !== trailId)
        : [...s.savedTrailIds, trailId],
    }));
    if (uid) {
      setDoc(doc(db, 'users', uid, 'data', 'savedTrails'), {
        trailIds: get().savedTrailIds,
      }, { merge: true }).catch((e) => console.warn('[hikingStore] save failed:', e?.message));
    }
  },

  loadCompletedHikes: async (uid) => {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'data', 'hikes'));
      if (snap.exists()) set({ completedHikes: snap.data().hikes || [] });
    } catch (e) {
      console.warn('[hikingStore] loadCompletedHikes error:', e?.message);
    }
  },

  // Real completed hike, computed from an actual tracked session (see
  // app/running/hiking/monitor.jsx) — distance and elevation gain from
  // real GPS data, difficulty from the verified Shenandoah formula, not
  // fabricated or estimated after the fact.
  addCompletedHike: (hike, uid) => {
    const record = { ...hike, id: `hike-${Date.now()}`, completedAt: new Date().toISOString() };
    set((s) => ({ completedHikes: [...s.completedHikes, record] }));
    if (uid) {
      setDoc(doc(db, 'users', uid, 'data', 'hikes'), {
        hikes: get().completedHikes.slice(-200),
      }, { merge: true }).catch((e) => console.warn('[hikingStore] hike save failed:', e?.message));
    }
    return record;
  },

  getTrailById: (id) => get().trails.find((t) => t.id === id) || null,
}));

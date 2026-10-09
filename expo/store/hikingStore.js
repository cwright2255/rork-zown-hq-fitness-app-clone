// store/hikingStore.js
//
// Real nearby-trail state: gets the user's actual GPS position (same
// expo-location pattern already used in app/running/active.jsx), searches
// real trails around it via services/hikingService.js, and optionally
// saves favorites per user (Firestore, same users/{uid}/data/{key}
// pattern already covered by the app's existing security rules).
//
// Completed hikes are kept on the phone as well as in Firestore, because a
// hike very often ends at a trailhead with no signal: the hike (with the route
// walked) must survive the app being closed before it can be uploaded, and is
// sent up the next time hikes are loaded. See lib/hikeLog.js for the record.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { searchNearbyTrails } from '@/services/hikingService';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  MAX_SAVED_HIKES, buildSavedHike, fitHikesToSize, keepNewestHikes, mergeHikes,
} from '../lib/hikeLog';

export const useHikingStore = create(
  persist(
    (set, get) => ({
      trails: [],
      userLocation: null,
      isLoading: false,
      error: null,
      savedTrailIds: [],
      // Whose list savedTrailIds is. The list stays on the phone so saved trails
      // still show with no signal; this keeps one person's list from showing up
      // for someone else who signs in on the same phone.
      savedTrailsUid: null,
      // Oldest first (a new hike goes on the end). Screens sort for display.
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
        const owner = get().savedTrailsUid;
        if (owner && owner !== uid) set({ savedTrailIds: [], savedTrailsUid: uid });
        else if (!owner) set({ savedTrailsUid: uid });
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
          savedTrailsUid: uid || s.savedTrailsUid,
        }));
        if (uid) {
          setDoc(doc(db, 'users', uid, 'data', 'savedTrails'), {
            trailIds: get().savedTrailIds,
          }, { merge: true }).catch((e) => console.warn('[hikingStore] save failed:', e?.message));
        }
      },

      // The hikes from Firestore, together with any finished on this phone that
      // have not reached Firestore yet (no signal at the trailhead): those must
      // not be wiped by the older list from the server, and are sent up again.
      // Only this user's own hikes are kept from the phone, so a second person
      // signing in on the same phone does not see the first person's hikes.
      loadCompletedHikes: async (uid) => {
        if (!uid) return;
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'hikes'));
          const server = snap.exists() && Array.isArray(snap.data().hikes) ? snap.data().hikes : [];
          const onServer = new Set(server.filter(Boolean).map((h) => String(h.id)));
          const mine = get().completedHikes.filter((h) => h && h.uid === uid);
          const unsynced = mine.filter((h) => !onServer.has(String(h.id)));
          set({ completedHikes: mergeHikes(server, mine) });
          if (unsynced.length > 0) get()._persistHikes(uid);
        } catch (e) {
          console.warn('[hikingStore] loadCompletedHikes error:', e?.message);
        }
      },

      _persistHikes: async (uid) => {
        if (!uid) return;
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'hikes'), {
            hikes: fitHikesToSize(get().completedHikes),
          }, { merge: true });
        } catch (e) {
          console.warn('[hikingStore] hike save failed:', e?.message);
        }
      },

      // Real completed hike, computed from an actual tracked session (see
      // app/running/hiking/monitor.jsx) — distance and elevation gain from
      // real GPS data, difficulty from the verified Shenandoah formula, not
      // fabricated or estimated after the fact. The route walked is kept with
      // it (lib/hikeLog.js buildSavedHike). Returns the saved record.
      addCompletedHike: (hike, uid) => {
        const record = buildSavedHike(hike, { uid });
        set((s) => ({ completedHikes: keepNewestHikes([...s.completedHikes, record]) }));
        get()._persistHikes(uid);
        return record;
      },

      // Remembers which feed post a hike was shared as, so the same hike is not
      // posted twice. Returns true when the hike was found.
      markHikeShared: (uid, hikeId, postId) => {
        if (hikeId === undefined || hikeId === null || !postId) return false;
        let found = false;
        const completedHikes = get().completedHikes.map((h) => {
          if (!h || String(h.id) !== String(hikeId)) return h;
          found = true;
          return { ...h, sharedPostId: String(postId) };
        });
        if (!found) return false;
        set({ completedHikes });
        get()._persistHikes(uid);
        return true;
      },

      // The post a hike was shared as has been deleted: the hike can be shared again.
      forgetSharedPost: (uid, postId) => {
        if (!postId) return false;
        let changed = false;
        const completedHikes = get().completedHikes.map((h) => {
          if (!h || String(h.sharedPostId || '') !== String(postId)) return h;
          changed = true;
          const { sharedPostId, ...rest } = h;
          return rest;
        });
        if (!changed) return false;
        set({ completedHikes });
        get()._persistHikes(uid);
        return true;
      },

      getTrailById: (id) => get().trails.find((t) => t.id === id) || null,
      getHikeById: (id) => get().completedHikes.find((h) => h && String(h.id) === String(id)) || null,
    }),
    {
      name: 'hiking-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // The hikes and the saved trail ids: trails and the search are looked up
      // fresh each time (the ones that matter offline are kept by
      // store/offlineTrailStore.js).
      partialize: (s) => ({
        completedHikes: s.completedHikes.slice(-MAX_SAVED_HIKES),
        savedTrailIds: s.savedTrailIds,
        savedTrailsUid: s.savedTrailsUid,
      }),
    },
  ),
);

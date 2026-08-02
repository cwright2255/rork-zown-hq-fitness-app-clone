// store/bodyCompositionStore.js
//
// Real scan history, persisted per logged-in user in Firestore. Each scan
// stores the estimated measurements + body-fat estimate (see
// services/bodyCompositionService.js for the math and why it no longer
// depends on Meshcapade/SMPL) plus the mannequin sizing parameters used to
// drive the procedural 3D viewer.
//
// Collection: users/{uid}/bodyScans/{scanId} — see the firestore.rules
// addition alongside this store.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { runLocalBodyScan } from '@/services/bodyCompositionService';
import { generateBodyCompositionInsight } from '@/services/aiService';

export const useBodyCompositionStore = create((set, get) => ({
  scans: [],
  isLoading: false,
  isScanning: false,
  error: null,
  latestInsight: null,

  loadScans: async (uid) => {
    if (!uid) return;
    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, 'users', uid, 'bodyScans'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const scans = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(); // oldest -> newest for trend charts
      set({ scans });
    } catch (e) {
      console.error('[bodyCompositionStore] loadScans error:', e?.message);
      set({ error: e?.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // Takes pose landmarks already extracted by the capture screen (front
  // required, side optional) plus the profile inputs the estimation math
  // needs, runs the local estimation pipeline (no network call for the
  // scan itself — only the AI commentary call touches the network), and
  // persists the result to Firestore.
  runScan: async ({ uid, frontLandmarks, rightLandmarks, leftLandmarks, heightCm, neckCm, gender, age, weightKg, goal }) => {
    set({ isScanning: true, error: null });
    try {
      const result = runLocalBodyScan({ frontLandmarks, rightLandmarks, leftLandmarks, heightCm, neckCm, gender });

      // BMI is a trivial, well-known calculation once we have both height
      // and weight — a useful secondary number alongside the estimated
      // body-fat %, not a replacement for it.
      const bmi = heightCm && weightKg
        ? Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10
        : null;

      const scanRecord = {
        measurements: result.measurements,
        bodyFatPercent: result.bodyFatPercent,
        method: result.method,
        heightCm,
        weightKg: weightKg ?? null,
        age: age ?? null,
        bmi,
        gender: gender ?? null,
        createdAt: serverTimestamp(),
        createdAtLocal: new Date().toISOString(),
      };

      let savedId = null;
      if (uid) {
        const ref = await addDoc(collection(db, 'users', uid, 'bodyScans'), scanRecord);
        savedId = ref.id;
      }

      const saved = { ...scanRecord, id: savedId ?? `local-${Date.now()}` };
      set((state) => ({ scans: [...state.scans, saved] }));

      const trendScans = get().scans.map((s) => ({
        date: s.createdAtLocal,
        measurements: s.measurements,
        bodyFatPercent: s.bodyFatPercent,
        weightKg: s.weightKg,
        bmi: s.bmi,
      }));
      const insight = await generateBodyCompositionInsight({ goal, age, scans: trendScans });
      set({ latestInsight: insight });

      return { scan: saved, insight };
    } catch (e) {
      console.error('[bodyCompositionStore] runScan error:', e?.message);
      set({ error: e?.message });
      throw e;
    } finally {
      set({ isScanning: false });
    }
  },

  getLatestScan: () => {
    const { scans } = get();
    return scans.length ? scans[scans.length - 1] : null;
  },

  getComparisonPair: (daysAgo = 30) => {
    const { scans } = get();
    if (scans.length < 2) return null;
    const latest = scans[scans.length - 1];
    const targetTime = new Date(latest.createdAtLocal).getTime() - daysAgo * 86400000;
    let closest = scans[0];
    let closestDiff = Infinity;
    for (const s of scans) {
      const diff = Math.abs(new Date(s.createdAtLocal).getTime() - targetTime);
      if (diff < closestDiff && s.id !== latest.id) {
        closest = s;
        closestDiff = diff;
      }
    }
    return { latest, previous: closest };
  },
}));

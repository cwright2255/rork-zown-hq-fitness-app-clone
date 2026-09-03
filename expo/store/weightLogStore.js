// store/weightLogStore.js
//
// Standalone weight-over-time log, separate from bodyCompositionStore's
// scans (a scan captures weight as one input among several measurements;
// this is the lightweight "just log today's weight" flow, used far more
// often than a full scan). Same collection convention as bodyScans:
// nested under users/{uid}, write-once history (see firestore.rules).
import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp,
} from 'firebase/firestore';

export const useWeightLogStore = create((set, get) => ({
  logs: [],
  isLoading: false,
  error: null,

  loadLogs: async (uid) => {
    if (!uid) return;
    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, 'users', uid, 'weightLogs'),
        orderBy('createdAt', 'desc'),
        limit(52) // roughly a year of weekly entries; plenty for a trend chart
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(); // oldest -> newest for charting
      set({ logs });
    } catch (e) {
      console.error('[weightLogStore] loadLogs error:', e?.message);
      set({ error: e?.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addLog: async (uid, weightKg) => {
    if (!uid) throw new Error('Not authenticated');
    if (!weightKg || Number.isNaN(weightKg)) throw new Error('Invalid weight');
    const ref = await addDoc(collection(db, 'users', uid, 'weightLogs'), {
      weightKg,
      createdAt: serverTimestamp(),
      createdAtLocal: new Date().toISOString(),
    });
    const newLog = { id: ref.id, weightKg, createdAtLocal: new Date().toISOString() };
    set((state) => ({ logs: [...state.logs, newLog] }));
    return newLog;
  },
}));

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      notifications: true,
      darkMode: false,
      units: 'imperial',
      language: 'en',
      privacy: { profilePublic: true, activitySharing: true },
      isLoading: false,

      loadSettings: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'settings'));
          if (snap.exists()) {
            const d = snap.data();
            set({
              notifications: d.notifications !== undefined ? d.notifications : true,
              darkMode: d.darkMode || false,
              units: d.units || 'imperial',
              language: d.language || 'en',
              privacy: d.privacy || { profilePublic: true, activitySharing: true },
            });
          }
        } catch (e) {
          console.warn('[settingsStore] loadSettings error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      _persist: async (uid) => {
        if (!uid) return;
        const s = get();
        try {
          await setDoc(doc(db, 'users', uid, 'data', 'settings'), {
            notifications: s.notifications,
            darkMode: s.darkMode,
            units: s.units,
            language: s.language,
            privacy: s.privacy,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('[settingsStore] _persist error:', e?.message);
        }
      },

      updateSetting: (key, value, uid) => {
        set({ [key]: value });
        get()._persist(uid);
      },

      updatePrivacy: (key, value, uid) => {
        set((s) => ({ privacy: { ...s.privacy, [key]: value } }));
        get()._persist(uid);
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        notifications: s.notifications,
        darkMode: s.darkMode,
        units: s.units,
        language: s.language,
        privacy: s.privacy,
      }),
    }
  )
);

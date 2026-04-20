import { useCallback } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../types/firestore';

export function useUserProfile() {
  const user = useAuthStore((s) => s.user);

  const getProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      photoURL: data.photoURL,
      fitnessLevel: data.fitnessLevel ?? 'beginner',
      goals: data.goals ?? [],
      weight: data.weight,
      height: data.height,
      age: data.age,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    };
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) throw new Error('Not authenticated');
      await updateDoc(doc(db, 'users', user.uid), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    [user],
  );

  const createProfile = useCallback(async (uid: string, profile: Partial<UserProfile>) => {
    await setDoc(doc(db, 'users', uid), {
      ...profile,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  return { profile: user, getProfile, updateProfile, createProfile };
}

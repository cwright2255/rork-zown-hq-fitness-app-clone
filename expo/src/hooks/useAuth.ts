import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { onAuthStateChanged } from '../services/auth';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../types/firestore';

export function useAuth() {
  const { user, isAuthenticated, isLoading, error, setUser, setLoading, setError } =
    useAuthStore();

  useEffect(() => {
    setLoading(true);
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged((fbUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!fbUser) {
        setUser(null);
        return;
      }

      const ref = doc(db, 'users', fbUser.uid);
      unsubscribeProfile = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setUser(null);
            return;
          }
          const data = snap.data() as Record<string, unknown>;
          const profile: UserProfile = {
            uid: fbUser.uid,
            email: (data.email as string) ?? fbUser.email ?? '',
            displayName:
              (data.displayName as string) ?? fbUser.displayName ?? '',
            photoURL: (data.photoURL as string) ?? fbUser.photoURL ?? undefined,
            fitnessLevel:
              (data.fitnessLevel as UserProfile['fitnessLevel']) ?? 'beginner',
            goals: (data.goals as UserProfile['goals']) ?? [],
            weight: data.weight as number | undefined,
            height: data.height as number | undefined,
            age: data.age as number | undefined,
            createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
            updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
          };
          setUser(profile);
        },
        (err) => setError(err.message),
      );
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [setUser, setLoading, setError]);

  return { user, isAuthenticated, isLoading, error };
}

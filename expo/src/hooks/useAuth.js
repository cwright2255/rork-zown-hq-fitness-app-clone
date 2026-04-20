import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { onAuthStateChanged } from '../services/auth';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, isAuthenticated, isLoading, error, setUser, setLoading, setError } =
  useAuthStore();

  useEffect(() => {
    setLoading(true);
    let unsubscribeProfile = null;

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
          const data = snap.data();
          const profile = {
            uid: fbUser.uid,
            email: data.email ?? fbUser.email ?? '',
            displayName:
            data.displayName ?? fbUser.displayName ?? '',
            photoURL: data.photoURL ?? fbUser.photoURL ?? undefined,
            fitnessLevel:
            data.fitnessLevel['fitnessLevel'] ?? 'beginner',
            goals: data.goals['goals'] ?? [],
            weight: data.weight | undefined,
            height: data.height | undefined,
            age: data.age | undefined,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            updatedAt: data.updatedAt?.toDate?.() ?? new Date()
          };
          setUser(profile);
        },
        (err) => setError(err.message)
      );
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [setUser, setLoading, setError]);

  return { user, isAuthenticated, isLoading, error };
}
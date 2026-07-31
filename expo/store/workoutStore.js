import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import {
  collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { optimizeArrayForPerformance } from '@/utils/storeOptimizations';



export const useWorkoutStore = create(
  persist(
    (set, get) => ({
      workouts: [],
      customWorkouts: [],
      completedWorkouts: [],
      favoriteWorkoutIds: [],
      runningPrograms: [],
      activeProgram: null,
      currentSession: null,
      runHistory: [],
      currentRun: null,
      runningChallenges: [],
      virtualRaces: [],
      runningBuddy: null,
      isLoading: false,

      /*        Firestore sync       
       * Real per-workout documents in the top-level `workouts` collection,
       * matching firestore.rules and functions/src/index.js (onWorkoutComplete,
       * getProgressSummary). Previously this wrote a single blob document at
       * users/{uid}/data/workouts, which neither the rules nor the Cloud
       * Functions were watching - completions never triggered stats/goal
       * updates or notifications. */
      loadWorkouts: async (uid) => {
        if (!uid) return;
        set({ isLoading: true });
        try {
          const q = query(
            collection(db, 'workouts'),
            where('userId', '==', uid),
            orderBy('date', 'desc'),
            limit(100)
          );
          const snap = await getDocs(q);
          const completedWorkouts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          set({ completedWorkouts });
        } catch (e) {
          console.warn('[workoutStore] loadWorkouts error:', e?.message);
        } finally {
          set({ isLoading: false });
        }
      },

      setWorkouts: (workouts) => set({ workouts }),

      addWorkout: (workout) => set((state) => ({
        workouts: [...state.workouts, workout]
      })),

      updateWorkout: (id, updates) => set((state) => ({
        workouts: state.workouts.map((workout) =>
        workout.id === id ? { ...workout, ...(updates || {}) } : workout
        )
      })),

      deleteWorkout: (id) => set((state) => ({
        workouts: state.workouts.filter((workout) => workout.id !== id)
      })),

      toggleFavorite: (workoutId) => set((state) => ({
        favoriteWorkoutIds: state.favoriteWorkoutIds.includes(workoutId) ?
        state.favoriteWorkoutIds.filter((id) => id !== workoutId) :
        [...state.favoriteWorkoutIds, workoutId]
      })),

      // Persists immediately to the real `workouts` collection (not just local
      // state) so onWorkoutComplete actually fires, and getProgressSummary /
      // this-device-and-others sync see it. Updates local state optimistically
      // first so the UI never blocks on network.
      addCompletedWorkout: async (workout, uid) => {
        const localRecord = { ...workout, id: workout.id ?? `local-${Date.now()}` };
        set((state) => ({
          completedWorkouts: optimizeArrayForPerformance([...state.completedWorkouts, localRecord], 20)
        }));

        if (!uid) {
          console.warn('[workoutStore] addCompletedWorkout: no uid, not persisted to Firestore');
          return localRecord;
        }

        try {
          const ref = await addDoc(collection(db, 'workouts'), {
            ...workout,
            userId: uid,
            completed: true,
            date: serverTimestamp(),
          });
          const saved = { ...localRecord, id: ref.id };
          set((state) => ({
            completedWorkouts: state.completedWorkouts.map((w) => w.id === localRecord.id ? saved : w)
          }));
          return saved;
        } catch (e) {
          console.error('[workoutStore] addCompletedWorkout Firestore write failed:', e?.message);
          return localRecord;
        }
      },

      logCompletedWorkout: async (workoutId, uid) => {
        const workout = [...get().workouts, ...get().customWorkouts].find((w) => w.id === workoutId);
        if (!workout) return null;
        const completedWorkout = {
          workoutId: workout.id,
          name: workout.name,
          category: workout.category,
          difficulty: workout.difficulty,
          exercises: workout.exercises,
          completedAt: new Date().toISOString(),
          duration: workout.duration,
          caloriesBurned: workout.calories || 0,
        };
        return get().addCompletedWorkout(completedWorkout, uid);
      },

      getCompletedWorkouts: () => get().completedWorkouts,

      setRunningPrograms: (programs) => set({ runningPrograms: programs }),

      startProgram: (programId) => {
        const program = get().runningPrograms.find((p) => p.id === programId);
        if (program) {
          set({ activeProgram: program });
        }
      },

      completeSession: (sessionId) => {
        console.log('Session completed:', sessionId);
      },

      pauseProgram: () => set({ activeProgram: null }),

      resumeProgram: () => {
        console.log('Program resumed');
      },

      startSession: (session) => set({ currentSession: session }),

      endSession: () => set({ currentSession: null }),

      startRun: () => {
        const newRun = {
          id: `run-${Date.now()}`,
          startTime: new Date().toISOString(),
          distance: 0,
          duration: 0,
          pace: 0,
          calories: 0,
          coordinates: []
        };
        set({ currentRun: newRun });
      },

      finishRun: () => {
        const { currentRun, runHistory } = get();
        if (currentRun) {
          const newRunRecord = {
            id: currentRun.id,
            date: currentRun.startTime,
            distance: currentRun.distance,
            duration: currentRun.duration,
            pace: currentRun.pace,
            calories: currentRun.calories
          };
          set({
            runHistory: optimizeArrayForPerformance([...runHistory, newRunRecord], 50),
            currentRun: null
          });
        }
      },

      updateRunStats: (stats) => {
        const { currentRun } = get();
        if (currentRun) {
          set({
            currentRun: {
              ...currentRun,
              ...stats
            }
          });
        }
      },

      getRunningStats: () => {
        const { runHistory } = get();
        if (!runHistory || runHistory.length === 0) {
          return {
            totalDistance: 0,
            totalRuns: 0,
            averagePace: 0,
            totalTime: 0
          };
        }

        const totalDistance = runHistory.reduce((sum, run) => sum + run.distance, 0);
        const totalRuns = runHistory.length;
        const totalTime = runHistory.reduce((sum, run) => sum + run.duration, 0);
        const averagePace = runHistory.reduce((sum, run) => sum + run.pace, 0) / totalRuns;

        return {
          totalDistance,
          totalRuns,
          averagePace,
          totalTime
        };
      },

      getPersonalBests: () => {
        const { runHistory } = get();
        if (!runHistory || runHistory.length === 0) {
          return {};
        }

        const personalBests = {};

        // Find fastest 5K
        const fiveKRuns = runHistory.filter((run) => run.distance >= 5.0 && run.distance <= 5.5);
        if (fiveKRuns.length > 0) {
          personalBests.fastest5K = Math.min(...fiveKRuns.map((run) => run.duration));
        }

        // Find fastest 10K
        const tenKRuns = runHistory.filter((run) => run.distance >= 10.0 && run.distance <= 10.5);
        if (tenKRuns.length > 0) {
          personalBests.fastest10K = Math.min(...tenKRuns.map((run) => run.duration));
        }

        // Find longest run
        if (runHistory.length > 0) {
          personalBests.longestRun = Math.max(...runHistory.map((run) => run.distance));
        }

        return personalBests;
      },

      joinChallenge: (challengeId) => {
        set((state) => ({
          runningChallenges: state.runningChallenges.map((challenge) =>
          challenge.id === challengeId ? { ...challenge, isJoined: true } : challenge
          )
        }));
      },

      registerForRace: (raceId) => {
        set((state) => ({
          virtualRaces: state.virtualRaces.map((race) =>
          race.id === raceId ? { ...race, isRegistered: true } : race
          )
        }));
      },

      
      getWorkoutStreak: () => {
        const completed = get().completedWorkouts || [];
        if (completed.length === 0) {
          return { current: 0, longest: 0 };
        }
        // Extract unique local dates (YYYY-MM-DD)
        const dates = Array.from(new Set(
          completed
            .map(w => w.completedAt || w.timestamp)
            .filter(Boolean)
            .map(d => d.slice(0, 10))
        )).sort();

        let longest = 0;
        let current = 0;
        
        // Calculate streak
        const todayStr = new Date().toISOString().slice(0, 10);
        const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        
        // Find if they worked out today or yesterday
        const hasTodayOrYesterday = dates.includes(todayStr) || dates.includes(yesterdayStr);
        
        if (hasTodayOrYesterday) {
          // Count backwards
          let checkDate = dates.includes(todayStr) ? new Date() : new Date(Date.now() - 24 * 60 * 60 * 1000);
          while (true) {
            const checkStr = checkDate.toISOString().slice(0, 10);
            if (dates.includes(checkStr)) {
              current++;
              checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
            } else {
              break;
            }
          }
        }
        
        // Calculate longest streak ever
        let tempStreak = 0;
        let prevTime = null;
        for (const dStr of dates) {
          const currTime = new Date(dStr).getTime();
          if (prevTime === null) {
            tempStreak = 1;
          } else {
            const diffDays = (currTime - prevTime) / (24 * 60 * 60 * 1000);
            if (diffDays <= 1.1) { // within ~1 day
              tempStreak++;
            } else if (diffDays > 1.1) {
              tempStreak = 1;
            }
          }
          if (tempStreak > longest) {
            longest = tempStreak;
          }
          prevTime = currTime;
        }
        
        return { current, longest: Math.max(longest, current) };
      },

      getWorkoutsByDate: (dateStr) => {
        const completed = get().completedWorkouts || [];
        return completed.filter(w => {
          const date = w.completedAt || w.timestamp;
          return date && date.startsWith(dateStr);
        });
      },

    }),
    {
      name: 'workout-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        workouts: state.workouts.slice(0, 10), // Limit workouts for performance
        customWorkouts: state.customWorkouts.slice(0, 5),
        completedWorkouts: state.completedWorkouts.slice(-20), // Keep last 20 completed workouts
        favoriteWorkoutIds: state.favoriteWorkoutIds.slice(0, 10),
        runningPrograms: state.runningPrograms.slice(0, 5),
        activeProgram: state.activeProgram,
        runHistory: state.runHistory.slice(-50), // Keep last 50 runs
        runningChallenges: state.runningChallenges.slice(0, 10),
        virtualRaces: state.virtualRaces.slice(0, 5),
        runningBuddy: state.runningBuddy
      })
    }
  )
);
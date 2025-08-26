import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { optimizeArrayForPerformance } from '@/utils/storeOptimizations';
import { Workout, RunningProgram, RunningSession, Coordinate } from '@/types';

interface CompletedWorkout extends Workout {
  completedAt: string;
  duration: number;
  caloriesBurned: number;
}

interface RunRecord {
  id: string;
  date: string;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  route?: string;
}

interface RunningChallenge {
  id: string;
  name: string;
  description: string;
  target: number;
  unit: string;
  progress?: number;
  participants: number;
  reward: {
    xp: number;
    badge?: string;
  };
  isJoined: boolean;
  category: string;
}

interface VirtualRace {
  id: string;
  name: string;
  description: string;
  distance: number;
  participants: number;
  rewards: {
    winner: {
      xp: number;
      prize?: string;
    };
  };
  isRegistered: boolean;
}

interface RunningBuddy {
  id: string;
  name: string;
  avatar: string;
  level: number;
  totalDistance: number;
  pace: number;
  isActive: boolean;
}

interface CurrentRun {
  id: string;
  startTime: string;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  coordinates: Coordinate[];
}

interface WorkoutState {
  workouts: Workout[];
  customWorkouts: Workout[];
  completedWorkouts: CompletedWorkout[];
  favoriteWorkoutIds: string[];
  runningPrograms: RunningProgram[];
  activeProgram: RunningProgram | null;
  currentSession: RunningSession | null;
  runHistory: RunRecord[];
  currentRun: CurrentRun | null;
  runningChallenges: RunningChallenge[];
  virtualRaces: VirtualRace[];
  runningBuddy: RunningBuddy | null;
  isLoading: boolean;
  
  // Actions
  setWorkouts: (workouts: Workout[]) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  toggleFavorite: (workoutId: string) => void;
  
  // Completed workouts actions
  addCompletedWorkout: (workout: CompletedWorkout) => void;
  logCompletedWorkout: (workoutId: string) => void;
  getCompletedWorkouts: () => CompletedWorkout[];
  
  // Running program actions
  setRunningPrograms: (programs: RunningProgram[]) => void;
  startProgram: (programId: string) => void;
  completeSession: (sessionId: string) => void;
  pauseProgram: () => void;
  resumeProgram: () => void;
  
  // Session actions
  startSession: (session: RunningSession) => void;
  endSession: () => void;
  
  // Running actions
  startRun: () => void;
  finishRun: () => void;
  updateRunStats: (stats: Partial<CurrentRun>) => void;
  getRunningStats: () => {
    totalDistance: number;
    totalRuns: number;
    averagePace: number;
    totalTime: number;
  };
  getPersonalBests: () => {
    fastest5K?: number;
    fastest10K?: number;
    longestRun?: number;
  };
  joinChallenge: (challengeId: string) => void;
  registerForRace: (raceId: string) => void;
  
  // Initialize with mock data
  initializeMockData: () => void;
  initializeDefaultWorkouts: () => void;
  initializeRunningPrograms: () => void;
}

// Mock completed workouts data
const mockCompletedWorkouts: CompletedWorkout[] = [
  {
    id: 'completed-1',
    name: 'Morning HIIT',
    description: 'High-intensity interval training session',
    duration: 30,
    difficulty: 'intermediate',
    category: 'hiit',
    exercises: [],
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    equipment: ['bodyweight'],
    muscleGroups: ['full-body'],
    calories: 250,
    xpReward: 75,
    isCustom: false,
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    caloriesBurned: 250,
  },
  {
    id: 'completed-2',
    name: 'Strength Training',
    description: 'Upper body strength workout',
    duration: 45,
    difficulty: 'advanced',
    category: 'strength',
    exercises: [],
    imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500',
    equipment: ['dumbbells', 'barbell'],
    muscleGroups: ['chest', 'shoulders', 'arms'],
    calories: 320,
    xpReward: 100,
    isCustom: false,
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    caloriesBurned: 320,
  },
  {
    id: 'completed-3',
    name: 'Yoga Flow',
    description: 'Relaxing yoga session',
    duration: 60,
    difficulty: 'beginner',
    category: 'yoga',
    exercises: [],
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
    equipment: ['yoga-mat'],
    muscleGroups: ['full-body'],
    calories: 180,
    xpReward: 50,
    isCustom: false,
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    caloriesBurned: 180,
  },
  {
    id: 'completed-4',
    name: 'Cardio Blast',
    description: 'High-energy cardio workout',
    duration: 35,
    difficulty: 'intermediate',
    category: 'cardio',
    exercises: [],
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    equipment: ['bodyweight'],
    muscleGroups: ['full-body'],
    calories: 280,
    xpReward: 85,
    isCustom: false,
    completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    caloriesBurned: 280,
  },
  {
    id: 'completed-5',
    name: 'Core Crusher',
    description: 'Intense core strengthening workout',
    duration: 25,
    difficulty: 'advanced',
    category: 'strength',
    exercises: [],
    imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500',
    equipment: ['bodyweight'],
    muscleGroups: ['core'],
    calories: 200,
    xpReward: 70,
    isCustom: false,
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    caloriesBurned: 200,
  }
];

// Mock running programs data
const mockRunningPrograms: RunningProgram[] = [
  {
    id: 'couch-to-5k',
    name: 'Couch to 5K',
    description: 'A 9-week program designed to get you from the couch to running a 5K',
    type: 'beginner',
    category: 'distance',
    duration: 9,
    totalSessions: 27,
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&h=300&fit=crop',
    difficulty: 'easy',
    goals: ['Build endurance', 'Complete 5K', 'Establish routine'],
    isPopular: true,
    estimatedTimePerSession: 30,
    sessions: [
      {
        id: 'c25k-w1-d1',
        week: 1,
        day: 1,
        name: 'Week 1, Day 1: Getting Started',
        description: 'Brisk 5-minute warmup walk, then alternate 60 seconds of jogging and 90 seconds of walking for a total of 20 minutes.',
        type: 'interval',
        duration: 30,
        distance: 2.5,
        instructions: [
          'Start with a 5-minute brisk walk to warm up',
          'Alternate between 60 seconds of light jogging and 90 seconds of walking',
          'Repeat this cycle for 20 minutes',
          'End with a 5-minute cool-down walk'
        ],
        xpReward: 50,
        intervals: [
          { type: 'walk', duration: 300, intensity: 'low' },
          { type: 'jog', duration: 60, intensity: 'medium', repeat: 8 },
          { type: 'walk', duration: 90, intensity: 'low', repeat: 8 },
          { type: 'walk', duration: 300, intensity: 'low' }
        ]
      },
      {
        id: 'c25k-w1-d2',
        week: 1,
        day: 2,
        name: 'Week 1, Day 2: Building Momentum',
        description: 'Repeat the same pattern as Day 1 with confidence.',
        type: 'interval',
        duration: 30,
        distance: 2.5,
        instructions: [
          'Start with a 5-minute brisk walk to warm up',
          'Alternate between 60 seconds of light jogging and 90 seconds of walking',
          'Repeat this cycle for 20 minutes',
          'End with a 5-minute cool-down walk'
        ],
        xpReward: 50
      },
      {
        id: 'c25k-w1-d3',
        week: 1,
        day: 3,
        name: 'Week 1, Day 3: Completing Week 1',
        description: 'Final day of week 1. Focus on form and breathing.',
        type: 'interval',
        duration: 30,
        distance: 2.5,
        instructions: [
          'Start with a 5-minute brisk walk to warm up',
          'Alternate between 60 seconds of light jogging and 90 seconds of walking',
          'Repeat this cycle for 20 minutes',
          'End with a 5-minute cool-down walk'
        ],
        xpReward: 75
      }
    ]
  },
  {
    id: '10k-trainer',
    name: '10K Trainer',
    description: 'Advanced program to build up to running 10 kilometers',
    type: 'intermediate',
    category: 'distance',
    duration: 12,
    totalSessions: 36,
    imageUrl: 'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=500&h=300&fit=crop',
    difficulty: 'medium',
    goals: ['Increase distance', 'Improve pace', 'Build stamina'],
    isPopular: false,
    estimatedTimePerSession: 45,
    sessions: [
      {
        id: '10k-w1-d1',
        week: 1,
        day: 1,
        name: 'Week 1, Day 1: Base Building',
        description: 'Easy 3K run to establish your baseline',
        type: 'run',
        duration: 25,
        distance: 3,
        instructions: [
          'Warm up with 5 minutes of walking',
          'Run at a comfortable pace for 3K',
          'Cool down with 5 minutes of walking'
        ],
        xpReward: 75
      }
    ]
  }
];

// Mock workouts data
const mockWorkouts: Workout[] = [
  {
    id: 'workout-1',
    name: 'Kettlebell step-overs',
    description: 'High-intensity kettlebell step-over exercise',
    duration: 30,
    difficulty: 'intermediate',
    category: 'hiit',
    exercises: [
      {
        id: 'ex-hiit-1',
        name: 'Kettlebell step-overs',
        sets: 6,
        reps: 5,
        weight: 5,
        restTime: 30,
        rest: 30,
        description: 'Step over the kettlebell with alternating legs',
        imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500',
        difficulty: 'intermediate',
        muscleGroups: ['legs', 'core']
      }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    equipment: ['kettlebell'],
    muscleGroups: ['legs', 'core'],
    calories: 300,
    xpReward: 100,
    isCustom: false
  },
  {
    id: 'workout-2',
    name: 'Upper Body Strength',
    description: 'Build upper body strength with this workout',
    duration: 45,
    difficulty: 'advanced',
    category: 'strength',
    exercises: [
      {
        id: 'ex-strength-1',
        name: 'Push-ups',
        sets: 3,
        reps: 15,
        weight: 0,
        restTime: 60,
        rest: 60,
        description: 'Standard push-ups',
        imageUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500',
        difficulty: 'advanced',
        muscleGroups: ['chest', 'shoulders', 'arms']
      }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500',
    equipment: ['dumbbells'],
    muscleGroups: ['chest', 'shoulders', 'arms'],
    calories: 250,
    xpReward: 120,
    isCustom: false
  }
];

// Mock run history
const mockRunHistory: RunRecord[] = [
  {
    id: 'run-1',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    distance: 5.2,
    duration: 1800, // 30 minutes
    pace: 5.77, // min/km
    calories: 350,
  },
  {
    id: 'run-2',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    distance: 3.1,
    duration: 1200, // 20 minutes
    pace: 6.45, // min/km
    calories: 220,
  },
  {
    id: 'run-3',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    distance: 10.5,
    duration: 3600, // 60 minutes
    pace: 5.71, // min/km
    calories: 650,
  }
];

// Mock running challenges
const mockRunningChallenges: RunningChallenge[] = [
  {
    id: 'challenge-1',
    name: '100K This Month',
    description: 'Run 100 kilometers this month',
    target: 100,
    unit: 'km',
    progress: 45,
    participants: 1250,
    reward: { xp: 500 },
    isJoined: true,
    category: 'distance'
  },
  {
    id: 'challenge-2',
    name: 'Daily Runner',
    description: 'Run every day for 30 days',
    target: 30,
    unit: 'days',
    progress: 12,
    participants: 890,
    reward: { xp: 750 },
    isJoined: false,
    category: 'consistency'
  }
];

// Mock virtual races
const mockVirtualRaces: VirtualRace[] = [
  {
    id: 'race-1',
    name: 'Virtual Marathon',
    description: 'Complete a full marathon distance',
    distance: 42.2,
    participants: 5000,
    rewards: {
      winner: { xp: 2000, prize: 'Marathon Medal' }
    },
    isRegistered: false
  },
  {
    id: 'race-2',
    name: '10K Challenge',
    description: 'Fast 10K virtual race',
    distance: 10,
    participants: 2500,
    rewards: {
      winner: { xp: 1000 }
    },
    isRegistered: true
  }
];

// Mock running buddy
const mockRunningBuddy: RunningBuddy = {
  id: 'buddy-1',
  name: 'Alex Runner',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
  level: 15,
  totalDistance: 250.5,
  pace: 5.5,
  isActive: true
};

export const useWorkoutStore = create<WorkoutState>()(
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

      setWorkouts: (workouts) => set({ workouts }),
      
      addWorkout: (workout) => set((state) => ({
        workouts: [...state.workouts, workout]
      })),
      
      updateWorkout: (id, updates) => set((state) => ({
        workouts: state.workouts.map(workout => 
          workout.id === id ? { ...workout, ...(updates || {}) } : workout
        )
      })),
      
      deleteWorkout: (id) => set((state) => ({
        workouts: state.workouts.filter(workout => workout.id !== id)
      })),
      
      toggleFavorite: (workoutId) => set((state) => ({
        favoriteWorkoutIds: state.favoriteWorkoutIds.includes(workoutId)
          ? state.favoriteWorkoutIds.filter(id => id !== workoutId)
          : [...state.favoriteWorkoutIds, workoutId]
      })),
      
      addCompletedWorkout: (workout) => set((state) => ({
        completedWorkouts: optimizeArrayForPerformance([...state.completedWorkouts, workout], 20)
      })),
      
      logCompletedWorkout: (workoutId) => {
        const workout = [...get().workouts, ...get().customWorkouts].find(w => w.id === workoutId);
        if (workout) {
          const completedWorkout: CompletedWorkout = {
            ...workout,
            completedAt: new Date().toISOString(),
            duration: workout.duration,
            caloriesBurned: workout.calories || 0
          };
          set((state) => ({
            completedWorkouts: optimizeArrayForPerformance([...state.completedWorkouts, completedWorkout], 20)
          }));
        }
      },
      
      getCompletedWorkouts: () => get().completedWorkouts,
      
      setRunningPrograms: (programs) => set({ runningPrograms: programs }),
      
      startProgram: (programId) => {
        const program = get().runningPrograms.find(p => p.id === programId);
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
        const newRun: CurrentRun = {
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
          const newRunRecord: RunRecord = {
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
        
        const personalBests: { fastest5K?: number; fastest10K?: number; longestRun?: number } = {};
        
        // Find fastest 5K
        const fiveKRuns = runHistory.filter(run => run.distance >= 5.0 && run.distance <= 5.5);
        if (fiveKRuns.length > 0) {
          personalBests.fastest5K = Math.min(...fiveKRuns.map(run => run.duration));
        }
        
        // Find fastest 10K
        const tenKRuns = runHistory.filter(run => run.distance >= 10.0 && run.distance <= 10.5);
        if (tenKRuns.length > 0) {
          personalBests.fastest10K = Math.min(...tenKRuns.map(run => run.duration));
        }
        
        // Find longest run
        if (runHistory.length > 0) {
          personalBests.longestRun = Math.max(...runHistory.map(run => run.distance));
        }
        
        return personalBests;
      },
      
      joinChallenge: (challengeId) => {
        set((state) => ({
          runningChallenges: state.runningChallenges.map(challenge =>
            challenge.id === challengeId ? { ...challenge, isJoined: true } : challenge
          )
        }));
      },
      
      registerForRace: (raceId) => {
        set((state) => ({
          virtualRaces: state.virtualRaces.map(race =>
            race.id === raceId ? { ...race, isRegistered: true } : race
          )
        }));
      },
      
      initializeMockData: () => {
        const { runningPrograms, completedWorkouts } = get();
        if (runningPrograms.length === 0) {
          set({ runningPrograms: mockRunningPrograms });
        }
        if (completedWorkouts.length === 0) {
          set({ completedWorkouts: mockCompletedWorkouts });
        }
      },
      
      initializeDefaultWorkouts: () => {
        const { workouts } = get();
        if (workouts.length === 0) {
          // Load only essential workouts for better performance - use requestAnimationFrame
          requestAnimationFrame(() => {
            set({ workouts: mockWorkouts.slice(0, 3) });
          });
        }
      },
      
      initializeRunningPrograms: () => {
        const { runningPrograms, runHistory, runningChallenges, virtualRaces, runningBuddy } = get();
        if (runningPrograms.length === 0) {
          // Load data progressively for better performance - use requestAnimationFrame
          requestAnimationFrame(() => {
            set({ 
              runningPrograms: mockRunningPrograms.slice(0, 2), // Load only 2 programs initially
              runHistory: mockRunHistory.slice(-10), // Load last 10 runs
              runningChallenges: mockRunningChallenges.slice(0, 3), // Load 3 challenges
              virtualRaces: mockVirtualRaces.slice(0, 2), // Load 2 races
              runningBuddy: mockRunningBuddy
            });
          });
        }
      }
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
        runningBuddy: state.runningBuddy,
      }),
    }
  )
);

// Initialize mock data on store creation
useWorkoutStore.getState().initializeMockData();
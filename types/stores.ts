export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  restTime: number;
  rest: number;
  description: string;
  imageUrl?: string;
  difficulty: string;
  muscleGroups: string[];
}

export interface Workout {
  id: string;
  name: string;
  description: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  exercises: Exercise[];
  imageUrl?: string;
  equipment: string[];
  muscleGroups: string[];
  calories: number;
  xpReward: number;
  isCustom: boolean;
}

export interface CompletedWorkout extends Workout {
  completedAt: string;
  caloriesBurned: number;
}

export interface RunningSession {
  id: string;
  week?: number;
  day?: number;
  name: string;
  description: string;
  type: string;
  duration: number;
  distance?: number;
  pace?: number;
  targetPace?: string;
  instructions?: string[];
  xpReward?: number;
  intervals?: Array<{
    type: string;
    duration: number;
    intensity?: 'low' | 'medium' | 'high';
    pace?: string;
    repeat?: number;
  }>;
}

export interface RunningProgram {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  duration: number;
  totalSessions: number;
  imageUrl: string;
  difficulty: string;
  goals: string[];
  isPopular: boolean;
  estimatedTimePerSession: number;
  sessions: RunningSession[];
}

export interface RunRecord {
  id: string;
  date: string;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
}

export interface CurrentRun {
  id: string;
  startTime: string;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

export interface RunningChallenge {
  id: string;
  name: string;
  description: string;
  target: number;
  unit: string;
  progress: number;
  participants: number;
  reward: { xp: number; badge?: string };
  isJoined: boolean;
  category: string;
}

export interface VirtualRace {
  id: string;
  name: string;
  description: string;
  distance: number;
  participants: number;
  rewards: {
    winner: { xp: number; prize?: string };
  };
  isRegistered: boolean;
}

export interface RunningBuddy {
  id: string;
  name: string;
  avatar: string;
  level: number;
  totalDistance: number;
  pace: number;
  isActive: boolean;
}

export interface WorkoutState {
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
  setWorkouts: (workouts: Workout[]) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  toggleFavorite: (workoutId: string) => void;
  addCompletedWorkout: (workout: CompletedWorkout) => void;
  logCompletedWorkout: (workoutId: string) => void;
  getCompletedWorkouts: () => CompletedWorkout[];
  setRunningPrograms: (programs: RunningProgram[]) => void;
  startProgram: (programId: string) => void;
  completeSession: (sessionId: string) => void;
  pauseProgram: () => void;
  resumeProgram: () => void;
  startSession: (session: RunningSession) => void;
  endSession: () => void;
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
  initializeMockData: () => void;
  initializeDefaultWorkouts: () => void;
  initializeRunningPrograms: () => void;
}

export interface ExpSystem {
  totalExp: number;
  level: number;
  expToNextLevel: number;
  expSources: {
    workouts: number;
    nutrition: number;
    social: number;
  };
  levelRequirements: Record<number, number>;
}

export interface ExpState {
  expSystem: ExpSystem;
  isLoading: boolean;
  initializeExpSystem: () => void;
  addExp: (amount: number) => void;
  addExpActivity: (activity: {
    type: string;
    baseExp: number;
    multiplier: number;
  }) => void;
  getExpBreakdown: () => {
    mainMissions: number;
    sideMissions: number;
    meals: number;
    workouts: number;
    running: number;
    events: number;
    total: number;
  };
  getExpForLevel: (level: number) => number;
  getExpToNextLevel: () => number;
  getLevel: () => number;
  getRecentActivities: (count?: number) => Array<unknown>;
  calculateLevelFromExp: (exp: number) => number;
}

export interface CommunityPost {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  timeAgo: string;
  type: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  image: string;
  members: number;
  category: string;
}

export interface CommunityChallenge {
  id: string;
  title?: string;
  name?: string;
  description: string;
  participants: number;
  timeLeft?: string;
  type: string;
  target?: number;
  unit?: string;
  progress?: number;
  category?: string;
  isJoined?: boolean;
  reward: {
    xp: number;
    badge?: string;
    title?: string;
  };
  startDate?: string;
  endDate?: string;
}

export interface CommunityState {
  posts: CommunityPost[];
  groups: CommunityGroup[];
  challenges: CommunityChallenge[];
  runningChallenges: CommunityChallenge[];
  addPost: (post: Omit<CommunityPost, 'id'>) => void;
  likePost: (postId: string) => void;
  initializeRunningChallenges: () => void;
  joinRunningChallenge: (challengeId: string) => void;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: Array<{ url: string }>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  uri: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images: Array<{ url: string }>;
  tracks: {
    total: number;
  };
  uri: string;
}

export interface SpotifyState {
  isConnected: boolean;
  user: SpotifyUser | null;
  topTracks: SpotifyTrack[];
  workoutPlaylists: SpotifyPlaylist[];
  runningPlaylists: SpotifyPlaylist[];
  currentTrack: SpotifyTrack | null;
  playbackState: unknown;
  musicPreferences: {
    preferredGenres: string[];
    energyLevel: number;
    tempoRange: { min: number; max: number };
    explicitContent: boolean;
  };
  isLoading: boolean;
  isLoadingPlaylists: boolean;
  connectSpotify: (authCode: string) => Promise<boolean>;
  connectSpotifyImplicit: (urlFragment: string) => Promise<boolean>;
  getSpotifyAuthUrl: () => Promise<string>;
  disconnectSpotify: () => Promise<void>;
  loadUserData: () => Promise<void>;
  loadWorkoutPlaylists: () => Promise<void>;
  loadRunningPlaylists: () => Promise<void>;
  updateCurrentTrack: () => Promise<void>;
  updateMusicPreferences: (preferences: Partial<SpotifyState['musicPreferences']>) => void;
  playTrack: (uri: string) => Promise<void>;
  pauseTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  createWorkoutPlaylist: (name: string, description: string, trackUris: string[]) => Promise<SpotifyPlaylist | null>;
  getRecommendationsForWorkout: (workoutType: string) => Promise<SpotifyTrack[]>;
  initializeSpotify: () => Promise<void>;
}

export interface UserRunningProfile {
  totalDistance: number;
  totalRuns: number;
  totalTime: number;
  bestPace: number;
  longestRun: number;
  personalBests: Record<string, number>;
  runningLevel: string;
  programProgress?: {
    programId: string;
    currentWeek: number;
    completedSessions: number;
    totalSessions: number;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  joinDate: string;
  fitnessLevel: string;
  goals: string[];
  exp: number;
  xp: number;
  expToNextLevel: number;
  level: number;
  streak: number;
  streakData: {
    currentStreak: number;
    longestStreak: number;
    streakDates: string[];
  };
  preferences: {
    units: string;
    notifications: {
      workouts: boolean;
      nutrition: boolean;
      social: boolean;
    };
    privacy: {
      profileVisible: boolean;
      shareProgress: boolean;
    };
    running?: {
      audioCoaching: boolean;
      gpsTracking: boolean;
      safetySharing: boolean;
      weatherAlerts: boolean;
      virtualBuddy: boolean;
      preferredUnit: string;
      targetPace: number;
    };
  };
  fitnessMetrics: {
    weight: number;
    height: number;
    bodyFat: number;
    muscleMass: number;
  };
  expSystem: ExpSystem;
  runningProfile?: UserRunningProfile;
  subscription: {
    tier: string;
    status: string;
    startDate: string;
    autoRenew: boolean;
    nextBillingDate?: string;
    cancelledAt?: string;
  };
}

export interface UserState {
  user: User | null;
  isOnboarded: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  updateUserPreferences: (preferences: Partial<User['preferences']>) => void;
  updateUserGoals: (goals: string[]) => void;
  updateUserFitnessLevel: (level: string) => void;
  addXp: (amount: number) => void;
  calculateLevel: (xp: number) => number;
  updateStreak: (workoutCompleted: boolean) => void;
  getStreakData: () => User['streakData'];
  updateFitnessMetrics: (metrics: Partial<User['fitnessMetrics']>) => void;
  incrementSteps: (steps: number) => void;
  logSleep: (duration: number, quality: string) => void;
  updateRecovery: (score: number) => void;
  logCaloriesBurned: (calories: number) => void;
  logActiveMinutes: (minutes: number) => void;
  updateHeartRate: (rate: number) => void;
  logWaterIntake: (amount: number) => void;
  resetDailyMetrics: () => void;
  logout: () => Promise<void>;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  initializeDefaultUser: () => void;
  updateUserRunningProfile: (profile: Partial<UserRunningProfile>) => void;
  updateRunningPreferences: (preferences: Partial<User['preferences']['running']>) => void;
  initializeRunningProfile: () => void;
  updateSubscription: (subscription: Partial<User['subscription']>) => void;
  upgradeSubscription: (tier: string) => void;
  cancelSubscription: () => void;
  getSubscriptionTier: () => string;
  hasFeatureAccess: (feature: string) => boolean;
}



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
  setWorkouts: (workouts) => void;
  addWorkout: (workout) => void;
  updateWorkout: (id, updates) => void;
  deleteWorkout: (id) => void;
  toggleFavorite: (workoutId) => void;
  addCompletedWorkout: (workout) => void;
  logCompletedWorkout: (workoutId) => void;
  getCompletedWorkouts: () => CompletedWorkout[];
  setRunningPrograms: (programs) => void;
  startProgram: (programId) => void;
  completeSession: (sessionId) => void;
  pauseProgram: () => void;
  resumeProgram: () => void;
  startSession: (session) => void;
  endSession: () => void;
  startRun: () => void;
  finishRun: () => void;
  updateRunStats: (stats) => void;
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
  joinChallenge: (challengeId) => void;
  registerForRace: (raceId) => void;
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
  addExp: (amount) => void;
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
  getExpForLevel: (level) => number;
  getExpToNextLevel: () => number;
  getLevel: () => number;
  getRecentActivities: (count?) => Array;
  calculateLevelFromExp: (exp) => number;
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
  isClientCredentialsReady: boolean;
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
  connectSpotify: (authCode) => Promise;
  connectSpotifyImplicit: (urlFragment) => Promise;
  getSpotifyAuthUrl: () => Promise;
  disconnectSpotify: () => Promise;
  loadUserData: () => Promise;
  loadWorkoutPlaylists: () => Promise;
  loadRunningPlaylists: () => Promise;
  updateCurrentTrack: () => Promise;
  updateMusicPreferences: (preferences) => void;
  playTrack: (uri) => Promise;
  pauseTrack: () => Promise;
  nextTrack: () => Promise;
  previousTrack: () => Promise;
  createWorkoutPlaylist: (name, description, trackUris: string[]) => Promise<SpotifyPlaylist | null>;
  getRecommendationsForWorkout: (workoutType) => Promise;
  initializeSpotify: () => Promise;
  initializeClientCredentials: () => Promise;
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


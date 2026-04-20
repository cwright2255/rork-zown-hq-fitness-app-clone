
export interface FoodItem {
  id: string;
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  nutritionalScore?: {
    score: string;
  };
  nutritionalDetails?: {
    saturatedFat: number;
    sugar: number;
    fiber: number;
    sodium: number;
  };
}

export interface UserPreferences {
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
  workoutDuration?: number;
  dietaryPreference?: string;
  workoutFrequencyDays?: number;
  focusMuscleGroups?: string[];
  enableWaterTracking?: boolean;
  running?: {
    audioCoaching: boolean;
    gpsTracking: boolean;
    safetySharing: boolean;
    weatherAlerts: boolean;
    virtualBuddy: boolean;
    preferredUnit: string;
    targetPace: number;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  profileImage: string;
  joinDate: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  exp: number;
  xp: number;
  level: number;
  expToNextLevel: number;
  streak: number;
  streakData: {
    currentStreak: number;
    longestStreak: number;
    streakDates: string[];
  };
  preferences: UserPreferences;
  fitnessMetrics: {
    weight: number;
    height: number;
    bodyFat: number;
    muscleMass: number;
  };
  expSystem: {
    totalExp: number;
    level: number;
    expToNextLevel: number;
    expSources: {
      workouts: number;
      nutrition: number;
      social: number;
    };
    levelRequirements: Record<number, number>;
  };
  subscription: UserSubscription;
  runningProfile?: {
    totalDistance: number;
    totalRuns: number;
    totalTime: number;
    bestPace: number;
    longestRun: number;
    personalBests: Record<string, number>;
    runningLevel: string;
  };
}

export interface ProgressEntry {
  id: string;
  userId: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  photos?: string[];
  notes?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price?: number;
  size?: string;
  color?: string;
  inStock?: boolean;
  imageUrl?: string;
  attributes?: {
    size?: string;
    color?: string;
    [key: string]: any;
  };
}

export interface LocationServiceState {
  isTracking: boolean;
  coordinates: Coordinate[];
  currentLocation: {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  } | null;
  distance: number;
  speed: number;
  averageSpeed: number;
}


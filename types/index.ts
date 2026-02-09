export interface MoodEntry {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  sleep: number;
  notes: string;
  tags: string[];
}

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

export interface UserSubscription {
  tier: 'free' | 'standard' | 'elite';
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  autoRenew: boolean;
  nextBillingDate?: string;
  cancelledAt?: string;
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

export interface Order {
  id: string;
  orderDate: string;
  status: 'processing' | 'shipped' | 'delivered';
  total: number;
  deliveryAddress: string;
  estimatedDelivery?: string;
  items: OrderItem[];
  trackingEvents: TrackingEvent[];
}

export interface OrderItem {
  id: string;
  name: string;
  image: string;
  quantity: number;
  price: number;
}

export interface TrackingEvent {
  title: string;
  description: string;
  timestamp?: string;
  completed: boolean;
}

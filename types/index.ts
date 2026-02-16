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
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate: string;
  autoRenew: boolean;
  nextBillingDate?: string;
  cancelledAt?: string;
  trialEndsAt?: string;
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

export type SubscriptionTier = 'free' | 'standard' | 'elite';

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  isUnlocked?: boolean;
  unlockedAt?: string;
}

export interface AchievementCondition {
  type: string;
  target: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  condition: AchievementCondition;
  unlockedAt?: string;
  isUnlocked?: boolean;
  progress?: number;
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

export interface ExpActivity {
  id: string;
  type: string;
  subtype?: string;
  amount?: number;
  baseExp?: number;
  multiplier?: number;
  description: string;
  timestamp?: string;
  date?: string;
  completed?: boolean;
}

export interface ExpBreakdown {
  workouts: number;
  nutrition: number;
  social: number;
  challenges?: number;
  streaks?: number;
  mainMissions?: number;
  sideMissions?: number;
  meals?: number;
  events?: number;
  running?: number;
  total?: number;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
}

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface Recipe {
  id: string;
  name?: string;
  title: string;
  description: string;
  prepTime: number;
  cookTime?: number;
  servings: number;
  difficulty?: string;
  category: string;
  tags?: string[];
  dietaryTags: string[];
  imageUrl?: string;
  image: string;
  ingredients: string[] | RecipeIngredient[];
  instructions: string[];
  nutrition?: RecipeNutrition;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  rating?: number;
  reviewCount?: number;
  dateAdded?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  author?: string;
  isFavorite?: boolean;
  addedToGroceryList?: boolean;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface RunningInterval {
  type: string;
  duration: number;
  pace?: string;
  repeat?: number;
  intensity?: 'low' | 'medium' | 'high';
}

export interface RunningSession {
  id: string;
  name: string;
  description: string;
  type: string;
  duration: number;
  distance?: number;
  pace?: number;
  week?: number;
  xpReward?: number;
  targetPace?: string;
  instructions?: string[];
  intervals?: RunningInterval[];
}

export interface RunningProgram {
  id: string;
  name: string;
  description: string;
  duration: number;
  totalSessions: number;
  difficulty: string;
  goal?: string;
  goals?: string[];
  type?: string;
  category?: string;
  imageUrl: string;
  estimatedTimePerSession?: number;
  isPopular?: boolean;
  sessions: RunningSession[];
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

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  image?: string;
  imageUrl?: string;
  images?: string[];
  category: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  variants?: ProductVariant[];
  collectionIds?: string[];
}

export interface ShopCollection {
  id: string;
  name: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  categories?: string[];
  products?: string[];
  featured?: boolean;
}

export type Collection = ShopCollection;

export interface Exercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  restTime?: number;
  rest?: number;
  duration?: number;
  description?: string;
  imageUrl?: string;
  difficulty?: string;
  muscleGroups?: string[];
  equipment?: string[];
}

export type WorkoutCategory = 'strength' | 'cardio' | 'flexibility' | 'hiit' | 'yoga' | 'pilates' | 'crossfit' | 'bodyweight' | 'custom';

export interface Workout {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  duration: number;
  category: string;
  equipment?: string[];
  muscleGroups?: string[];
  calories?: number;
  xpReward?: number;
  imageUrl?: string;
  exercises: Exercise[];
  isCustom?: boolean;
  completedAt?: string;
  caloriesBurned?: number;
}

export interface CompletedWorkout extends Workout {
  workoutId: string;
  date: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
  timestamp: string;
  altitude?: number;
  speed?: number;
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

export interface ChampionPassReward {
  id: string;
  name: string;
  description?: string;
  type: string;
  imageUrl: string;
  isClaimed: boolean;
}

export interface ChampionPassTier {
  id: string;
  level: number;
  name: string;
  description: string;
  isPremium: boolean;
  isUnlocked: boolean;
  rewards: ChampionPassReward[];
  xpRequired: number;
}

export interface GroceryItem {
  id: string;
  ingredient: string;
  amount: number;
  unit: string;
  recipes: string[];
  checked: boolean;
  category: string;
}

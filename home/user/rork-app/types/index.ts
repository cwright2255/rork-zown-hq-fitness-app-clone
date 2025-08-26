export type User = {
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
  subscription: {
    tier: 'free' | 'premium' | 'pro';
    status: 'active' | 'inactive' | 'cancelled';
    startDate: string;
    autoRenew: boolean;
  };
  avatar: string;
  experience: number;
  credits: number;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  duration: number; // in days
  features: string[];
  tier: number;
};

export type Workout = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  difficulty: string;
  duration: number;
  calories: number;
  category: string;
  exercises: Exercise[];
  isFeatured?: boolean;
  isPremium?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Exercise = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  sets: number;
  reps: number;
  duration?: number;
  rest?: number;
  difficulty: string;
  muscleGroups: string[];
};

export type FoodItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  imageUrl?: string;
  barcode?: string;
  category?: string;
  isFavorite?: boolean;
  createdAt?: string;
};

export type Meal = {
  id: string;
  name: string;
  items: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  date: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  imageUrl?: string;
};

export type NutritionGoal = {
  id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  isUnlocked: boolean;
  unlockDate?: string;
  progress: number;
  target: number;
  category: string;
  isFeatured?: boolean;
};

export type ProgressEntry = {
  id: string;
  date: string;
  weight?: number;
  bodyFatPercentage?: number;
  waistSize?: number;
  hipSize?: number;
  chestSize?: number;
  armSize?: number;
  thighSize?: number;
  calfSize?: number;
  notes?: string;
  photos?: string[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrls: string[];
  category: string;
  subcategory?: string;
  brand?: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  stockQuantity?: number;
  sku?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  isOnSale?: boolean;
  collectionId?: string;
  sizes?: string[];
  colors?: string[];
};

export type Collection = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  bannerUrl?: string;
  productCount: number;
  isFeatured?: boolean;
  isSeasonal?: boolean;
  season?: string;
  createdAt: string;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  size?: string;
  color?: string;
  addedAt: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  items: CartItem[];
  totalAmount: number;
  shippingAddress: Address;
  billingAddress?: Address;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  trackingNumber?: string;
  shippingMethod: string;
  estimatedDelivery?: string;
  orderDate: string;
  updatedAt?: string;
  notes?: string;
};

export type Address = {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email?: string;
  isDefault?: boolean;
  type: 'shipping' | 'billing' | 'both';
};

export type ChampionPassTier = {
  id: string;
  name: string;
  level: number;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
  badgeUrl: string;
  backgroundUrl?: string;
  isFeatured?: boolean;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  isEarned: boolean;
  earnedDate?: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  progress: number;
  target: number;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  ingredients: string[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  tags?: string[];
  isFavorite?: boolean;
  rating?: number;
  createdAt: string;
};

export type BodyScan = {
  id: string;
  date: string;
  frontPhotoUrl?: string;
  sidePhotoUrl?: string;
  backPhotoUrl?: string;
  analysisResults?: {
    postureScore?: number;
    symmetryScore?: number;
    mobilityScore?: number;
    notes?: string;
  };
  notes?: string;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  content: string;
  imageUrls?: string[];
  videoUrl?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLikedByUser: boolean;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  content: string;
  likesCount: number;
  isLikedByUser: boolean;
  createdAt: string;
  updatedAt?: string;
  replies?: CommunityComment[];
  parentCommentId?: string;
};

export type TelehealthAppointment = {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  providerAvatarUrl: string;
  dateTime: string;
  duration: number;
  reasonForVisit: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  meetingUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  rating?: number;
  feedback?: string;
};

export type WearableData = {
  id: string;
  deviceType: string;
  deviceName: string;
  deviceId: string;
  dataType: 'steps' | 'heartRate' | 'sleep' | 'calories' | 'distance' | 'workout';
  value: number;
  unit?: string;
  dateTime: string;
  duration?: number;
  source: string;
  isSynced: boolean;
  createdAt: string;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder' | 'achievement' | 'message' | 'workout' | 'nutrition' | 'order' | 'appointment';
  category?: string;
  isRead: boolean;
  isActionable: boolean;
  actionUrl?: string;
  actionText?: string;
  imageUrl?: string;
  createdAt: string;
};

export type AnalyticsEvent = {
  id: string;
  eventName: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  timestamp: string;
  screenName?: string;
  userId: string;
  sessionId?: string;
  deviceInfo?: {
    deviceType?: string;
    deviceModel?: string;
    osVersion?: string;
    appVersion?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
  };
  additionalData?: Record<string, any>;
};

export type HealthAssessment = {
  id: string;
  date: string;
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  healthConditions?: string[];
  injuries?: string[];
  goals?: string[];
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  dietPreferences?: string[];
  allergies?: string[];
  sleepHours?: number;
  stressLevel?: 'low' | 'moderate' | 'high';
  smokingStatus?: 'never' | 'former' | 'current';
  alcoholConsumption?: 'none' | 'occasional' | 'regular';
  results?: {
    bmi?: number;
    bmr?: number;
    tdee?: number;
    recommendedCalories?: number;
    recommendedProtein?: number;
    recommendedCarbs?: number;
    recommendedFat?: number;
    fitnessScore?: number;
    healthScore?: number;
    recommendations?: string[];
  };
  createdAt: string;
  updatedAt?: string;
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  recipientId: string;
  recipientName?: string;
  recipientAvatarUrl?: string;
  content: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'document' | 'audio';
  isRead: boolean;
  isDelivered: boolean;
  sentAt: string;
  readAt?: string;
};

export type Conversation = {
  id: string;
  participantIds: string[];
  participantNames: string[];
  participantAvatarUrls?: string[];
  lastMessage?: Message;
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
  groupAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type MoodEntry = {
  id: string;
  date: string;
  mood: 'verySad' | 'sad' | 'neutral' | 'happy' | 'veryHappy';
  energyLevel: 'veryLow' | 'low' | 'medium' | 'high' | 'veryHigh';
  stressLevel: 'veryLow' | 'low' | 'medium' | 'high' | 'veryHigh';
  sleepQuality?: 'veryPoor' | 'poor' | 'average' | 'good' | 'veryGood';
  activities?: string[];
  notes?: string;
  createdAt: string;
};

export type RunningProgram = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  sessionsPerWeek: number;
  totalSessions: number;
  goal: 'distance' | 'speed' | 'endurance' | 'weightLoss' | 'generalFitness';
  targetDistance?: number;
  targetTime?: number;
  terrain: 'road' | 'trail' | 'treadmill' | 'track' | 'mixed';
  sessions: RunningSession[];
  isFeatured?: boolean;
  isPremium?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type RunningSession = {
  id: string;
  programId: string;
  week: number;
  day: number;
  name: string;
  description: string;
  type: 'easyRun' | 'longRun' | 'speedWork' | 'intervals' | 'tempoRun' | 'hillWorkout' | 'recoveryRun' | 'race' | 'crossTraining' | 'rest';
  distance?: number;
  duration?: number;
  pace?: string;
  heartRateZone?: string;
  intervals?: {
    repeat: number;
    distance: number;
    pace: string;
    recoveryDistance?: number;
    recoveryPace?: string;
  }[];
  warmUp?: {
    distance?: number;
    duration?: number;
    pace?: string;
  };
  coolDown?: {
    distance?: number;
    duration?: number;
    pace?: string;
  };
  notes?: string;
  isCompleted: boolean;
  completedDate?: string;
  performanceNotes?: string;
  actualDistance?: number;
  actualDuration?: number;
  averagePace?: string;
  averageHeartRate?: number;
  caloriesBurned?: number;
  routeMapUrl?: string;
};

export type ExpCategory = 'Workout' | 'Nutrition' | 'Achievement' | 'Community' | 'Shop' | 'Challenge' | 'Other';

export type ExpTransaction = {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: ExpCategory;
  date: string;
  referenceId?: string;
  referenceType?: string;
  balanceAfter?: number;
};

export type HydrationEntry = {
  id: string;
  date: string;
  amount: number; // in ounces or milliliters
  unit: 'oz' | 'ml';
  goal: number;
  progress: number;
  createdAt: string;
};

export type UserPreferences = {
  units: 'metric' | 'imperial';
  notifications: {
    workouts: boolean;
    nutrition: boolean;
    social: boolean;
  };
  privacy: {
    profileVisible: boolean;
    shareProgress: boolean;
  };
  theme: 'light' | 'dark';
  soundEffects: boolean;
  music: boolean;
  musicGenre: string;
  workoutReminders: boolean;
  reminderFrequency: 'daily' | 'weekly';
  dietaryPreference: string;
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  workoutDifficulty: 'easy' | 'medium' | 'hard';
  workoutDuration: number;
  preferredWorkoutTypes: string[];
  enableHapticFeedback: boolean;
  enableVoiceGuidance: boolean;
  voiceLanguage: string;
  enableBackgroundMusic: boolean;
  backgroundMusicVolume: number;
  enableWorkoutTips: boolean;
  enableNutritionTips: boolean;
  enableMotivationalQuotes: boolean;
  enableCommunityFeatures: boolean;
  privacySettings: {
    shareWorkoutData: boolean;
    shareNutritionData: boolean;
    shareProgressPhotos: boolean;
    shareAchievements: boolean;
    shareLevel: boolean;
  };
  appLanguage: string;
  measurementSystem: 'metric' | 'imperial';
  dateFormat: string;
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 'monday' | 'sunday';
  enableAutoSync: boolean;
  enableWearableIntegration: boolean;
  enableSpotifyIntegration: boolean;
  enableAppleHealth: boolean;
  enableGoogleFit: boolean;
  enableStrava: boolean;
  enableFitbit: boolean;
  enableGarmin: boolean;
  enableMyFitnessPal: boolean;
  enableWithings: boolean;
  enableOura: boolean;
  enablePolar: boolean;
  enableSamsungHealth: boolean;
  enableWhoop: boolean;
  enableUnderArmour: boolean;
  enableCronometer: boolean;
  enableLoseIt: boolean;
  enableWeightWatchers: boolean;
  enableNoom: boolean;
  enablePeloton: boolean;
  enableZwift: boolean;
  enableTrainerRoad: boolean;
  enableWahoo: boolean;
  enableRuntastic: boolean;
  enableMapMyRun: boolean;
  enableNikeRunClub: boolean;
  enableEndomondo: boolean;
  enableKomoot: boolean;
  enableSuunto: boolean;
  enableCoros: boolean;
  enableDecathlonCoach: boolean;
  enableFatSecret: boolean;
  enableLifesum: boolean;
  enableYazio: boolean;
  enableHealthifyMe: boolean;
  enableFitOn: boolean;
  enableSweat: boolean;
  enableAaptiv: boolean;
  enableCentr: boolean;
  enableDailyBurn: boolean;
  enableBeachbody: boolean;
  enableOpenFoodFacts: boolean;
  enableNutritionix: boolean;
  enableBarcodeScanner: boolean;
  enableVoiceFoodLogging: boolean;
  enablePhotoFoodLogging: boolean;
  enableMealPlanning: boolean;
  enableWaterTracking: boolean;
  enableMoodTracking: boolean;
  enableSleepTracking: boolean;
  enableStressTracking: boolean;
  enableEnergyTracking: boolean;
  enableMenstrualCycleTracking: boolean;
  enablePregnancyMode: boolean;
  enableNursingMode: boolean;
  enableBabyTracking: boolean;
  enableSeniorMode: boolean;
  enableAccessibilityMode: boolean;
  enableLowDataMode: boolean;
  enableBatterySaver: boolean;
  enableOfflineMode: boolean;
  enableAutomaticWorkoutDetection: boolean;
  enableAutomaticMealDetection: boolean;
  enableAutomaticMoodDetection: boolean;
  enableAutomaticSleepDetection: boolean;
  enableAutomaticStressDetection: boolean;
  enableAutomaticEnergyDetection: boolean;
  enableAutomaticMenstrualCycleDetection: boolean;
  enableAutomaticPregnancyDetection: boolean;
  enableAutomaticNursingDetection: boolean;
  enableAutomaticBabyDetection: boolean;
  enableAutomaticSeniorDetection: boolean;
  enableAutomaticAccessibilityDetection: boolean;
  enableAutomaticLowDataDetection: boolean;
  enableAutomaticBatterySaverDetectionDetection: boolean;
  enableAutomaticOfflineModeDetection: boolean;
  enableAutomaticThemeDetection: boolean;
  enableAutomaticLanguageDetection: boolean;
  enableAutomaticMeasurementSystemDetection: boolean;
  enableAutomaticDateFormatDetection: boolean;
  enableAutomaticTimeFormatDetection: boolean;
  enableAutomaticFirstDayOfWeekDetection: boolean;
  enableAutomaticAutoSyncDetection: boolean;
  enableAutomaticWearableIntegrationDetection: boolean;
  enableAutomaticSpotifyIntegrationDetection: boolean;
  enableAutomaticAppleHealthDetection: boolean;
  enableAutomaticGoogleFitDetection: boolean;
  enableAutomaticStravaDetection: boolean;
  enableAutomaticFitbitDetection: boolean;
  enableAutomaticGarminDetection: boolean;
  enableAutomaticMyFitnessPalDetection: boolean;
  enableAutomaticWithingsDetection: boolean;
  enableAutomaticOuraDetection: boolean;
  enableAutomaticPolarDetection: boolean;
  enableAutomaticSamsungHealthDetection: boolean;
  enableAutomaticWhoopDetection: boolean;
  enableAutomaticUnderArmourDetection: boolean;
  enableAutomaticCronometerDetection: boolean;
  enableAutomaticLoseItDetection: boolean;
  enableAutomaticWeightWatchersDetection: boolean;
  enableAutomaticNoomDetection: boolean;
  enableAutomaticPelotonDetection: boolean;
  enableAutomaticZwiftDetection: boolean;
  enableAutomaticTrainerRoadDetection: boolean;
  enableAutomaticWahooDetection: boolean;
  enableAutomaticRuntasticDetection: boolean;
  enableAutomaticMapMyRunDetection: boolean;
  enableAutomaticNikeRunClubDetection: boolean;
  enableAutomaticEndomondoDetection: boolean;
  enableAutomaticKomootDetection: boolean;
  enableAutomaticSuuntoDetection: boolean;
  enableAutomaticCorosDetection: boolean;
  enableAutomaticDecathlonCoachDetection: boolean;
  enableAutomaticFatSecretDetection: boolean;
  enableAutomaticLifesumDetection: boolean;
  enableAutomaticYazioDetection: boolean;
  enableAutomaticHealthifyMeDetection: boolean;
  enableAutomaticFitOnDetection: boolean;
  enableAutomaticSweatDetection: boolean;
  enableAutomaticAaptivDetection: boolean;
  enableAutomaticCentrDetection: boolean;
  enableAutomaticDailyBurnDetection: boolean;
  enableAutomaticBeachbodyDetection: boolean;
  enableAutomaticOpenFoodFactsDetection: boolean;
  enableAutomaticNutritionixDetection: boolean;
  enableAutomaticBarcodeScannerDetection: boolean;
  enableAutomaticVoiceFoodLoggingDetection: boolean;
  enableAutomaticPhotoFoodLoggingDetection: boolean;
  enableAutomaticMealPlanningDetection: boolean;
  enableAutomaticWaterTrackingDetection: boolean;
  enableAutomaticMoodTrackingDetection: boolean;
  enableAutomaticSleepTrackingDetection: boolean;
  enableAutomaticStressTrackingDetection: boolean;
  enableAutomaticEnergyTrackingDetection: boolean;
  enableAutomaticMenstrualCycleTrackingDetection: boolean;
  enableAutomaticPregnancyModeDetection: boolean;
  enableAutomaticNursingModeDetection: boolean;
  enableAutomaticBabyTrackingDetection: boolean;
  enableAutomaticSeniorModeDetection: boolean;
  enableAutomaticAccessibilityModeDetection: boolean;
  enableAutomaticLowDataModeDetection: boolean;
};

export type BodyMetrics = {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  bmi: number;
  bodyFatPercentage: number;
  muscleMass: number;
  boneDensity: number;
  hydrationLevel: number;
  metabolicRate: number;
  waistCircumference: number;
  hipCircumference: number;
  chestCircumference: number;
  armCircumference: number;
  thighCircumference: number;
  calfCircumference: number;
  neckCircumference: number;
  wristCircumference: number;
  ankleCircumference: number;
  shoulderBreadth: number;
  handLength: number;
  footLength: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  restingHeartRate: number;
  vo2Max: number;
  gripStrength: number;
  verticalJump: number;
  flexibility: number;
  endurance: number;
  strength: number;
  speed: number;
  agility: number;
  balance: number;
  coordination: number;
  reactionTime: number;
  power: number;
  injuryRisk: 'low' | 'medium' | 'high';
  recoveryRate: 'slow' | 'average' | 'fast';
  stressLevel: 'low' | 'moderate' | 'high';
  fatigueLevel: 'none' | 'low' | 'moderate' | 'high';
  sorenessLevel: 'none' | 'mild' | 'moderate' | 'severe';
  mood: 'poor' | 'fair' | 'neutral' | 'good' | 'excellent';
  energyLevel: 'low' | 'medium' | 'high';
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent';
  sleepDuration: number;
  lastUpdated: string;
};

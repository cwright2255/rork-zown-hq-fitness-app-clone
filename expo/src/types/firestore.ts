export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type GoalType =
  | 'weight_loss'
  | 'muscle_gain'
  | 'endurance'
  | 'flexibility'
  | 'general_fitness';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  fitnessLevel: FitnessLevel;
  goals: GoalType[];
  weight?: number;
  height?: number;
  age?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps?: number;
  duration?: number;
  weight?: number;
  restSeconds: number;
  notes?: string;
  completed?: boolean;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  duration: number;
  calories?: number;
  date: Date;
  notes?: string;
  aiGenerated: boolean;
  completed: boolean;
  completedAt?: Date;
}

export interface AIRecommendation {
  id: string;
  userId: string;
  type: 'workout_plan' | 'nutrition' | 'progress_summary' | 'form_tip';
  content: string;
  structuredData?: Record<string, unknown>;
  prompt: string;
  createdAt: Date;
  isRead: boolean;
}

export interface SpotifyPlaylist {
  id: string;
  spotifyId: string;
  name: string;
  description?: string;
  trackCount: number;
  imageUrl?: string;
  workoutType?: string;
  savedAt: Date;
}

export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline?: Date;
  completed: boolean;
  createdAt: Date;
}

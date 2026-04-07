import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Dumbbell, BarChart2, Heart, Share2, Play } from 'lucide-react-native';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { Workout } from '@/types';
import ExerciseItem from '@/components/ExerciseItem';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');

// Mock workout data for fallback
const mockWorkout: Workout = {
  id: 'workout-fallback',
  name: 'Kettlebell step-overs',
  description: 'A complete kettlebell step-over exercise focusing on building leg strength and coordination.',
  difficulty: 'beginner',
  duration: 45,
  category: 'strength',
  equipment: ['kettlebell'],
  muscleGroups: ['legs', 'core'],
  calories: 300,
  xpReward: 150,
  imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500',
  exercises: [
    {
      id: 'ex-1',
      name: 'Kettlebell step-overs',
      sets: 6,
      reps: 5,
      weight: 5,
      restTime: 60,
      rest: 60,
      description: 'Step over the kettlebell with alternating legs',
      imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500',
      difficulty: 'beginner',
      muscleGroups: ['legs', 'core']
    }
  ],
  isCustom: false
};

// Additional mock workouts for testing
const mockWorkouts: Workout[] = [
  mockWorkout,
  {
    id: '1',
    name: 'Kettlebell step-overs',
    description: 'A kettlebell step-over exercise to build leg strength and coordination.',
    difficulty: 'beginner',
    duration: 10,
    category: 'strength',
    equipment: ['kettlebell'],
    muscleGroups: ['legs', 'core'],
    calories: 150,
    xpReward: 100,
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
    exercises: [
      {
        id: 'ex-p1',
        name: 'Kettlebell step-overs',
        sets: 6,
        reps: 5,
        weight: 5,
        restTime: 30,
        rest: 30,
        description: 'Step over the kettlebell with alternating legs',
        imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500',
        difficulty: 'beginner',
        muscleGroups: ['legs', 'core']
      }
    ],
    isCustom: false
  },
  {
    id: '2',
    name: 'Kettlebell step-overs',
    description: 'Advanced kettlebell step-over exercise with increased intensity.',
    difficulty: 'intermediate',
    duration: 20,
    category: 'strength',
    equipment: ['kettlebell'],
    muscleGroups: ['legs', 'core'],
    calories: 400,
    xpReward: 200,
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
    exercises: [
      {
        id: 'ex-h1',
        name: 'Kettlebell step-overs',
        sets: 6,
        reps: 5,
        weight: 5,
        restTime: 15,
        rest: 15,
        description: 'Step over the kettlebell with alternating legs at higher intensity',
        imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500',
        difficulty: 'intermediate',
        muscleGroups: ['legs', 'core']
      }
    ],
    isCustom: false
  }
];

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { workouts, customWorkouts, favoriteWorkoutIds, toggleFavorite, initializeDefaultWorkouts } = useWorkoutStore() as {
    workouts: Workout[];
    customWorkouts: Workout[];
    favoriteWorkoutIds: string[];
    toggleFavorite: (id: string) => void;
    initializeDefaultWorkouts: () => void;
  };
  const { user } = useUserStore() as { user: any };
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWorkout = async () => {
      setIsLoading(true);
      
      try {
        // Initialize default workouts if needed
        if (workouts.length === 0) {
          initializeDefaultWorkouts();
        }
        
        // Small delay to allow store to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get the updated workouts after initialization
        const allWorkouts = [
          ...workouts,
          ...customWorkouts,
          ...mockWorkouts
        ];
        
        // Find the workout by ID
        let foundWorkout = allWorkouts.find(w => w.id === id);
        
        // If not found, try to find by index for mock data
        if (!foundWorkout) {
          if (id === '1' && mockWorkouts[1]) {
            foundWorkout = mockWorkouts[1];
          } else if (id === '2' && mockWorkouts[2]) {
            foundWorkout = mockWorkouts[2];
          } else if (mockWorkouts[0]) {
            foundWorkout = mockWorkouts[0];
          }
        }
        
        if (foundWorkout) {
          setWorkout(foundWorkout);
        } else {
          console.warn('No workout found for ID:', id);
          setWorkout(null);
        }
      } catch (error) {
        console.error('Error loading workout:', error);
        setWorkout(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      loadWorkout();
    }
  }, [id, workouts.length, customWorkouts.length, initializeDefaultWorkouts]);

  // If still loading, show loading indicator
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </SafeAreaView>
    );
  }

  // If workout is still null after loading, show error state
  if (!workout) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Workout not found</Text>
        <Text style={styles.errorSubText}>The workout you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isFavorite = favoriteWorkoutIds.includes(workout.id);
  const isAppropriateLevel = user?.fitnessLevel === workout.difficulty;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: workout.name,
          headerBackTitle: 'Workouts'
        }}
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image 
          source={{ uri: workout.imageUrl || 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500' }} 
          style={styles.image}
          resizeMode="cover"
        />
        
        <View style={styles.content}>
          <Text style={styles.title}>{workout.name}</Text>
          <Text style={styles.description}>{workout.description}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Clock size={20} color={Colors.text.secondary} />
              <Text style={styles.statText}>{workout.duration} min</Text>
            </View>
            <View style={styles.statItem}>
              <Dumbbell size={20} color={Colors.text.secondary} />
              <Text style={styles.statText}>{workout.exercises.length} exercises</Text>
            </View>
            <View style={styles.statItem}>
              <BarChart2 size={20} color={Colors.text.secondary} />
              <Text style={styles.statText}>{workout.difficulty}</Text>
            </View>
          </View>
          
          {!isAppropriateLevel && user && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                This workout is designed for {workout.difficulty} level, but your profile is set to {user.fitnessLevel}.
              </Text>
            </View>
          )}
          
          <Text style={styles.sectionTitle}>Exercises</Text>
          <View style={styles.exercisesContainer}>
            {workout.exercises.map((exercise, index) => (
              <ExerciseItem 
                key={exercise.id}
                exercise={exercise}
                index={index}
                isLast={index === workout.exercises.length - 1}
              />
            ))}
          </View>
          
          {workout.xpReward && (
            <View style={styles.xpContainer}>
              <Text style={styles.xpText}>Complete this workout to earn {workout.xpReward} XP</Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => toggleFavorite(workout.id)}
        >
          <Heart 
            size={24} 
            color={isFavorite ? Colors.secondary : Colors.text.secondary}
            fill={isFavorite ? Colors.secondary : 'transparent'}
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => {/* Share functionality */}}
        >
          <Share2 size={24} color={Colors.text.secondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.startButton}
          onPress={() => router.push({
            pathname: '/workout/active',
            params: { workoutId: workout.id }
          })}
        >
          <Play size={20} color={Colors.text.inverse} />
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: 240,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 16,
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  warningContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  exercisesContainer: {
    marginBottom: 24,
  },
  xpContainer: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  xpText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 24,
  },
  startButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    marginLeft: 8,
  },
});
import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useWorkoutStore } from '@/store/workoutStore';
import Colors from '@/constants/colors';
import { Exercise } from '@/types';

const WorkoutDetailScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { workouts, favoriteWorkoutIds, toggleFavorite } = useWorkoutStore();
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchWorkout = async () => {
      const workoutData = workouts.find(w => w.id === id);
      if (workoutData) {
        setWorkout(workoutData);
        setLoading(false);
      } else {
        Alert.alert('Error', 'Workout not found');
        router.back();
      }
    };
    fetchWorkout();
  }, [id, workouts, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return null;
  }

  const isFavorite = favoriteWorkoutIds?.includes(workout.id) || false;
  const isAppropriateLevel = user?.fitnessLevel === workout.difficulty;

  const handleStartWorkout = () => {
    router.push({
      pathname: '/workout/active',
      params: { workoutId: workout.id },
    });
  };

  const handleToggleFavorite = () => {
    if (toggleFavorite) {
      toggleFavorite(workout.id);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: workout.name,
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleFavorite}>
              <Text style={{ color: isFavorite ? Colors.primary : Colors.secondary }}>
                {isFavorite ? '❤️' : '🤍'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Image source={{ uri: workout.imageUrl }} style={styles.image} />
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{workout.name}</Text>
        <Text style={styles.difficulty}>Difficulty: {workout.difficulty}</Text>
        {!isAppropriateLevel && (
          <Text style={styles.warning}>
            This workout may not be suitable for your fitness level.
          </Text>
        )}
        <Text style={styles.description}>{workout.description}</Text>
        <Text style={styles.sectionTitle}>Exercises</Text>
        {workout.exercises && workout.exercises.length > 0 ? (
          workout.exercises.map((exercise: Exercise, index: number) => (
            <View key={index} style={styles.exerciseItem}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseDetails}>
                {exercise.sets} sets • {exercise.reps} reps
                {exercise.duration && ` • ${exercise.duration} min`}
                {exercise.restTime && ` • Rest: ${exercise.restTime} sec`}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noExercises}>No exercises available for this workout.</Text>
        )}
        <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  difficulty: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  warning: {
    fontSize: 14,
    color: Colors.error,
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 4,
  },
  description: {
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 24,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  exerciseItem: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  noExercises: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.inverse,
  },
});

export default WorkoutDetailScreen;

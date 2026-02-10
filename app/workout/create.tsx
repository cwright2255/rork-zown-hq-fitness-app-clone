import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { Plus, Trash, Dumbbell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { useWorkoutStore } from '@/store/workoutStore';
import { useAchievementStore } from '@/store/achievementStore';
import { Workout, Exercise, WorkoutCategory } from '@/types';

interface ExerciseInput {
  name?: string;
  description?: string;
  muscleGroups?: string[];
  sets?: number;
  reps?: number;
  restTime?: number;
  equipment?: string[];
  duration?: number;
}

export default function CreateWorkoutScreen() {
  const { addWorkout } = useWorkoutStore() as { addWorkout: (workout: Workout) => void };
  const { updateAchievementProgress } = useAchievementStore() as { updateAchievementProgress: (id: string, progress: number) => void };
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<WorkoutCategory>('strength');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [duration, setDuration] = useState('30');
  const [exercises, setExercises] = useState<ExerciseInput[]>([
    {
      name: '',
      description: '',
      muscleGroups: [],
      sets: 3,
      reps: 10,
      restTime: 60,
      equipment: [],
    }
  ]);
  
  const categories: WorkoutCategory[] = [
    'strength',
    'cardio',
    'flexibility',
    'hiit',
    'yoga',
    'pilates',
    'crossfit',
    'bodyweight',
    'custom',
  ];
  
  const difficulties = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' },
  ];
  
  const handleAddExercise = () => {
    setExercises([
      ...exercises,
      {
        name: '',
        description: '',
        muscleGroups: [],
        sets: 3,
        reps: 10,
        restTime: 60,
        equipment: [],
      } as ExerciseInput
    ]);
  };
  
  const handleRemoveExercise = (index: number) => {
    if (exercises.length === 1) {
      Alert.alert('Cannot Remove', 'Workout must have at least one exercise');
      return;
    }
    
    const updatedExercises = [...exercises];
    updatedExercises.splice(index, 1);
    setExercises(updatedExercises);
  };
  
  const handleExerciseChange = (index: number, field: keyof ExerciseInput, value: string | number | string[]) => {
    const updatedExercises = [...exercises];
    updatedExercises[index] = {
      ...updatedExercises[index],
      [field]: value,
    };
    setExercises(updatedExercises);
  };
  
  const handleSaveWorkout = () => {
    // Validate form
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a workout description');
      return;
    }
    
    if (isNaN(parseInt(duration)) || parseInt(duration) <= 0) {
      Alert.alert('Error', 'Please enter a valid duration');
      return;
    }
    
    // Validate exercises
    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      if (!exercise.name?.trim()) {
        Alert.alert('Error', `Please enter a name for exercise ${i + 1}`);
        return;
      }
      
      if (!exercise.description?.trim()) {
        Alert.alert('Error', `Please enter a description for exercise ${i + 1}`);
        return;
      }
      
      if (isNaN(exercise.sets!) || exercise.sets! <= 0) {
        Alert.alert('Error', `Please enter valid sets for exercise ${i + 1}`);
        return;
      }
      
      if (isNaN(exercise.reps!) || exercise.reps! <= 0) {
        Alert.alert('Error', `Please enter valid reps for exercise ${i + 1}`);
        return;
      }
      
      if (isNaN(exercise.restTime!) || exercise.restTime! < 0) {
        Alert.alert('Error', `Please enter valid rest time for exercise ${i + 1}`);
        return;
      }
    }
    
    // Create workout object
    const newWorkout: Workout = {
      id: `custom-${Date.now()}`,
      name,
      description,
      difficulty,
      duration: parseInt(duration),
      category,
      exercises: exercises.map((exercise, index) => ({
        id: `ex-${Date.now()}-${index}`,
        name: exercise.name!,
        description: exercise.description!,
        muscleGroups: exercise.muscleGroups || [],
        sets: exercise.sets!,
        reps: exercise.reps!,
        duration: exercise.duration,
        restTime: exercise.restTime!,
        equipment: exercise.equipment || [],
      })),
      isCustom: true,
      xpReward: calculateXpReward(difficulty, parseInt(duration)),
    };
    
    // Add workout to store
    addWorkout(newWorkout);
    
    // Update achievement progress
    updateAchievementProgress('custom-workout-1', 1);
    
    // Navigate back
    router.replace(`/workout/${newWorkout.id}`);
  };
  
  // Calculate XP reward based on difficulty and duration
  const calculateXpReward = (difficulty: string, duration: number): number => {
    const baseXp = 50;
    const difficultyMultiplier = 
      difficulty === 'beginner' ? 1 :
      difficulty === 'intermediate' ? 1.5 :
      difficulty === 'advanced' ? 2 : 1;
    
    const durationMultiplier = Math.ceil(duration / 15); // 15 min increments
    
    return Math.round(baseXp * difficultyMultiplier * durationMultiplier);
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Create Workout',
          headerRight: () => (
            <Button
              title="Save"
              onPress={handleSaveWorkout}
              variant="primary"
              size="small"
            />
          ),
        }} 
      />
      
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Details */}
        <Text style={styles.sectionTitle}>Workout Details</Text>
        
        <Input
          label="Workout Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter workout name"
        />
        
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Enter workout description"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          inputStyle={styles.textArea}
        />
        
        <Text style={styles.label}>Category</Text>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                category === cat && styles.selectedCategoryButton
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === cat && styles.selectedCategoryText
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.difficultyContainer}>
          {difficulties.map(diff => (
            <TouchableOpacity
              key={diff.value}
              style={[
                styles.difficultyButton,
                difficulty === diff.value && styles.selectedDifficultyButton
              ]}
              onPress={() => setDifficulty(diff.value as any)}
            >
              <Text
                style={[
                  styles.difficultyText,
                  difficulty === diff.value && styles.selectedDifficultyText
                ]}
              >
                {diff.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <Input
          label="Duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          placeholder="Enter duration"
          keyboardType="number-pad"
        />
        
        {/* Exercises */}
        <View style={styles.exercisesHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <Text style={styles.exercisesCount}>{exercises.length} exercises</Text>
        </View>
        
        {exercises.map((exercise, index) => (
          <Card key={index} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIndex}>{index + 1}</Text>
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => handleRemoveExercise(index)}
              >
                <Trash size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
            
            <Input
              label="Exercise Name"
              value={exercise.name}
              onChangeText={(value) => handleExerciseChange(index, 'name', value)}
              placeholder="Enter exercise name"
            />
            
            <Input
              label="Description"
              value={exercise.description}
              onChangeText={(value) => handleExerciseChange(index, 'description', value)}
              placeholder="Enter exercise description"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              inputStyle={styles.textArea}
            />
            
            <View style={styles.exerciseRow}>
              <Input
                label="Sets"
                value={exercise.sets?.toString()}
                onChangeText={(value) => handleExerciseChange(index, 'sets', parseInt(value) || 0)}
                placeholder="Sets"
                keyboardType="number-pad"
                containerStyle={styles.halfInput}
              />
              
              <Input
                label="Reps"
                value={exercise.reps?.toString()}
                onChangeText={(value) => handleExerciseChange(index, 'reps', parseInt(value) || 0)}
                placeholder="Reps"
                keyboardType="number-pad"
                containerStyle={styles.halfInput}
              />
            </View>
            
            <Input
              label="Rest Time (seconds)"
              value={exercise.restTime?.toString()}
              onChangeText={(value) => handleExerciseChange(index, 'restTime', parseInt(value) || 0)}
              placeholder="Rest time in seconds"
              keyboardType="number-pad"
            />
            
            <Input
              label="Equipment (optional)"
              value={exercise.equipment?.join(', ') || ''}
              onChangeText={(value) => handleExerciseChange(index, 'equipment', value.split(',').map(e => e.trim()))}
              placeholder="Enter equipment, separated by commas"
            />
          </Card>
        ))}
        
        <Button
          title="Add Exercise"
          onPress={handleAddExercise}
          variant="outline"
          leftIcon={<Plus size={20} color={Colors.primary} />}
          style={styles.addButton}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCategoryButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  selectedCategoryText: {
    color: Colors.text.inverse,
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  selectedDifficultyButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  selectedDifficultyText: {
    color: Colors.text.inverse,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  exercisesCount: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  exerciseCard: {
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseIndex: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  removeButton: {
    padding: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  addButton: {
    marginTop: 8,
  },
});
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Plus, Trash, Search, X, BookOpen } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { useWorkoutStore } from '@/store/workoutStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useExerciseStore } from '@/store/exerciseStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';


export default function CreateWorkoutScreen() {
  const { addWorkout } = useWorkoutStore();
  const { updateAchievementProgress } = useAchievementStore();
  const {
    exercises: libraryExercises,
    filteredExercises: libraryFiltered,
    isLoading: libraryLoading,
    hasNextPage: libraryHasNextPage,
    filters: libraryFilters,
    loadExercises: loadLibraryExercises,
    setFilter: setLibraryFilter,
  } = useExerciseStore();

  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (pickerVisible && libraryExercises.length === 0) {
      loadLibraryExercises(true);
    }
  }, [pickerVisible]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('strength');
  const [difficulty, setDifficulty] = useState('beginner');
  const [duration, setDuration] = useState('30');
  const [exercises, setExercises] = useState([
  {
    name: '',
    description: '',
    muscleGroups: [],
    sets: 3,
    reps: 10,
    restTime: 60,
    equipment: []
  }]
  );

  const categories = [
  'strength',
  'cardio',
  'flexibility',
  'hiit',
  'yoga',
  'pilates',
  'crossfit',
  'bodyweight',
  'custom'];


  const difficulties = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' }];


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
      equipment: []
    }]
    );
  };

  const handlePickFromLibrary = (libExercise) => {
    const equipments = Array.isArray(libExercise.equipments) ? libExercise.equipments : [];
    const muscles = Array.isArray(libExercise.targetMuscles) ? libExercise.targetMuscles : [];
    const description = Array.isArray(libExercise.instructions)
      ? libExercise.instructions.slice(0, 2).map((s) => String(s).replace(/^Step:\d+\s*/i, '')).join(' ')
      : '';
    const newEx = {
      name: libExercise.name || '',
      description,
      muscleGroups: muscles,
      sets: 3,
      reps: 10,
      restTime: 60,
      equipment: equipments,
    };
    setExercises((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.name?.trim()) {
        const copy = [...prev];
        copy[copy.length - 1] = newEx;
        return copy;
      }
      return [...prev, newEx];
    });
    setPickerVisible(false);
  };

  const handleRemoveExercise = (index) => {
    if (exercises.length === 1) {
      Alert.alert('Cannot Remove', 'Workout must have at least one exercise');
      return;
    }

    const updatedExercises = [...exercises];
    updatedExercises.splice(index, 1);
    setExercises(updatedExercises);
  };

  const handleExerciseChange = (index, field, value) => {
    const updatedExercises = [...exercises];
    updatedExercises[index] = {
      ...updatedExercises[index],
      [field]: value
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

      if (isNaN(exercise.sets) || exercise.sets <= 0) {
        Alert.alert('Error', `Please enter valid sets for exercise ${i + 1}`);
        return;
      }

      if (isNaN(exercise.reps) || exercise.reps <= 0) {
        Alert.alert('Error', `Please enter valid reps for exercise ${i + 1}`);
        return;
      }

      if (isNaN(exercise.restTime) || exercise.restTime < 0) {
        Alert.alert('Error', `Please enter valid rest time for exercise ${i + 1}`);
        return;
      }
    }

    // Create workout object
    const newWorkout = {
      id: `custom-${Date.now()}`,
      name,
      description,
      difficulty,
      duration: parseInt(duration),
      category,
      exercises: exercises.map((exercise, index) => ({
        id: `ex-${Date.now()}-${index}`,
        name: exercise.name,
        description: exercise.description,
        muscleGroups: exercise.muscleGroups || [],
        sets: exercise.sets,
        reps: exercise.reps,
        duration: exercise.duration,
        restTime: exercise.restTime,
        equipment: exercise.equipment || []
      })),
      isCustom: true,
      xpReward: calculateXpReward(difficulty, parseInt(duration))
    };

    // Add workout to store
    addWorkout(newWorkout);

    // Update achievement progress
    updateAchievementProgress('custom-workout-1', 1);

    // Navigate back
    router.replace(`/workout/${newWorkout.id}`);
  };

  // Calculate XP reward based on difficulty and duration
  const calculateXpReward = (difficulty, duration) => {
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
          headerRight: () =>
          <Button
            title="Save"
            onPress={handleSaveWorkout}
            variant="primary"
            size="small" />


        }} />
      
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        {/* Workout Details */}
        <Text style={styles.sectionTitle}>Workout Details</Text>
        
        <Input
          label="Workout Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter workout name" />
        
        
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Enter workout description"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          inputStyle={styles.textArea} />
        
        
        <Text style={styles.label}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}>
          
          {categories.map((cat) =>
          <TouchableOpacity
            key={cat}
            style={[
            styles.categoryButton,
            category === cat && styles.selectedCategoryButton]
            }
            onPress={() => setCategory(cat)}>
            
              <Text
              style={[
              styles.categoryText,
              category === cat && styles.selectedCategoryText]
              }>
              
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        
        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.difficultyContainer}>
          {difficulties.map((diff) =>
          <TouchableOpacity
            key={diff.value}
            style={[
            styles.difficultyButton,
            difficulty === diff.value && styles.selectedDifficultyButton]
            }
            onPress={() => setDifficulty(diff.value)}>
            
              <Text
              style={[
              styles.difficultyText,
              difficulty === diff.value && styles.selectedDifficultyText]
              }>
              
                {diff.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <Input
          label="Duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          placeholder="Enter duration"
          keyboardType="number-pad" />
        
        
        {/* Exercises */}
        <View style={styles.exercisesHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <Text style={styles.exercisesCount}>{exercises.length} exercises</Text>
        </View>
        
        {exercises.map((exercise, index) =>
        <Card key={index} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIndex}>{index + 1}</Text>
              <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveExercise(index)}>
              
                <Trash size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
            
            <Input
            label="Exercise Name"
            value={exercise.name}
            onChangeText={(value) => handleExerciseChange(index, 'name', value)}
            placeholder="Enter exercise name" />
          
            
            <Input
            label="Description"
            value={exercise.description}
            onChangeText={(value) => handleExerciseChange(index, 'description', value)}
            placeholder="Enter exercise description"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            inputStyle={styles.textArea} />
          
            
            <View style={styles.exerciseRow}>
              <Input
              label="Sets"
              value={exercise.sets?.toString()}
              onChangeText={(value) => handleExerciseChange(index, 'sets', parseInt(value) || 0)}
              placeholder="Sets"
              keyboardType="number-pad"
              containerStyle={styles.halfInput} />
            
              
              <Input
              label="Reps"
              value={exercise.reps?.toString()}
              onChangeText={(value) => handleExerciseChange(index, 'reps', parseInt(value) || 0)}
              placeholder="Reps"
              keyboardType="number-pad"
              containerStyle={styles.halfInput} />
            
            </View>
            
            <Input
            label="Rest Time (seconds)"
            value={exercise.restTime?.toString()}
            onChangeText={(value) => handleExerciseChange(index, 'restTime', parseInt(value) || 0)}
            placeholder="Rest time in seconds"
            keyboardType="number-pad" />
          
            
            <Input
            label="Equipment (optional)"
            value={exercise.equipment?.join(', ') || ''}
            onChangeText={(value) => handleExerciseChange(index, 'equipment', value.split(',').map((e) => e.trim()))}
            placeholder="Enter equipment, separated by commas" />
          
          </Card>
        )}
        
        <Button
          title="Add Exercise from Library"
          onPress={() => setPickerVisible(true)}
          variant="primary"
          leftIcon={<BookOpen size={20} color={Colors.text.inverse} />}
          style={styles.addButton} />


        <Button
          title="Add Blank Exercise"
          onPress={handleAddExercise}
          variant="outline"
          leftIcon={<Plus size={20} color={Colors.primary} />}
          style={styles.addButton} />

      </ScrollView>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={pickerStyles.safe}>
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.headerTitle}>ADD EXERCISE</Text>
            <TouchableOpacity
              style={pickerStyles.closeBtn}
              onPress={() => setPickerVisible(false)}
              accessibilityLabel="Close"
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={pickerStyles.searchWrap}>
            <Search size={16} color="#999999" />
            <TextInput
              style={pickerStyles.searchInput}
              placeholder="Search exercises"
              placeholderTextColor="#555555"
              value={libraryFilters.query}
              onChangeText={(text) => setLibraryFilter('query', text)}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {libraryLoading && libraryExercises.length === 0 ? (
            <View style={pickerStyles.loadingWrap}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={pickerStyles.loadingText}>Loading exercises…</Text>
            </View>
          ) : (
            <FlatList
              data={(libraryFilters.query || libraryFilters.bodyPart || libraryFilters.equipment || libraryFilters.muscle) ? libraryFiltered : libraryExercises}
              keyExtractor={(item) => String(item.exerciseId)}
              contentContainerStyle={pickerStyles.listContent}
              renderItem={({ item }) => {
                const equipment = (item.equipments || [])[0] || '';
                const target = (item.targetMuscles || [])[0] || '';
                return (
                  <TouchableOpacity
                    style={pickerStyles.row}
                    onPress={() => handlePickFromLibrary(item)}
                    activeOpacity={0.85}
                  >
                    {item.gifUrl ? (
                      <Image source={{ uri: item.gifUrl }} style={pickerStyles.thumb} resizeMode="cover" />
                    ) : (
                      <View style={pickerStyles.thumb} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={pickerStyles.rowTitle} numberOfLines={2}>{item.name}</Text>
                      <Text style={pickerStyles.rowMeta} numberOfLines={1}>
                        {[equipment, target].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListFooterComponent={
                libraryHasNextPage ? (
                  <TouchableOpacity
                    style={pickerStyles.loadMore}
                    onPress={() => loadLibraryExercises(false)}
                    disabled={libraryLoading}
                    activeOpacity={0.85}
                  >
                    {libraryLoading ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={pickerStyles.loadMoreText}>LOAD MORE</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </>);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border
  },
  selectedCategoryButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  categoryText: {
    fontSize: 14,
    color: Colors.text.secondary
  },
  selectedCategoryText: {
    color: Colors.text.inverse
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center'
  },
  selectedDifficultyButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary
  },
  selectedDifficultyText: {
    color: Colors.text.inverse
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16
  },
  exercisesCount: {
    fontSize: 14,
    color: Colors.text.secondary
  },
  exerciseCard: {
    marginBottom: 16
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  exerciseIndex: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary
  },
  removeButton: {
    padding: 8
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  halfInput: {
    width: '48%'
  },
  addButton: {
    marginTop: 8
  }
});

const pickerStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 14, padding: 0 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#999999', fontSize: 12 },
  listContent: { padding: 24, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#111111' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', textTransform: 'capitalize' },
  rowMeta: { fontSize: 12, color: '#999999', marginTop: 4, textTransform: 'capitalize' },
  loadMore: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  loadMoreText: { color: '#000000', fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
});
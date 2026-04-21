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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Plus, Trash, Search, X, BookOpen } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import ScreenHeader from '@/components/ScreenHeader';
import { useWorkoutStore } from '@/store/workoutStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useExerciseStore } from '@/store/exerciseStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const CATEGORIES = ['strength', 'cardio', 'flexibility', 'hiit', 'yoga', 'pilates', 'crossfit', 'bodyweight', 'custom'];
const DIFFICULTIES = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
];

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('strength');
  const [difficulty, setDifficulty] = useState('beginner');
  const [duration, setDuration] = useState('30');
  const [exercises, setExercises] = useState([
    { name: '', description: '', muscleGroups: [], sets: 3, reps: 10, restTime: 60, equipment: [] },
  ]);

  useEffect(() => {
    if (pickerVisible && libraryExercises.length === 0) {
      loadLibraryExercises(true);
    }
  }, [pickerVisible]);

  const handleAddExercise = () => {
    setExercises([
      ...exercises,
      { name: '', description: '', muscleGroups: [], sets: 3, reps: 10, restTime: 60, equipment: [] },
    ]);
  };

  const handlePickFromLibrary = (libExercise) => {
    const equipments = Array.isArray(libExercise.equipments) ? libExercise.equipments : [];
    const muscles = Array.isArray(libExercise.targetMuscles) ? libExercise.targetMuscles : [];
    const desc = Array.isArray(libExercise.instructions)
      ? libExercise.instructions.slice(0, 2).map((s) => String(s).replace(/^Step:\d+\s*/i, '')).join(' ')
      : '';
    const newEx = {
      name: libExercise.name || '',
      description: desc,
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
    const updated = [...exercises];
    updated.splice(index, 1);
    setExercises(updated);
  };

  const handleExerciseChange = (index, field, value) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const calculateXpReward = (diff, dur) => {
    const baseXp = 50;
    const mult = diff === 'beginner' ? 1 : diff === 'intermediate' ? 1.5 : diff === 'advanced' ? 2 : 1;
    return Math.round(baseXp * mult * Math.ceil(dur / 15));
  };

  const handleSaveWorkout = () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter a workout name'); return; }
    if (!description.trim()) { Alert.alert('Error', 'Please enter a workout description'); return; }
    if (isNaN(parseInt(duration)) || parseInt(duration) <= 0) { Alert.alert('Error', 'Please enter a valid duration'); return; }

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      if (!ex.name?.trim()) { Alert.alert('Error', `Please enter a name for exercise ${i + 1}`); return; }
      if (!ex.description?.trim()) { Alert.alert('Error', `Please enter a description for exercise ${i + 1}`); return; }
      if (isNaN(ex.sets) || ex.sets <= 0) { Alert.alert('Error', `Please enter valid sets for exercise ${i + 1}`); return; }
      if (isNaN(ex.reps) || ex.reps <= 0) { Alert.alert('Error', `Please enter valid reps for exercise ${i + 1}`); return; }
      if (isNaN(ex.restTime) || ex.restTime < 0) { Alert.alert('Error', `Please enter valid rest time for exercise ${i + 1}`); return; }
    }

    const newWorkout = {
      id: `custom-${Date.now()}`,
      name,
      description,
      difficulty,
      duration: parseInt(duration),
      category,
      exercises: exercises.map((ex, i) => ({
        id: `ex-${Date.now()}-${i}`,
        name: ex.name,
        description: ex.description,
        muscleGroups: ex.muscleGroups || [],
        sets: ex.sets,
        reps: ex.reps,
        duration: ex.duration,
        restTime: ex.restTime,
        equipment: ex.equipment || [],
      })),
      isCustom: true,
      xpReward: calculateXpReward(difficulty, parseInt(duration)),
    };

    addWorkout(newWorkout);
    updateAchievementProgress('custom-workout-1', 1);
    router.replace(`/workout/${newWorkout.id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Create Workout" showBack />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <Text style={styles.sectionLabel}>WORKOUT NAME</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter workout name"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <View style={[styles.inputRow, { minHeight: 100, alignItems: 'flex-start', paddingVertical: spacing.md }]}>
          <TextInput
            style={[styles.input, { textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter workout description"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>

        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, category === cat && styles.pillActive]}
              onPress={() => setCategory(cat)}>
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>DIFFICULTY</Text>
        <View style={styles.pillRow}>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d.value}
              style={[styles.pill, { flex: 1, alignItems: 'center' }, difficulty === d.value && styles.pillActive]}
              onPress={() => setDifficulty(d.value)}>
              <Text style={[styles.pillText, difficulty === d.value && styles.pillTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>DURATION (MINUTES)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={duration}
            onChangeText={setDuration}
            placeholder="Enter duration"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.exercisesHeader}>
          <Text style={[styles.sectionLabel, { marginTop: 0 }]}>EXERCISES</Text>
          <Text style={styles.exercisesCount}>{exercises.length}</Text>
        </View>

        {exercises.map((exercise, index) => (
          <View key={index} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIndex}>{index + 1}</Text>
              <TouchableOpacity onPress={() => handleRemoveExercise(index)} hitSlop={8}>
                <Trash size={18} color={colors.red} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={exercise.name}
                onChangeText={(v) => handleExerciseChange(index, 'name', v)}
                placeholder="Exercise name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={[styles.inputRow, { marginTop: spacing.sm, minHeight: 80, alignItems: 'flex-start', paddingVertical: spacing.md }]}>
              <TextInput
                style={[styles.input, { textAlignVertical: 'top' }]}
                value={exercise.description}
                onChangeText={(v) => handleExerciseChange(index, 'description', v)}
                placeholder="Exercise description"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </View>

            <View style={styles.exerciseRow}>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <TextInput
                  style={styles.input}
                  value={exercise.sets?.toString()}
                  onChangeText={(v) => handleExerciseChange(index, 'sets', parseInt(v) || 0)}
                  placeholder="Sets"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <TextInput
                  style={styles.input}
                  value={exercise.reps?.toString()}
                  onChangeText={(v) => handleExerciseChange(index, 'reps', parseInt(v) || 0)}
                  placeholder="Reps"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={[styles.inputRow, { marginTop: spacing.sm }]}>
              <TextInput
                style={styles.input}
                value={exercise.restTime?.toString()}
                onChangeText={(v) => handleExerciseChange(index, 'restTime', parseInt(v) || 0)}
                placeholder="Rest (seconds)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>

            <View style={[styles.inputRow, { marginTop: spacing.sm }]}>
              <TextInput
                style={styles.input}
                value={exercise.equipment?.join(', ') || ''}
                onChangeText={(v) => handleExerciseChange(index, 'equipment', v.split(',').map((e) => e.trim()))}
                placeholder="Equipment (comma separated)"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
        ))}

        <PrimaryButton
          title="Add Exercise from Library"
          onPress={() => setPickerVisible(true)}
          leftIcon={<BookOpen size={18} color="#000" />}
          style={styles.addBtn}
        />

        <PrimaryButton
          title="Add Blank Exercise"
          variant="outline"
          onPress={handleAddExercise}
          leftIcon={<Plus size={18} color={colors.text} />}
          style={styles.addBtn}
        />
      </ScrollView>

      <View style={styles.stickyFooter}>
        <PrimaryButton title="Save Workout" onPress={handleSaveWorkout} />
      </View>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setPickerVisible(false)}
              accessibilityLabel="Close"
              hitSlop={8}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises"
              placeholderTextColor={colors.textTertiary}
              value={libraryFilters.query}
              onChangeText={(text) => setLibraryFilter('query', text)}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {libraryLoading && libraryExercises.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.loadingText}>Loading exercises…</Text>
            </View>
          ) : (
            <FlatList
              data={(libraryFilters.query || libraryFilters.bodyPart || libraryFilters.equipment || libraryFilters.muscle) ? libraryFiltered : libraryExercises}
              keyExtractor={(item) => String(item.exerciseId)}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
              renderItem={({ item }) => {
                const equipment = (item.equipments || [])[0] || '';
                const target = (item.targetMuscles || [])[0] || '';
                return (
                  <TouchableOpacity
                    style={styles.libRow}
                    onPress={() => handlePickFromLibrary(item)}
                    activeOpacity={0.85}>
                    {item.gifUrl ? (
                      <Image source={{ uri: item.gifUrl }} style={styles.libThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.libThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                        <BookOpen size={18} color={colors.text} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.libTitle} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.libMeta} numberOfLines={1}>
                        {[equipment, target].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              ListFooterComponent={
                libraryHasNextPage ? (
                  <TouchableOpacity
                    style={styles.libLoadMore}
                    onPress={() => loadLibraryExercises(false)}
                    disabled={libraryLoading}
                    activeOpacity={0.85}>
                    {libraryLoading ? (
                      <ActivityIndicator color={colors.text} />
                    ) : (
                      <Text style={styles.libLoadMoreText}>Load More</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 120 },
  sectionLabel: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  inputRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    minHeight: 56,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 16, color: colors.text },
  pillScroll: { gap: spacing.sm, paddingRight: spacing.lg },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  pillActive: { backgroundColor: colors.text, borderColor: colors.text },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.text },
  pillTextActive: { color: '#000' },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  exercisesCount: { ...typography.h3 },
  exerciseCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseIndex: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addBtn: { marginTop: spacing.md },
  stickyFooter: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pickerTitle: { ...typography.h2 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...typography.caption },
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  libThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  libTitle: { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  libMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textTransform: 'capitalize' },
  libLoadMore: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  libLoadMoreText: { color: colors.text, fontWeight: '700', fontSize: 14 },
});

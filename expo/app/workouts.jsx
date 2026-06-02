import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Plus, Search, ChevronRight, Dumbbell, Heart, ArrowUp, ArrowDown } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useExerciseStore } from '@/store/exerciseStore';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Strength', value: 'upper arms|back|chest|shoulders', Icon: Dumbbell },
  { label: 'Cardio', value: 'cardio', Icon: Heart },
  { label: 'Upper Body', value: 'chest|shoulders|upper arms|back', Icon: ArrowUp },
  { label: 'Lower Body', value: 'upper legs|lower legs', Icon: ArrowDown },
];

function ExerciseRow({ exercise }) {
  const equipment = (exercise.equipments || []).map((e) => e.name).join(', ') || 'Bodyweight';
  const muscles = (exercise.primaryMuscles || []).map((m) => m.name).join(', ');

  return (
    <TouchableOpacity
      style={styles.exerciseCard}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: exercise.id } })}
      activeOpacity={0.7}>
      {exercise.gifUrl ? (
        <Image source={{ uri: exercise.gifUrl }} style={styles.exerciseImage} />
      ) : (
        <View style={styles.exercisePlaceholder}>
          <Dumbbell size={24} color={tokens.colors.dark_navy.text_muted} />
        </View>
      )}
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={styles.exerciseMeta} numberOfLines={1}>
          {muscles}
        </Text>
        <Text style={styles.exerciseEquipment} numberOfLines={1}>
          {equipment}
        </Text>
      </View>
      <ChevronRight size={20} color={tokens.colors.dark_navy.text_muted} />
    </TouchableOpacity>
  );
}

export default function WorkoutsScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const { exercises, loading, error, fetchExercises } = useExerciseStore();

  useEffect(() => {
    if (!exercises || exercises.length === 0) {
      fetchExercises();
    }
  }, []);

  const filtered = React.useMemo(() => {
    if (!exercises) return [];
    let result = exercises;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          (e.primaryMuscles || []).some((m) => m.name?.toLowerCase().includes(q))
      );
    }
    if (activeFilter) {
      const parts = activeFilter.split('|');
      result = result.filter((e) =>
        (e.primaryMuscles || []).some((m) =>
          parts.some((p) => m.name?.toLowerCase().includes(p))
        )
      );
    }
    return result;
  }, [exercises, search, activeFilter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Workouts" rightAction={
        <TouchableOpacity onPress={() => router.push('/workout/create')} hitSlop={8}>
          <Plus size={24} color={tokens.colors.dark_navy.text_primary} />
        </TouchableOpacity>
      } />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={tokens.colors.dark_navy.text_muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={tokens.colors.dark_navy.text_hint}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}>
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.value;
          return (
            <TouchableOpacity
              key={f.label}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(isActive ? '' : f.value)}>
              {f.Icon ? (
                <f.Icon
                  size={14}
                  color={isActive ? tokens.colors.dark_navy.text_primary : tokens.colors.dark_navy.text_secondary}
                  style={{ marginRight: 4 }}
                />
              ) : null}
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tokens.colors.brand.base} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchExercises}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => <ExerciseRow exercise={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No exercises found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.dark_navy.bg_primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.dark_navy.bg_input,
    borderRadius: tokens.radius.md,
    marginHorizontal: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    height: 44,
    marginBottom: tokens.spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: tokens.spacing.sm,
    fontSize: 15,
    color: tokens.colors.dark_navy.text_primary,
  },
  filterScroll: {
    maxHeight: 48,
    marginBottom: tokens.spacing.sm,
  },
  filterContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.dark_navy.bg_card,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.colors.dark_navy.border,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.brand.base,
    borderColor: tokens.colors.brand.base,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.dark_navy.text_secondary,
  },
  filterLabelActive: {
    color: tokens.colors.dark_navy.text_primary,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: 100,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.dark_navy.bg_card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  exerciseImage: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.dark_navy.bg_input,
  },
  exercisePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.dark_navy.bg_input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: tokens.spacing.md,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.dark_navy.text_primary,
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: 13,
    color: tokens.colors.dark_navy.text_secondary,
    marginBottom: 2,
  },
  exerciseEquipment: {
    fontSize: 12,
    color: tokens.colors.dark_navy.text_muted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  errorText: {
    fontSize: 15,
    color: tokens.colors.red.base,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  retryBtn: {
    backgroundColor: tokens.colors.brand.base,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
  },
  retryText: {
    color: tokens.colors.dark_navy.text_primary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: tokens.colors.dark_navy.text_muted,
  },
});

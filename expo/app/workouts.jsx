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
import { colors, typography, spacing, radius } from '@/constants/theme';
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
  const equipment = (exercise.equipments || [])[0] || '';
  const target = (exercise.targetMuscles || [])[0] || '';
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: exercise.exerciseId } })}
      activeOpacity={0.85}
    >
      {exercise.gifUrl ? (
        <Image source={{ uri: exercise.gifUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Dumbbell size={18} color={colors.text} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>{exercise.name}</Text>
        <View style={styles.rowTags}>
          {!!equipment && <Text style={styles.rowTag}>{equipment}</Text>}
          {!!target && <Text style={styles.rowTag}>â¢ {target}</Text>}
        </View>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function WorkoutsScreen() {
  const {
    exercises,
    filteredExercises,
    isLoading,
    hasNextPage,
    filters,
    loadExercises,
    loadEquipments,
    loadMuscles,
    setFilter,
  } = useExerciseStore();

  const [activePill, setActivePill] = useState('');

  useEffect(() => {
    if (exercises.length === 0) {
      loadExercises(true);
    }
    loadEquipments();
    loadMuscles();
  }, []);

  const list = (filters.query || filters.bodyPart || filters.equipment || filters.muscle)
    ? filteredExercises
    : exercises;

  const onPressPill = (value) => {
    setActivePill(value);
    setFilter('bodyPart', value);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Workouts"
        subtitle="PICK YOUR MISSION"
        rightAction={
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/workout/create')}
            accessibilityLabel="Create workout"
          >
            <Plus size={18} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchWrap}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          value={filters.query}
          onChangeText={(text) => setFilter('query', text)}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(({ label, value, Icon }) => {
          const active = activePill === value;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => onPressPill(value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              activeOpacity={0.85}
            >
              {Icon && <Icon size={14} color={active ? colors.bg : colors.textSecondary} />}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading && list.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>Loading exercisesâ¦</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.exerciseId)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <ExerciseRow exercise={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Dumbbell size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No exercises</Text>
              <Text style={styles.emptyText}>Try a different search or filter.</Text>
            </View>
          }
          ListFooterComponent={
            hasNextPage ? (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={() => loadExercises(false)}
                activeOpacity={0.85}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/workout/create')}
        activeOpacity={0.85}
        accessibilityLabel="Create workout"
      >
        <Plus size={24} color={colors.bg} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.h1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    padding: 0,
  },
  filters: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: colors.bg },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  rowTags: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rowTag: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...typography.caption },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...typography.h3, marginTop: spacing.sm },
  emptyText: { ...typography.caption },
  loadMore: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  loadMoreText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.grayscale.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Plus, Search, Dumbbell, Zap, Flame, Heart, Activity, CheckSquare, Square } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useWorkoutStore } from '@/store/workoutStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Strength', value: 'strength', Icon: Dumbbell },
  { label: 'Cardio', value: 'cardio', Icon: Heart },
  { label: 'HIIT', value: 'hiit', Icon: Flame },
  { label: 'Yoga', value: 'yoga', Icon: Activity },
];

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Complete', value: 'complete' },
  { label: 'Pending', value: 'pending' },
];

const FALLBACK_WORKOUTS = [
  { id: 'fb1', name: 'Full Body Burn', duration: 32, difficulty: 'INTENSE', category: 'hiit' },
  { id: 'fb2', name: 'Upper Body Power', duration: 45, difficulty: 'HARD', category: 'strength' },
  { id: 'fb3', name: '5K Run', duration: 28, difficulty: 'MODERATE', category: 'cardio' },
  { id: 'fb4', name: 'Core Crusher', duration: 20, difficulty: 'INTENSE', category: 'hiit' },
  { id: 'fb5', name: 'Morning Flow', duration: 35, difficulty: 'EASY', category: 'yoga' },
  { id: 'fb6', name: 'Leg Day', duration: 50, difficulty: 'HARD', category: 'strength' },
];

function WorkoutCard({ workout }) {
  const done = !!workout.completed;
  const CheckIcon = done ? CheckSquare : Square;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/workout/${workout.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardRow}>
        <CheckIcon size={22} color={done ? colors.text : colors.textSecondary} />
        <View style={styles.cardThumb}>
          <Dumbbell size={18} color={colors.text} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>{(workout.category || 'WORKOUT').toUpperCase()}</Text>
            <View style={styles.cardPill}>
              <Text style={styles.cardPillText}>{workout.difficulty || 'MODERATE'}</Text>
            </View>
          </View>
          <Text style={[styles.cardTitle, done && styles.cardTitleDone]} numberOfLines={2}>{workout.name}</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardMeta}>{workout.duration || 30} MIN</Text>
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>{done ? 'DONE' : 'START'}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function WorkoutsScreen() {
  const { workouts, initializeDefaultWorkouts } = useWorkoutStore();
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const initialized = useRef(false);

  useEffect(() => {
    if ((!workouts || workouts.length === 0) && !initialized.current) {
      initialized.current = true;
      requestAnimationFrame(() => initializeDefaultWorkouts());
    }
  }, [workouts, initializeDefaultWorkouts]);

  const list = useMemo(() => {
    const base = (workouts && workouts.length > 0) ? workouts : FALLBACK_WORKOUTS;
    let filtered = filter === 'all' ? base : base.filter((w) => (w.category || '').toLowerCase() === filter);
    if (statusFilter === 'complete') filtered = filtered.filter((w) => !!w.completed);
    else if (statusFilter === 'pending') filtered = filtered.filter((w) => !w.completed);
    return filtered;
  }, [workouts, filter, statusFilter]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>WORKOUTS</Text>
        <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Search">
          <Search size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        {STATUS_FILTERS.map(({ label, value }) => {
          const active = statusFilter === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setStatusFilter(value)}
              style={[styles.statusPill, active && styles.statusPillActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(({ label, value, Icon }) => {
          const active = filter === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setFilter(value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              activeOpacity={0.85}
            >
              {Icon && <Icon size={14} color={active ? colors.bg : colors.textSecondary} />}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <WorkoutCard workout={item} />}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Zap size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No workouts</Text>
            <Text style={styles.emptyText}>Try a different filter.</Text>
          </View>
        }
      />

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
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statusPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  statusPillText: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  statusPillTextActive: { color: colors.bg },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm, flexDirection: 'row' },
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardLabel: { ...typography.label },
  cardPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.text,
  },
  cardPillText: { ...typography.caption, fontWeight: '800', color: colors.text, fontSize: 10, letterSpacing: 1 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta: { ...typography.body, fontWeight: '700', color: colors.textSecondary },
  cardCta: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  cardCtaText: { color: colors.bg, fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...typography.h3, marginTop: spacing.sm },
  emptyText: { ...typography.caption },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});

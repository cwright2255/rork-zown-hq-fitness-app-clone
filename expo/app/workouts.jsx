import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Plus, Search, Dumbbell, Zap, Flame, Heart, Activity } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useWorkoutStore } from '@/store/workoutStore';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Strength', value: 'strength', Icon: Dumbbell },
  { label: 'Cardio', value: 'cardio', Icon: Heart },
  { label: 'HIIT', value: 'hiit', Icon: Flame },
  { label: 'Yoga', value: 'yoga', Icon: Activity },
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
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/workout/${workout.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{(workout.category || 'WORKOUT').toUpperCase()}</Text>
        <View style={styles.cardPill}>
          <Text style={styles.cardPillText}>{workout.difficulty || 'MODERATE'}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{workout.name}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{workout.duration || 30} MIN</Text>
        <View style={styles.cardCta}>
          <Text style={styles.cardCtaText}>START</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function WorkoutsScreen() {
  const { workouts, initializeDefaultWorkouts } = useWorkoutStore();
  const [filter, setFilter] = useState('all');
  const initialized = useRef(false);

  useEffect(() => {
    if ((!workouts || workouts.length === 0) && !initialized.current) {
      initialized.current = true;
      requestAnimationFrame(() => initializeDefaultWorkouts());
    }
  }, [workouts, initializeDefaultWorkouts]);

  const list = useMemo(() => {
    const base = (workouts && workouts.length > 0) ? workouts : FALLBACK_WORKOUTS;
    if (filter === 'all') return base;
    return base.filter((w) => (w.category || '').toLowerCase() === filter);
  }, [workouts, filter]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>WORKOUTS</Text>
        <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Search">
          <Search size={18} color={colors.text} />
        </TouchableOpacity>
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

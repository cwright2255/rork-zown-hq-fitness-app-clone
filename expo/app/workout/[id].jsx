import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useExerciseStore } from '@/store/exerciseStore';
import { fetchExerciseById } from '@/services/exerciseDbService';
import {
  getWorkoutVisualizeUrl,
  normalizeMuscleNames,
} from '@/services/muscleVisualizerService';
import { tokens } from '../../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { exercises } = useExerciseStore();
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const cached = exercises?.find((e) => String(e.id) === id);
        if (cached) {
          if (mounted) { setExercise(cached); setLoading(false); }
          return;
        }
        const fetched = await fetchExerciseById(id);
        if (mounted) { setExercise(fetched); setLoading(false); }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  const muscleNames = exercise
    ? normalizeMuscleNames((exercise.primaryMuscles || []).map((m) => m.name))
    : [];
  const muscleUrl = muscleNames.length > 0 ? getWorkoutVisualizeUrl(muscleNames) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tokens.colors.brand.base} />
        </View>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Exercise not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const equipment = (exercise.equipments || []).map((e) => e.name).join(', ') || 'Bodyweight';
  const primaryMuscles = (exercise.primaryMuscles || []).map((m) => m.name).join(', ');
  const secondaryMuscles = (exercise.secondaryMuscles || []).map((m) => m.name).join(', ');
  const instructions = exercise.instructions || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} hitSlop={8}>
            <ChevronLeft size={24} color={tokens.colors.dark_navy.text_primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{exercise.name}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Exercise GIF */}
        {exercise.gifUrl ? (
          <View style={styles.gifContainer}>
            <Image source={{ uri: exercise.gifUrl }} style={styles.gif} resizeMode="contain" />
          </View>
        ) : null}

        {/* Info Cards */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Equipment</Text>
            <Text style={styles.infoValue}>{equipment}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Body Part</Text>
            <Text style={styles.infoValue}>{exercise.bodyPart || 'N/A'}</Text>
          </View>
        </View>

        {/* Target Muscles */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Target Muscles</Text>
          <View style={styles.muscleRow}>
            {primaryMuscles ? (
              <View style={styles.muscleBadge}>
                <Text style={styles.muscleBadgeText}>{primaryMuscles}</Text>
              </View>
            ) : null}
          </View>
          {secondaryMuscles ? (
            <>
              <Text style={styles.secondaryLabel}>Secondary</Text>
              <View style={styles.muscleRow}>
                <View style={[styles.muscleBadge, styles.secondaryBadge]}>
                  <Text style={styles.secondaryBadgeText}>{secondaryMuscles}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Muscle Visualization */}
        {muscleUrl ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Muscle Map</Text>
            <Image source={{ uri: muscleUrl }} style={styles.muscleImage} resizeMode="contain" />
          </View>
        ) : null}

        {/* Instructions */}
        {instructions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Instructions</Text>
            {instructions.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Start Workout Button */}
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => router.push({ pathname: '/workout/active', params: { exerciseId: id } })}>
          <Text style={styles.startBtnText}>Start Workout</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.bg_primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl },
  errorText: { fontSize: 16, color: tokens.colors.red.base, marginBottom: tokens.spacing.md },
  backBtn: { backgroundColor: tokens.colors.brand.base, paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm, borderRadius: tokens.radius.md },
  backBtnText: { color: tokens.colors.dark_navy.text_primary, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.md },
  headerBack: { width: 40, height: 40, borderRadius: tokens.radius.md, backgroundColor: tokens.colors.dark_navy.bg_card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: tokens.colors.dark_navy.text_primary, textAlign: 'center' },
  gifContainer: { marginHorizontal: tokens.spacing.md, borderRadius: tokens.radius.lg, overflow: 'hidden', backgroundColor: tokens.colors.dark_navy.bg_card, marginBottom: tokens.spacing.md },
  gif: { width: '100%', height: 280 },
  infoRow: { flexDirection: 'row', paddingHorizontal: tokens.spacing.md, gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  infoCard: { flex: 1, backgroundColor: tokens.colors.dark_navy.bg_card, borderRadius: tokens.radius.lg, padding: tokens.spacing.md, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.xs },
  infoValue: { fontSize: 15, fontWeight: '600', color: tokens.colors.dark_navy.text_primary, textAlign: 'center' },
  card: { backgroundColor: tokens.colors.dark_navy.bg_card, borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginHorizontal: tokens.spacing.md, marginBottom: tokens.spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.dark_navy.text_primary, marginBottom: tokens.spacing.md },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  muscleBadge: { backgroundColor: tokens.colors.red.base + '20', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.xs, borderRadius: tokens.radius.full },
  muscleBadgeText: { fontSize: 13, fontWeight: '600', color: tokens.colors.red.base },
  secondaryLabel: { fontSize: 13, color: tokens.colors.dark_navy.text_muted, marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.xs },
  secondaryBadge: { backgroundColor: tokens.colors.yellow.base + '20' },
  secondaryBadgeText: { fontSize: 13, fontWeight: '600', color: tokens.colors.yellow.base },
  muscleImage: { width: '100%', height: 200, borderRadius: tokens.radius.md },
  stepRow: { flexDirection: 'row', marginBottom: tokens.spacing.md },
  stepNumber: { width: 28, height: 28, borderRadius: tokens.radius.full, backgroundColor: tokens.colors.brand.base + '20', alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing.sm },
  stepNumberText: { fontSize: 13, fontWeight: '700', color: tokens.colors.brand.base },
  stepText: { flex: 1, fontSize: 14, color: tokens.colors.dark_navy.text_secondary, lineHeight: 20 },
  startBtn: { backgroundColor: tokens.colors.brand.base, marginHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.md, borderRadius: tokens.radius.lg, alignItems: 'center', marginTop: tokens.spacing.sm },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

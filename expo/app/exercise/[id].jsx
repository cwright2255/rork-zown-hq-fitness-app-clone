// app/exercise/[id].jsx
//
// Real exercise detail screen. Previously "Browse Exercises" cards on
// app/workouts.jsx all pushed to /workout/create regardless of which
// exercise was tapped, since no detail view existed to send them to.
// fetchExerciseById (services/exerciseDbService.js) was already written
// and correct, it just had no caller anywhere in the app.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchExerciseById } from '@/services/exerciseDbService';

function Pill({ label }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const exerciseId = typeof params.id === 'string' ? params.id : '';

  const [exercise, setExercise] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchExerciseById(exerciseId);
        if (!cancelled) setExercise(data);
      } catch (e) {
        if (!cancelled) setError("Couldn't load this exercise.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace('/workouts'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color="#000" />
        </View>
      ) : error || !exercise ? (
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={32} color="#999" />
          <Text style={styles.errorText}>{error || 'Exercise not found.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {exercise.gifUrl ? (
            <Image source={{ uri: exercise.gifUrl }} style={styles.gif} resizeMode="cover" />
          ) : (
            <View style={styles.gifPlaceholder}>
              <Ionicons name="barbell-outline" size={48} color="#999" />
            </View>
          )}

          <Text style={styles.name}>{exercise.name || 'Exercise'}</Text>

          <View style={styles.pillRow}>
            {(exercise.bodyParts || []).map((bp) => (
              <Pill key={`bp-${bp}`} label={bp} />
            ))}
            {(exercise.equipments || []).map((eq) => (
              <Pill key={`eq-${eq}`} label={eq} />
            ))}
          </View>

          {exercise.targetMuscles?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Target Muscles</Text>
              <Text style={styles.sectionBody}>{exercise.targetMuscles.join(', ')}</Text>
            </View>
          )}

          {exercise.secondaryMuscles?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Secondary Muscles</Text>
              <Text style={styles.sectionBody}>{exercise.secondaryMuscles.join(', ')}</Text>
            </View>
          )}

          {exercise.instructions?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {exercise.instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{i + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { marginTop: 12, fontSize: 15, color: '#666', textAlign: 'center' },
  scrollContent: { paddingBottom: 60 },
  gif: { width: '100%', height: 280, backgroundColor: '#F0F0F0' },
  gifPlaceholder: {
    width: '100%', height: 280, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },
  name: { fontSize: 24, fontWeight: '800', color: '#000', paddingHorizontal: 20, marginTop: 20, textTransform: 'capitalize' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 12 },
  pill: { backgroundColor: '#F0F0F0', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { fontSize: 12, fontWeight: '600', color: '#666', textTransform: 'capitalize' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  sectionBody: { fontSize: 14, color: '#666', lineHeight: 20, textTransform: 'capitalize' },
  stepRow: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  stepNumber: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#000', color: '#FFF',
    fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 22, overflow: 'hidden',
  },
  stepText: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },
});

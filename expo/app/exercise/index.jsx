// app/exercise/index.jsx
//
// "View All" destination for app/workouts.jsx's Browse Exercises
// section, previously also hardcoded to /workout/create. Reuses
// useExerciseStore's existing cursor/hasNextPage pagination (already
// built for the home carousel's slice(0, 10), just never used to
// actually show more than 10) rather than duplicating a second fetch
// path alongside it.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useExerciseStore } from '@/store/exerciseStore';

function ExerciseRow({ item, onPress }) {
  const subtitle = [item.bodyParts?.[0], item.equipments?.[0]].filter(Boolean).join(' · ');
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowThumb}>
        <Ionicons name="barbell-outline" size={22} color="#999" />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CCC" />
    </Pressable>
  );
}

export default function ExerciseListScreen() {
  const router = useRouter();
  const { exercises, isLoading, hasNextPage, loadExercises } = useExerciseStore();

  useEffect(() => {
    if (exercises.length === 0) loadExercises(true);
  }, []);

  const handleEndReached = () => {
    if (!isLoading && hasNextPage) loadExercises(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/workouts'))} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Exercises</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => String(item.exerciseId)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ExerciseRow item={item} onPress={() => router.push(`/exercise/${item.exerciseId}`)} />
        )}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerFill}>
              <ActivityIndicator color="#000" />
            </View>
          ) : (
            <View style={styles.centerFill}>
              <Text style={styles.emptyText}>No exercises found.</Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoading && exercises.length > 0 ? (
            <ActivityIndicator color="#000" style={{ marginVertical: 20 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  rowThumb: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#000', textTransform: 'capitalize' },
  rowSubtitle: { fontSize: 12, color: '#999', marginTop: 2, textTransform: 'capitalize' },
  centerFill: { paddingTop: 80, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#999' },
});

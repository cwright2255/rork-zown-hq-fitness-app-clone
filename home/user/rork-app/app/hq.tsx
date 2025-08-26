import React, { useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkoutStore } from '../store/workoutStore';
import { Workout } from '../types';

const { width } = Dimensions.get('window');

const HQ = () => {
  const { workouts } = useWorkoutStore();
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleWorkoutScroll = useCallback((event: any) => {
    // Extract values immediately to avoid synthetic event pooling issues
    const contentOffset = event.nativeEvent?.contentOffset?.x || 0;
    
    // Use setTimeout to avoid blocking the main thread
    setTimeout(() => {
      const index = Math.round(contentOffset / (width * 0.9));
      setCurrentWorkoutIndex(index);
    }, 0);
  }, []);

  const renderItem = ({ item }: { item: Workout }) => (
    <View style={styles.workoutCard}>
      <Text style={styles.workoutTitle}>{item.name}</Text>
      <Text style={styles.workoutDescription}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Workout HQ</Text>
      <FlatList
        ref={flatListRef}
        data={workouts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleWorkoutScroll}
        style={styles.workoutList}
        contentContainerStyle={styles.workoutListContent}
      />
      <View style={styles.paginationDots}>
        {workouts.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentWorkoutIndex && styles.activeDot,
            ]}
          />
        ))}
      </View>
      <TouchableOpacity style={styles.startButton}>
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  workoutList: {
    flex: 1,
  },
  workoutListContent: {
    paddingHorizontal: 20,
  },
  workoutCard: {
    width: width * 0.9,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  workoutDescription: {
    fontSize: 14,
    color: '#666',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#007AFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 30,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HQ;

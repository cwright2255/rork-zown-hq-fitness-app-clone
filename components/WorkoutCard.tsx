import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Clock, Dumbbell, BarChart3, Trophy } from 'lucide-react-native';
import { Workout } from '@/types';
import Colors from '@/constants/colors';
import Badge from './Badge';
import { getOptimizedImageUrl } from '@/constants/performance';
import { usePerformanceMonitor } from '@/utils/storeOptimizations';

interface WorkoutCardProps {
  workout: Workout;
  onPress: () => void;
}

const WorkoutCard = React.memo(({ workout, onPress }: WorkoutCardProps) => {
  // Performance monitoring in development
  usePerformanceMonitor('WorkoutCard', __DEV__);
  
  // Memoize expensive calculations
  const difficultyColor = useMemo(() => {
    switch (workout.difficulty) {
      case 'beginner':
        return Colors.success;
      case 'intermediate':
        return Colors.warning;
      case 'advanced':
        return Colors.error;
      default:
        return Colors.text.secondary;
    }
  }, [workout.difficulty]);

  const formattedDuration = useMemo(() => {
    if (workout.duration < 60) {
      return `${workout.duration} min`;
    }
    const hours = Math.floor(workout.duration / 60);
    const remainingMinutes = workout.duration % 60;
    return remainingMinutes > 0 
      ? `${hours} hr ${remainingMinutes} min` 
      : `${hours} hr`;
  }, [workout.duration]);

  // Optimize image URL with fallback
  const optimizedImageUrl = useMemo(() => {
    if (!workout.imageUrl) {
      return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=240&fit=crop';
    }
    return getOptimizedImageUrl(workout.imageUrl, 400, 240);
  }, [workout.imageUrl]);

  // Memoize exercise count
  const exerciseCount = useMemo(() => 
    workout.exercises?.length || 0,
    [workout.exercises]
  );

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image 
        source={{ uri: optimizedImageUrl }} 
        style={styles.image}
        resizeMode="cover"
        loadingIndicatorSource={{ uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }}
      />
      
      <View style={styles.overlay} />
      
      {workout.xpReward && workout.xpReward > 50 && (
        <View style={[styles.xpBadge, { backgroundColor: Colors.warning }]}>
          <Text style={styles.xpBadgeText}>High XP</Text>
        </View>
      )}
      
      <View style={styles.content}>
        <Text style={styles.title}>{workout.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {workout.description}
        </Text>
        
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Clock size={14} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{formattedDuration}</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Dumbbell size={14} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{exerciseCount} exercises</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Trophy size={14} color={Colors.text.inverse} />
            <Text style={styles.metaText}>+{workout.xpReward} XP</Text>
          </View>
        </View>
        
        <View style={styles.difficultyContainer}>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
            <Text style={styles.difficultyText}>{workout.difficulty.toUpperCase()}</Text>
          </View>
          
          <Text style={styles.categoryText}>{workout.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: Colors.radius.large,
    overflow: 'hidden',
    marginBottom: Colors.spacing.lg,
    position: 'relative',
    ...Colors.shadow.medium,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  xpBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  xpBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Colors.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.inverse,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.text.inverse,
    opacity: 0.9,
    marginBottom: 12,
    lineHeight: 18,
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.inverse,
    fontWeight: '500',
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.text.inverse,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});

export default WorkoutCard;
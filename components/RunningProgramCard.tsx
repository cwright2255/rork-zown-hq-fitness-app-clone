import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Calendar, Clock, Target, Trophy } from 'lucide-react-native';
import { RunningProgram } from '@/types';
import Colors from '@/constants/colors';
import Badge from './Badge';

interface RunningProgramCardProps {
  program: RunningProgram;
  onPress: () => void;
  userProgress?: {
    currentWeek: number;
    completedSessions: number;
    totalSessions: number;
  };
}

const RunningProgramCard = ({ program, onPress, userProgress }: RunningProgramCardProps) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return Colors.success;
      case 'medium':
        return Colors.warning;
      case 'hard':
        return Colors.error;
      default:
        return Colors.text.secondary;
    }
  };

  const progressPercentage = userProgress 
    ? (userProgress.completedSessions / userProgress.totalSessions) * 100 
    : 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image 
        source={{ uri: program.imageUrl }} 
        style={styles.image}
        resizeMode="cover"
      />
      
      <View style={styles.overlay} />
      
      {program.isPopular && (
        <Badge 
          label="Popular" 
          variant="success" 
          style={styles.popularBadge}
        />
      )}
      
      <View style={styles.content}>
        <Text style={styles.title}>{program.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {program.description}
        </Text>
        
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Calendar size={14} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{program.duration} weeks</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Clock size={14} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{program.estimatedTimePerSession} min</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Target size={14} color={Colors.text.inverse} />
            <Text style={styles.metaText}>{program.totalSessions} sessions</Text>
          </View>
        </View>
        
        <View style={styles.difficultyContainer}>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(program.difficulty) }]}>
            <Text style={styles.difficultyText}>{program.difficulty.toUpperCase()}</Text>
          </View>
          
          <Text style={styles.typeText}>{program.type}</Text>
        </View>
        
        {userProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progressPercentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              Week {userProgress.currentWeek} • {Math.round(progressPercentage)}% complete
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

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
  popularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
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
    marginBottom: 8,
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
  typeText: {
    fontSize: 12,
    color: Colors.text.inverse,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.running.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: Colors.text.inverse,
    fontWeight: '500',
  },
});

export default RunningProgramCard;
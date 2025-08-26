import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import ProgressBar from './ProgressBar';

interface LevelProgressProps {
  level: number;
  xp: number;
  xpForNextLevel?: number;
  nextLevelXp?: number;
  showDetails?: boolean;
  style?: object;
}

const LevelProgress = ({ 
  level, 
  xp, 
  xpForNextLevel, 
  nextLevelXp,
  showDetails = false,
  style
}: LevelProgressProps) => {
  // Calculate progress percentage
  const calculateProgress = () => {
    if (nextLevelXp && xp) {
      const prevLevelXp = nextLevelXp - (xpForNextLevel || 0);
      const levelProgress = (xp - prevLevelXp) / (xpForNextLevel || 1);
      return Math.min(Math.max(levelProgress, 0), 1);
    }
    
    // Fallback calculation
    const baseXp = level * 100;
    const nextLevelRequirement = (level + 1) * 100;
    const progress = (xp - baseXp) / (nextLevelRequirement - baseXp);
    return Math.min(Math.max(progress, 0), 1);
  };
  
  const progress = calculateProgress();
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.levelContainer}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{level}</Text>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.levelInfo}>
            <Text style={styles.levelLabel}>Level {level}</Text>
            {showDetails && xpForNextLevel && (
              <Text style={styles.xpText}>{xpForNextLevel.toLocaleString()} XP to Level {level + 1}</Text>
            )}
          </View>
          <ProgressBar 
            progress={progress} 
            height={8}
            progressColor={Colors.primary}
            style={styles.progressBar}
          />
          {!showDetails && (
            <View style={styles.nextLevelContainer}>
              <Text style={styles.nextLevelText}>Level {level + 1}</Text>
            </View>
          )}
        </View>
      </View>
      
      {showDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsText}>
            {Math.round(progress * 100)}% Complete
          </Text>
          {nextLevelXp && (
            <Text style={styles.detailsText}>
              {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.lg,
    marginBottom: Colors.spacing.lg,
    height: 'auto', // Changed from fixed height to auto for fluid fitment
    maxHeight: 90, // Added max height constraint to make it smaller
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    width: 36, // Reduced from 40
    height: 36, // Reduced from 40
    borderRadius: 18, // Adjusted for new size
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Colors.spacing.md,
  },
  levelText: {
    fontSize: 16, // Reduced from 18
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  progressContainer: {
    flex: 1,
  },
  levelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Colors.spacing.xs + 2, // Reduced from 8
  },
  levelLabel: {
    fontSize: 15, // Reduced from 16
    fontWeight: '600',
    color: Colors.text.primary,
  },
  xpText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  progressBar: {
    borderRadius: Colors.radius.xs,
    backgroundColor: `${Colors.primary}20`,
  },
  nextLevelContainer: {
    alignSelf: 'flex-end',
    marginTop: 2, // Reduced from 4
  },
  nextLevelText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Colors.spacing.xs + 2, // Reduced from 8
  },
  detailsText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
});

export default LevelProgress;
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Award } from 'lucide-react-native';
import { Achievement } from '@/types';
import Colors from '@/constants/colors';

interface AchievementCardProps {
  achievement: Achievement;
}

const AchievementCard = ({ achievement }: AchievementCardProps) => {
  const progress = achievement.progress ?? 0;
  const target = achievement.condition?.target ?? 1;
  const progressPercent = Math.min(progress / target, 1);
  
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Award size={32} color={achievement.isUnlocked ? Colors.primary : Colors.inactive} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{achievement.name}</Text>
        <Text style={styles.description}>{achievement.description}</Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: `${progressPercent * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress} / {target}
          </Text>
        </View>
        
        <View style={styles.rewardContainer}>
          <Text style={styles.rewardText}>+{achievement.xpReward || 0} XP</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.medium,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: Colors.spacing.md,
    ...Colors.shadow.medium,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: Colors.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Colors.spacing.sm,
  },
  progressContainer: {
    marginBottom: Colors.spacing.sm,
  },
  progressBackground: {
    height: 4,
    backgroundColor: Colors.inactive,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Colors.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: Colors.text.secondary,
  },
  rewardContainer: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    paddingHorizontal: Colors.spacing.sm,
    paddingVertical: 2,
    borderRadius: Colors.radius.medium,
  },
  rewardText: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
});

export default AchievementCard;

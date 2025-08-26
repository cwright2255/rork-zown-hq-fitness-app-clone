import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Achievement } from '@/types';
import Colors from '@/constants/colors';

interface AchievementCardProps {
  achievement: Achievement;
}

const AchievementCard = ({ achievement }: AchievementCardProps) => {
  const progress = Math.min(achievement.progress / achievement.requirement, 1);
  
  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: achievement.imageUrl }} 
        style={styles.image}
        resizeMode="cover"
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>{achievement.name}</Text>
        <Text style={styles.description}>{achievement.description}</Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {achievement.progress} / {achievement.requirement}
          </Text>
        </View>
        
        <View style={styles.rewardContainer}>
          <Text style={styles.rewardText}>+{achievement.reward?.value || 0} XP</Text>
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
    shadowColor: Colors.shadow.color,
    shadowOffset: Colors.shadow.offset,
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: Colors.shadow.radius,
    elevation: Colors.shadow.elevation,
  },
  image: {
    width: 80,
    height: 80,
  },
  content: {
    flex: 1,
    padding: Colors.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBackground: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  rewardContainer: {
    alignSelf: 'flex-start',
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  image: {
    width: 80,
    height: 80,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Colors.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
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
    fontWeight: '500',
    color: Colors.primary,
  },
});

export default AchievementCard;
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Award } from 'lucide-react-native';
import Colors from '@/constants/colors';
import AchievementCard from '@/components/AchievementCard';
import { useAchievementStore } from '@/store/achievementStore';
import { Achievement } from '@/types';

export default function AchievementsScreen() {
  const { 
    achievements, 
    getUnlockedAchievements, 
    getInProgressAchievements, 
    initializeAchievements 
  } = useAchievementStore() as {
    achievements: Achievement[];
    getUnlockedAchievements: () => Achievement[];
    getInProgressAchievements: () => Achievement[];
    initializeAchievements: () => void;
  };
  
  useEffect(() => {
    // Make sure achievements are initialized
    if (achievements.length === 0) {
      initializeAchievements();
    }
  }, [achievements, initializeAchievements]);
  
  const unlockedAchievements = getUnlockedAchievements();
  const inProgressAchievements = getInProgressAchievements();
  const lockedAchievements = achievements.filter(
    a => !a.isUnlocked && a.progress === 0
  );
  
  const renderAchievement = ({ item }: { item: Achievement }) => (
    <AchievementCard achievement={item} />
  );
  
  return (
    <>
      <Stack.Screen options={{ title: 'Achievements' }} />
      
      <View style={styles.container}>
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{unlockedAchievements.length}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{inProgressAchievements.length}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{achievements.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        
        {/* Achievements List */}
        <FlatList
          data={[
            ...unlockedAchievements,
            ...inProgressAchievements,
            ...lockedAchievements
          ]}
          renderItem={renderAchievement}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>All Achievements</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Award size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No Achievements</Text>
              <Text style={styles.emptyText}>
                Complete workouts and track your nutrition to earn achievements.
              </Text>
            </View>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
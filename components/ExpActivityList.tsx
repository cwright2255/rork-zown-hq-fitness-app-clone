import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Award, Dumbbell, Utensils, Trophy, MapPin, Droplet } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ExpActivity } from '@/types';
import { MemoryOptimizer } from '@/utils/memoryOptimizer';
import { useRenderOptimization } from '@/utils/renderOptimizer';

interface ExpActivityListProps {
  activities: ExpActivity[];
  maxHeight?: number;
  limit?: number;
}

const ExpActivityItem = memo(({ activity }: { activity: ExpActivity }) => {
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };
  
  // Get icon based on activity type
  const getIcon = () => {
    switch (activity.type) {
      case 'mainMission':
        return <Trophy size={20} color={Colors.warning} />;
      case 'sideMission':
        return <MapPin size={20} color={Colors.primary} />;
      case 'meal':
        if (activity.subtype === 'hydration') {
          return <Droplet size={20} color="#3498db" />;
        }
        return <Utensils size={20} color={Colors.success} />;
      case 'workout':
        return <Dumbbell size={20} color={Colors.error} />;
      case 'event':
        return <Award size={20} color={Colors.primary} />;
      default:
        return <Award size={20} color={Colors.primary} />;
    }
  };
  
  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        {getIcon()}
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityDescription}>{activity.description}</Text>
        <Text style={styles.activityDate}>{formatDate(activity.date)}</Text>
      </View>
      <View style={styles.activityExp}>
        <Text style={styles.activityExpValue}>+{activity.baseExp}</Text>
        <Text style={styles.activityExpLabel}>XP</Text>
      </View>
    </View>
  );
});

const ExpActivityList: React.FC<ExpActivityListProps> = ({ activities, maxHeight, limit }) => {
  const { measureRender } = useRenderOptimization('ExpActivityList');
  
  // Optimize data for rendering
  const displayActivities = useMemo(() => {
    measureRender.start();
    if (!activities || activities.length === 0) {
      measureRender.end();
      return [];
    }
    
    const optimized = MemoryOptimizer.optimizeForRendering(
      activities,
      limit || 100
    );
    measureRender.end();
    return optimized;
  }, [activities, limit, measureRender]);
  
  // Memoize render item callback
  const renderItem = useCallback(({ item }: { item: ExpActivity }) => (
    <ExpActivityItem activity={item} />
  ), []);
  
  // Memoize key extractor
  const keyExtractor = useCallback((item: ExpActivity) => item.id, []);
  
  if (displayActivities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent activities</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, maxHeight && { maxHeight }]}>
      <FlatList
        data={displayActivities}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        scrollEnabled={maxHeight !== undefined}
        nestedScrollEnabled={true}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={3}
        updateCellsBatchingPeriod={100}
        getItemLayout={(data, index) => ({
          length: 64,
          offset: 64 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  activityExp: {
    alignItems: 'center',
  },
  activityExpValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
  activityExpLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
});

export default memo(ExpActivityList);
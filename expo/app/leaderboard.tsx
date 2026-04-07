import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Trophy, Users, Globe, MapPin, Zap, Target } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import BottomNavigation from '@/components/BottomNavigation';

// Mock data for leaderboard with running stats
const leaderboardData = [
  {
    id: '1',
    name: 'Sarah Johnson',
    rank: 1,
    points: 1250,
    workouts: 28,
    profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
    location: 'New York, USA',
    isFriend: true,
    runningStats: {
      totalDistance: 127.5,
      totalRuns: 24,
      averagePace: 5.2,
      bestTime5K: 1320 // 22:00 in seconds
    }
  },
  {
    id: '2',
    name: 'Michael Chen',
    rank: 2,
    points: 1180,
    workouts: 25,
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    location: 'San Francisco, USA',
    isFriend: true,
    runningStats: {
      totalDistance: 98.3,
      totalRuns: 19,
      averagePace: 5.8,
      bestTime5K: 1440 // 24:00 in seconds
    }
  },
  {
    id: '3',
    name: 'Jessica Williams',
    rank: 3,
    points: 1050,
    workouts: 22,
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500',
    location: 'Chicago, USA',
    isFriend: false,
    runningStats: {
      totalDistance: 89.7,
      totalRuns: 17,
      averagePace: 6.1,
      bestTime5K: 1500 // 25:00 in seconds
    }
  },
  {
    id: '4',
    name: 'David Rodriguez',
    rank: 4,
    points: 980,
    workouts: 20,
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
    location: 'Miami, USA',
    isFriend: true,
    runningStats: {
      totalDistance: 76.2,
      totalRuns: 15,
      averagePace: 5.9,
      bestTime5K: 1380 // 23:00 in seconds
    }
  },
  {
    id: '5',
    name: 'Emma Thompson',
    rank: 5,
    points: 920,
    workouts: 19,
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    location: 'London, UK',
    isFriend: false,
    runningStats: {
      totalDistance: 65.4,
      totalRuns: 13,
      averagePace: 6.3,
      bestTime5K: 1560 // 26:00 in seconds
    }
  },
  {
    id: '6',
    name: 'James Wilson',
    rank: 6,
    points: 880,
    workouts: 18,
    profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500',
    location: 'Sydney, Australia',
    isFriend: false,
    runningStats: {
      totalDistance: 58.9,
      totalRuns: 12,
      averagePace: 6.0,
      bestTime5K: 1470 // 24:30 in seconds
    }
  },
  {
    id: '7',
    name: 'Olivia Martinez',
    rank: 7,
    points: 820,
    workouts: 17,
    profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
    location: 'Toronto, Canada',
    isFriend: true,
    runningStats: {
      totalDistance: 52.1,
      totalRuns: 11,
      averagePace: 6.4,
      bestTime5K: 1620 // 27:00 in seconds
    }
  },
  {
    id: '8',
    name: 'Daniel Lee',
    rank: 8,
    points: 780,
    workouts: 16,
    profileImage: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=500',
    location: 'Seoul, South Korea',
    isFriend: false,
    runningStats: {
      totalDistance: 47.8,
      totalRuns: 10,
      averagePace: 6.2,
      bestTime5K: 1590 // 26:30 in seconds
    }
  },
];

type TimeFilter = 'weekly' | 'monthly' | 'all-time';
type CategoryFilter = 'points' | 'workouts' | 'distance' | 'pace' | 'runs';
type ScopeFilter = 'global' | 'local' | 'friends';

export default function LeaderboardScreen() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('weekly');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('points');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('global');
  
  const timeFilters: { label: string; value: TimeFilter }[] = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'All Time', value: 'all-time' },
  ];
  
  const categoryFilters: { label: string; value: CategoryFilter; icon: React.ReactNode }[] = [
    { 
      label: 'Points', 
      value: 'points', 
      icon: <Trophy size={16} color={categoryFilter === 'points' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
    { 
      label: 'Workouts', 
      value: 'workouts', 
      icon: <Zap size={16} color={categoryFilter === 'workouts' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
    { 
      label: 'Distance', 
      value: 'distance', 
      icon: <Target size={16} color={categoryFilter === 'distance' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
    { 
      label: 'Pace', 
      value: 'pace', 
      icon: <Zap size={16} color={categoryFilter === 'pace' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
    { 
      label: 'Runs', 
      value: 'runs', 
      icon: <Target size={16} color={categoryFilter === 'runs' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
  ];
  
  const scopeFilters: { label: string; value: ScopeFilter; icon: React.ReactNode }[] = [
    { 
      label: 'Global', 
      value: 'global', 
      icon: <Globe size={16} color={scopeFilter === 'global' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
    { 
      label: 'Local', 
      value: 'local', 
      icon: <MapPin size={16} color={scopeFilter === 'local' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
    { 
      label: 'Friends', 
      value: 'friends', 
      icon: <Users size={16} color={scopeFilter === 'friends' ? Colors.text.inverse : Colors.text.secondary} /> 
    },
  ];
  
  // Filter leaderboard data based on scope
  const filteredLeaderboardData = leaderboardData.filter(user => {
    if (scopeFilter === 'friends') {
      return user.isFriend;
    }
    // For demo purposes, we're showing all users for global and local
    // In a real app, you would filter based on location for 'local'
    return true;
  });
  
  // Sort data based on category filter
  const sortedLeaderboardData = [...filteredLeaderboardData].sort((a, b) => {
    switch (categoryFilter) {
      case 'distance':
        return (b.runningStats?.totalDistance || 0) - (a.runningStats?.totalDistance || 0);
      case 'pace':
        return (a.runningStats?.averagePace || 999) - (b.runningStats?.averagePace || 999); // Lower pace is better
      case 'runs':
        return (b.runningStats?.totalRuns || 0) - (a.runningStats?.totalRuns || 0);
      case 'workouts':
        return b.workouts - a.workouts;
      case 'points':
      default:
        return b.points - a.points;
    }
  }).map((user, index) => ({ ...user, rank: index + 1 }));
  
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const formatPace = (pace: number): string => {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };
  
  const getStatValue = (user: typeof leaderboardData[0]): string => {
    switch (categoryFilter) {
      case 'distance':
        return `${user.runningStats?.totalDistance?.toFixed(1) || '0.0'} km`;
      case 'pace':
        return formatPace(user.runningStats?.averagePace || 0);
      case 'runs':
        return `${user.runningStats?.totalRuns || 0} runs`;
      case 'workouts':
        return `${user.workouts} workouts`;
      case 'points':
      default:
        return `${user.points} pts`;
    }
  };
  
  const renderLeaderboardItem = ({ item, index }: { item: typeof sortedLeaderboardData[0]; index: number }) => {
    const isTopThree = item.rank <= 3;
    
    return (
      <Card 
        variant={isTopThree ? 'elevated' : 'outlined'} 
        style={[
          styles.leaderboardItem,
          isTopThree && styles.topThreeItem,
          item.rank === 1 && styles.firstPlaceItem,
        ]}
      >
        <View style={styles.rankContainer}>
          <View 
            style={[
              styles.rankBadge,
              item.rank === 1 && styles.firstPlace,
              item.rank === 2 && styles.secondPlace,
              item.rank === 3 && styles.thirdPlace,
            ]}
          >
            <Text style={styles.rankText}>{item.rank}</Text>
          </View>
        </View>
        
        <Image source={{ uri: item.profileImage }} style={styles.profileImage} />
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <View style={styles.statsContainer}>
            <Text style={styles.statText}>
              {getStatValue(item)}
            </Text>
            {item.isFriend && (
              <Badge 
                variant="success" 
                style={styles.friendBadge} 
              >
                Friend
              </Badge>
            )}
          </View>
          <Text style={styles.locationText}>{item.location}</Text>
          
          {/* Running-specific stats */}
          {(categoryFilter === 'distance' || categoryFilter === 'pace' || categoryFilter === 'runs') && item.runningStats && (
            <View style={styles.runningStatsContainer}>
              {categoryFilter === 'distance' && (
                <Text style={styles.runningStatText}>
                  {item.runningStats.totalRuns} runs • {formatPace(item.runningStats.averagePace)} avg pace
                </Text>
              )}
              {categoryFilter === 'pace' && (
                <Text style={styles.runningStatText}>
                  {item.runningStats.totalDistance.toFixed(1)}km • {item.runningStats.totalRuns} runs
                </Text>
              )}
              {categoryFilter === 'runs' && item.runningStats.bestTime5K && (
                <Text style={styles.runningStatText}>
                  Best 5K: {formatTime(item.runningStats.bestTime5K)}
                </Text>
              )}
            </View>
          )}
        </View>
        
        {item.rank === 1 && (
          <Trophy size={24} color={Colors.warning} style={styles.trophyIcon} />
        )}
      </Card>
    );
  };
  
  return (
    <View style={styles.mainContainer}>
      <Stack.Screen 
        options={{ 
          title: 'Leaderboard',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }} 
      />
      
      <View style={styles.container}>
        <View style={styles.filtersContainer}>
          {/* Scope Filters */}
          <View style={styles.scopeFiltersContainer}>
            {scopeFilters.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.scopeFilterButton,
                  scopeFilter === filter.value && styles.activeScopeFilterButton,
                ]}
                onPress={() => setScopeFilter(filter.value)}
              >
                {filter.icon}
                <Text
                  style={[
                    styles.scopeFilterText,
                    scopeFilter === filter.value && styles.activeScopeFilterText,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Time Filters */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Time Period:</Text>
            <View style={styles.filterOptions}>
              {timeFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    timeFilter === filter.value && styles.activeFilterButton,
                  ]}
                  onPress={() => setTimeFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      timeFilter === filter.value && styles.activeFilterText,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Category Filters */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category:</Text>
            <View style={styles.categoryFilterOptions}>
              {categoryFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.categoryFilterButton,
                    categoryFilter === filter.value && styles.activeCategoryFilterButton,
                  ]}
                  onPress={() => setCategoryFilter(filter.value)}
                >
                  {filter.icon}
                  <Text
                    style={[
                      styles.categoryFilterButtonText,
                      categoryFilter === filter.value && styles.activeCategoryFilterText,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        
        <FlatList
          data={sortedLeaderboardData}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.leaderboardList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {scopeFilter === 'friends' 
                  ? "You don't have any friends on the leaderboard yet." 
                  : "No users found for the selected filters."}
              </Text>
            </View>
          }
        />
      </View>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scopeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: Colors.background,
    borderRadius: 28,
    padding: 4,
  },
  scopeFilterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
  },
  activeScopeFilterButton: {
    backgroundColor: Colors.primary,
  },
  scopeFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeScopeFilterText: {
    color: Colors.text.inverse,
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeFilterText: {
    color: Colors.text.inverse,
  },
  categoryFilterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    gap: 6,
  },
  activeCategoryFilterButton: {
    backgroundColor: Colors.primary,
  },
  categoryFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeCategoryFilterText: {
    color: Colors.text.inverse,
  },
  leaderboardList: {
    padding: 16,
    paddingBottom: 80, // Extra padding for bottom navigation
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
  },
  topThreeItem: {
    borderWidth: 0,
  },
  firstPlaceItem: {
    backgroundColor: `${Colors.warning}10`,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.inactive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstPlace: {
    backgroundColor: Colors.warning,
  },
  secondPlace: {
    backgroundColor: '#A0A9B8', // Silver
  },
  thirdPlace: {
    backgroundColor: '#CD7F32', // Bronze
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginRight: 8,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  runningStatsContainer: {
    marginTop: 4,
  },
  runningStatText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  friendBadge: {
    height: 20,
    paddingHorizontal: 6,
  },
  trophyIcon: {
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
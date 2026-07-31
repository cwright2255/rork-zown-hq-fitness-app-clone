import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Trophy, Award, Medal } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useUserStore } from '@/store/userStore';

export default function LeaderboardScreen() {
  const [timeframe, setTimeframe] = useState('weekly');
  const {
    leaderboard,
    loading,
    error,
    fetchLeaderboard,
    subscribeToLeaderboard,
  } = useLeaderboardStore();
  const { user } = useUserStore();

  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard(timeframe);
    return () => unsubscribe();
  }, [timeframe]);

  const renderLeaderboardItem = ({ item, index }) => {
    const rank = index + 1;
    const isCurrentUser = user && item.uid === user.uid;

    function getRankIcon() {
      if (rank === 1) return <Trophy size={24} color="#FFC107" />;
      if (rank === 2) return <Award size={24} color="#E0E0E0" />;
      if (rank === 3) return <Medal size={24} color="#CD471E" />;
      return <Text style={styles.rankText}>{rank}</Text>;
    }

    return (
      <View style={[styles.itemCard, isCurrentUser && styles.currentUserCard]}>
        <View style={styles.rankContainer}>
          {getRankIcon()}
        </View>
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarText}>
            {item.displayName ? item.displayName[0].toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>
            {item.displayName || 'Anonymous'}
            {isCurrentUser ? ' (You)' : ''}
          </Text>
          <Text style={styles.scoreText}>{item.score || 0} pts</Text>
        </View>
      </View>
    );
  };

  const timeframes = ['daily', 'weekly', 'monthly', 'all-time'];

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Leaderboard" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
        <BottomNavigation />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Leaderboard" />
      <View style={styles.timeframeContainer}>
        {timeframes.map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeframeButton, timeframe === tf && styles.activeTimeframe]}
            onPress={() => setTimeframe(tf)}
          >
            <Text style={[styles.timeframeText, timeframe === tf && styles.activeTimeframeText]}>
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchLeaderboard(timeframe)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No leaderboard data yet. Start working out!</Text>
          }
        />
      )}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timeframeContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  timeframeButton: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.colors.surface, alignItems: 'center' },
  activeTimeframe: { backgroundColor: tokens.colors.primary || '#000' },
  timeframeText: { fontSize: 12, color: tokens.colors.textSecondary, fontWeight: '500' },
  activeTimeframeText: { color: '#FFFFFF' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.surface, borderRadius: 12, padding: 16, marginBottom: 8 },
  currentUserCard: { borderWidth: 1, borderColor: tokens.colors.primary || '#000' },
  rankContainer: { width: 40, alignItems: 'center' },
  rankText: { fontSize: 16, fontWeight: '700', color: tokens.colors.text },
  avatarBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.primary || '#000', justifyContent: 'center', alignItems: 'center', marginHorizontal: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  infoContainer: { flex: 1 },
  nameText: { fontSize: 14, fontWeight: '600', color: tokens.colors.text },
  scoreText: { fontSize: 12, color: tokens.colors.textSecondary, marginTop: 2 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: tokens.colors.error || 'red', marginBottom: 12 },
  retryText: { color: tokens.colors.primary || '#000', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: tokens.colors.textSecondary, marginTop: 40, fontSize: 14 },
});

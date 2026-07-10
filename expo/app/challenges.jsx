import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, SafeAreaView, Text } from 'react-native';
import EmptyState from '../src/components/EmptyState';
import LoadingSkeleton from '../src/components/LoadingSkeleton';

export default function ChallengesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [challenges, setChallenges] = useState([]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      >
        <Text style={styles.header}>Challenges</Text>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingSkeleton width="100%" height={100} borderRadius={8} style={{ marginBottom: 12 }} />
            <LoadingSkeleton width="100%" height={100} borderRadius={8} style={{ marginBottom: 12 }} />
            <LoadingSkeleton width="100%" height={100} borderRadius={8} />
          </View>
        ) : challenges.length === 0 ? (
          <EmptyState
            icon="Trophy"
            title="No active challenges"
            subtitle="Join a challenge to compete with others"
            buttonText="Browse Challenges"
            onPress={() => {}}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  loadingContainer: {
    marginTop: 10,
  }
});

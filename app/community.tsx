import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Search, Users, MessageCircle, Trophy, Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCommunityStore } from '@/store/communityStore';

const { width } = Dimensions.get('window');

export default function CommunityScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'feed' | 'groups' | 'challenges'>('feed');
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  
  const { posts, groups, challenges } = useCommunityStore() as {
    posts: { id: string; user: { id: string; name: string; avatar: string }; content: string; image?: string; likes: number; comments: number; timeAgo: string; type: string }[];
    groups: { id: string; name: string; members: number; image: string; description: string }[];
    challenges: { id: string; title: string; participants: number; description: string; timeLeft: string; image: string; progress: number }[];
  };

  // Handle group carousel scroll
  const handleGroupScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.8));
    setCurrentGroupIndex(index);
  }, []);

  // Handle challenge carousel scroll
  const handleChallengeScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.8));
    setCurrentChallengeIndex(index);
  }, []);

  // Navigate group carousel
  const navigateGroup = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentGroupIndex((prev) => prev === 0 ? groups.length - 1 : prev - 1);
    } else {
      setCurrentGroupIndex((prev) => (prev + 1) % groups.length);
    }
  }, [groups.length]);

  // Navigate challenge carousel
  const navigateChallenge = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentChallengeIndex((prev) => prev === 0 ? challenges.length - 1 : prev - 1);
    } else {
      setCurrentChallengeIndex((prev) => (prev + 1) % challenges.length);
    }
  }, [challenges.length]);

  const renderFeed = () => (
    <ScrollView style={styles.content}>
      {posts.map((post) => (
        <View key={post.id} style={styles.postCard}>
          <View style={styles.postHeader}>
            <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
            <View style={styles.postUserInfo}>
              <Text style={styles.postUserName}>{post.user.name}</Text>
              <Text style={styles.postTime}>{post.timeAgo}</Text>
            </View>
          </View>
          
          <Text style={styles.postContent}>{post.content}</Text>
          
          {post.image && (
            <Image source={{ uri: post.image }} style={styles.postImage} />
          )}
          
          <View style={styles.postActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>👍 {post.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MessageCircle size={16} color={Colors.text.secondary} />
              <Text style={styles.actionText}>{post.comments}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderGroups = () => (
    <View style={styles.content}>
      <View style={styles.carouselHeader}>
        <Text style={styles.carouselTitle}>Fitness Groups</Text>
        <View style={styles.carouselControls}>
          <TouchableOpacity 
            style={styles.carouselButton}
            onPress={() => navigateGroup('prev')}
          >
            <ChevronLeft size={16} color={Colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.carouselButton}
            onPress={() => navigateGroup('next')}
          >
            <ChevronRight size={16} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.carouselContainer}>
        <ScrollView 
          horizontal 
          pagingEnabled
          snapToInterval={width * 0.8 + 16}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupsContainer}
          onMomentumScrollEnd={handleGroupScroll}
        >
          {groups.map((group) => (
            <TouchableOpacity key={group.id} style={styles.groupCard}>
              <Image source={{ uri: group.image }} style={styles.groupImage} />
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupDescription}>{group.description}</Text>
                <View style={styles.groupStats}>
                  <Users size={14} color={Colors.text.secondary} />
                  <Text style={styles.groupMembers}>{group.members} members</Text>
                </View>
                <TouchableOpacity style={styles.joinGroupButton}>
                  <Text style={styles.joinGroupButtonText}>Join Group</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Carousel Indicators */}
        <View style={styles.indicatorsContainer}>
          {groups.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator, 
                currentGroupIndex === index && styles.activeIndicator
              ]}
              onPress={() => setCurrentGroupIndex(index)}
            />
          ))}
        </View>
      </View>
    </View>
  );

  const renderChallenges = () => (
    <View style={styles.content}>
      <View style={styles.carouselHeader}>
        <Text style={styles.carouselTitle}>Active Challenges</Text>
        <View style={styles.carouselControls}>
          <TouchableOpacity 
            style={styles.carouselButton}
            onPress={() => navigateChallenge('prev')}
          >
            <ChevronLeft size={16} color={Colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.carouselButton}
            onPress={() => navigateChallenge('next')}
          >
            <ChevronRight size={16} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.carouselContainer}>
        <ScrollView 
          horizontal 
          pagingEnabled
          snapToInterval={width * 0.8 + 16}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.challengesContainer}
          onMomentumScrollEnd={handleChallengeScroll}
        >
          {challenges.map((challenge) => (
            <View key={challenge.id} style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <Trophy size={20} color={Colors.primary} />
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
              </View>
              
              <Text style={styles.challengeDescription}>{challenge.description}</Text>
              
              <View style={styles.challengeStats}>
                <Text style={styles.challengeParticipants}>
                  {challenge.participants} participants
                </Text>
                <Text style={styles.challengeTimeLeft}>
                  {challenge.timeLeft} left
                </Text>
              </View>
              
              <TouchableOpacity style={styles.joinButton}>
                <Text style={styles.joinButtonText}>Join Challenge</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Carousel Indicators */}
        <View style={styles.indicatorsContainer}>
          {challenges.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator, 
                currentChallengeIndex === index && styles.activeIndicator
              ]}
              onPress={() => setCurrentChallengeIndex(index)}
            />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Community', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <TouchableOpacity style={styles.createButton}>
          <Plus size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search community..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.tabContainer}>
        {(['feed', 'groups', 'challenges'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'feed' && renderFeed()}
      {activeTab === 'groups' && renderGroups()}
      {activeTab === 'challenges' && renderChallenges()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  createButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  carouselHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  carouselControls: {
    flexDirection: 'row',
    gap: 8,
  },
  carouselButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  carouselContainer: {
    marginBottom: 24,
  },
  groupsContainer: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  challengesContainer: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inactive,
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: Colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  postCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  postTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  postContent: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  groupCard: {
    width: width * 0.8,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
  },
  groupImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  groupMembers: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  joinGroupButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  joinGroupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  challengeCard: {
    width: width * 0.8,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  challengeDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  challengeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  challengeParticipants: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  challengeTimeLeft: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});
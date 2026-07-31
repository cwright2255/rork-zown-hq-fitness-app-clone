import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Share, FlatList, ActivityIndicator } from 'react-native';
import { Heart, MessageCircle, X, Send, Share2 } from 'lucide-react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';
import { useCommunityStore } from '@/store/communityStore';
import { useUserStore } from '@/store/userStore';
import { getConversationId } from '@/store/messagingStore';

// No real challenge-tracking backend exists yet (participant tracking,
// join state, progress toward a goal) - that's a separate, larger feature
// than a post feed. Left as a clearly-marked placeholder rather than
// building a shallow version of it in the same pass as the real feed.
const CHALLENGES = [
  { id: 'c1', name: '30-Day Cardio', participants: 412, daysLeft: 12 },
  { id: 'c2', name: 'Strength PR Month', participants: 206, daysLeft: 21 },
  { id: 'c3', name: 'Summer Shred', participants: 894, daysLeft: 34 },
];

const timeAgo = (date) => {
  const mins = Math.floor((Date.now() - date) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

export default function CommunityScreen() {
  const [tab, setTab] = useState('feed');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedByMe, setLikedByMe] = useState({});

  const { posts, isLoading, subscribeFeed, unsubscribeFeed, createPost, toggleLike, hasLiked, loadComments, addComment } = useCommunityStore();
  const { user } = useUserStore();

  useEffect(() => {
    const unsub = subscribeFeed();
    return () => unsub && unsub();
  }, []);

  const handleLike = (postId) => {
    toggleLike(postId, user?.uid);
  };

  const handleCreatePost = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    try {
      await createPost(postText.trim(), {
        uid: user?.uid || 'anon',
        displayName: user?.displayName || 'Fitness Fan',
        photoURL: user?.photoURL || null,
      });
      setPostText('');
      setComposerOpen(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create post.');
    } finally {
      setPosting(false);
    }
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `'${post.text}' - by ${post.author?.displayName || 'Anonymous'} on RorkZeron`,
      });
    } catch (e) {}
  };

  const handleStartChat = (author) => {
    if (!author?.uid || author.uid === user?.uid) {
      Alert.alert('Notice', 'You cannot message yourself.');
      return;
    }
    const conversationId = getConversationId(user.uid, author.uid);
    router.push(`/messages/${conversationId}`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Community" />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'feed' && styles.activeTab]}
          onPress={() => setTab('feed')}>
          <Text style={[styles.tabText, tab === 'feed' && styles.activeTabText]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'challenges' && styles.activeTab]}
          onPress={() => setTab('challenges')}>
          <Text style={[styles.tabText, tab === 'challenges' && styles.activeTabText]}>Challenges</Text>
        </TouchableOpacity>
      </View>

      {tab === 'feed' ? (
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={tokens.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(i) => i.id}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={() => (
                <TouchableOpacity
                  style={styles.composerPrompt}
                  onPress={() => setComposerOpen(true)}>
                  <Text style={styles.composerPromptText}>What's on your mind? Share a workout or thought...</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const liked = hasLiked(item.id, user?.uid) || !!likedByMe[item.id];
                const likeCount = (item.likes || 0) + (liked && !item.likedByMe ? 1 : 0);
                return (
                  <View style={styles.postCard}>
                    {/* Author Header */}
                    <View style={styles.postHeader}>
                      <TouchableOpacity
                        style={styles.authorInfo}
                        onPress={() => handleStartChat(item.author)}>
                        <View style={styles.avatarBadge}>
                          <Text style={styles.avatarText}>
                            {(item.author?.displayName || 'A')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.authorName}>
                            {item.author?.displayName || 'Anonymous'}
                          </Text>
                          <Text style={styles.postTime}>
                            {timeAgo(item.createdAt)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Post Content */}
                    <Text style={styles.postText}>{item.text}</Text>

                    {/* Post Actions */}
                    <View style={styles.postActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleLike(item.id)}>
                        <Heart
                          size={20}
                          color={liked ? tokens.colors.primary : tokens.colors.textMuted}
                          fill={liked ? tokens.colors.primary : 'none'}
                        />
                        <Text style={[styles.actionText, liked && styles.activeActionText]}>
                          {likeCount}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleShare(item)}>
                        <Share2 size={20} color={tokens.colors.textMuted} />
                        <Text style={styles.actionText}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.challengesContainer}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>
          <Text style={styles.sectionSubtitle}>Join a community goal and track progress together</Text>

          {CHALLENGES.map((ch) => (
            <View key={ch.id} style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeName}>{ch.name}</Text>
                <Text style={styles.daysLeft}>{ch.daysLeft} days left</Text>
              </View>
              <Text style={styles.participantCount}>{ch.participants} participants</Text>
              <PrimaryButton
                title="Join Challenge"
                onPress={() => Alert.alert('Joined!', `You joined ${ch.name}`)}
                style={styles.joinBtn}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create Post Modal */}
      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}>
                <X size={24} color={tokens.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="What's on your mind?"
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              value={postText}
              onChangeText={setPostText}
              autoFocus
            />

            <PrimaryButton
              title={posting ? 'Posting...' : 'Post'}
              onPress={handleCreatePost}
              disabled={posting || !postText.trim()}
              style={styles.postBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNavigation activeTab="community" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: tokens.colors.primary,
  },
  tabText: {
    fontSize: tokens.typography.fontSize.md,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  activeTabText: {
    color: tokens.colors.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: tokens.spacing.md,
    paddingBottom: 100,
  },
  composerPrompt: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  composerPromptText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSize.md,
  },
  emptyContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSize.md,
  },
  postCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: tokens.typography.fontSize.md,
  },
  authorName: {
    fontSize: tokens.typography.fontSize.md,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  postTime: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.textMuted,
  },
  postText: {
    fontSize: tokens.typography.fontSize.md,
    color: tokens.colors.textPrimary,
    lineHeight: 22,
    marginBottom: tokens.spacing.md,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: tokens.spacing.lg,
  },
  actionText: {
    marginLeft: tokens.spacing.xs,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textMuted,
  },
  activeActionText: {
    color: tokens.colors.primary,
  },
  scrollContent: {
    flex: 1,
  },
  challengesContainer: {
    padding: tokens.spacing.md,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.md,
  },
  challengeCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  challengeName: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  daysLeft: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary,
    fontWeight: '500',
  },
  participantCount: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.md,
  },
  joinBtn: {
    marginTop: tokens.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.borderRadius.xl,
    borderTopRightRadius: tokens.borderRadius.xl,
    padding: tokens.spacing.lg,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  modalTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary,
  },
  input: {
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.md,
    color: tokens.colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: tokens.spacing.md,
  },
  postBtn: {
    marginTop: 'auto',
  },
});

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
// join state, progress toward a goal) — that's a separate, larger feature
// than a post feed. Left as a clearly-marked placeholder rather than
// building a shallow version of it in the same pass as the real feed.
const CHALLENGES = [
  { id: 'c1', name: '30-Day Cardio', participants: 412, daysLeft: 12 },
  { id: 'c2', name: 'Strength PR Month', participants: 206, daysLeft: 21 },
  { id: 'c3', name: 'Summer Shred', participants: 894, daysLeft: 34 },
];

function timeAgo(timestamp) {
  if (!timestamp?.toDate) return '';
  const diffMs = Date.now() - timestamp.toDate().getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function CommunityScreen() {
  const [tab, setTab] = useState('feed');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedByMe, setLikedByMe] = useState({});

  const { posts, isLoading, subscribeFeed, unsubscribeFeed, createPost, toggleLike, hasLiked, loadComments, addComment } = useCommunityStore();
  const { user } = useUserStore();

  useEffect(() => {
    subscribeFeed(50);
    return () => unsubscribeFeed();
  }, []);

  useEffect(() => {
    if (!user?.uid || posts.length === 0) return;
    Promise.all(posts.map((p) => hasLiked(p.id, user.uid))).then((results) => {
      const map = {};
      posts.forEach((p, i) => { map[p.id] = results[i]; });
      setLikedByMe(map);
    });
  }, [posts.map((p) => p.id).join(','), user?.uid]);

  const handlePost = async () => {
    if (!postText.trim() || !user?.uid) return;
    setPosting(true);
    try {
      await createPost({
        uid: user.uid,
        authorName: user.name,
        authorAvatar: user.profileImage,
        text: postText,
        type: 'general',
      });
      setPostText('');
      setComposerOpen(false);
    } catch (e) {
      Alert.alert('Error', "Couldn't post right now. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    if (!user?.uid) return;
    // Optimistic — flips immediately, corrected if the write fails.
    setLikedByMe((prev) => ({ ...prev, [postId]: !prev[postId] }));
    const result = await toggleLike(postId, user.uid);
    if (result === null) {
      setLikedByMe((prev) => ({ ...prev, [postId]: !prev[postId] }));
    }
  };

  // ---- Comments ----
  const [commentsPost, setCommentsPost] = useState(null); // the post currently open in the comment sheet
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const openComments = async (post) => {
    setCommentsPost(post);
    setLoadingComments(true);
    const real = await loadComments(post.id);
    setComments(real);
    setLoadingComments(false);
  };

  const closeComments = () => {
    setCommentsPost(null);
    setComments([]);
    setCommentText('');
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user?.uid || !commentsPost) return;
    setSendingComment(true);
    try {
      const newId = await addComment(commentsPost.id, {
        uid: user.uid,
        authorName: user.name,
        text: commentText,
      });
      // Reflect it immediately rather than waiting on a second round trip
      // to re-fetch the whole comment list.
      setComments((prev) => [...prev, {
        id: newId, authorId: user.uid, authorName: user.name,
        text: commentText.trim(), createdAt: { toDate: () => new Date() },
      }]);
      setCommentText('');
    } catch (e) {
      Alert.alert('Error', "Couldn't post your comment. Try again.");
    } finally {
      setSendingComment(false);
    }
  };

  // ---- Share ----
  // Real OS share sheet (React Native's built-in Share API — no new
  // dependency) rather than an internal "repost" concept, which would need
  // its own separate data model. shareCount is a real, non-author-writable
  // counter on the post (see firestore.rules — same allowed-fields pattern
  // already used for likeCount/commentCount), incremented only once the OS
  // share sheet actually completes, not just on tapping the button.
  const handleShare = async (post) => {
    try {
      const result = await Share.share({
        message: `${post.authorName} on Zown: "${post.text}"`,
      });
      if (result.action === Share.sharedAction) {
        useCommunityStore.getState().recordShare(post.id, user?.uid);
      }
    } catch (e) {
      console.warn('[community] share failed', e?.message);
    }
  };

  const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Community" />

      <View style={styles.tabs}>
        {['feed', 'challenges'].map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}>
              <Text style={[styles.tabText, { color: active ? '#000' : '#999' }]}>
                {t === 'feed' ? 'Feed' : 'Challenges'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 100 }}>
        {tab === 'feed' ? (
          <>
            <PrimaryButton title="Share an update" onPress={() => setComposerOpen(true)} style={{ marginBottom: tokens.spacing.md }} />
            {posts.length === 0 && !isLoading && (
              <Text style={{ color: tokens.colors.dark_navy.text_muted, textAlign: 'center', marginTop: 20 }}>
                No posts yet — be the first to share something.
              </Text>
            )}
            {posts.map(post => (
              <View key={post.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.postHeader}
                  disabled={post.authorId === user?.uid}
                  onPress={() => {
                    if (post.authorId === user?.uid) return;
                    const conversationId = getConversationId(user.uid, post.authorId);
                    router.push({
                      pathname: '/messages/[id]',
                      params: { id: conversationId, name: post.authorName, otherUid: post.authorId, avatar: post.authorAvatar || '' },
                    });
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(post.authorName)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.postName}>{post.authorName}</Text>
                    <Text style={styles.postTime}>{timeAgo(post.createdAt)} ago</Text>
                  </View>
                  {post.authorId !== user?.uid && (
                    <MessageCircle size={16} color={tokens.colors.dark_navy.text_muted} />
                  )}
                </TouchableOpacity>
                <Text style={styles.postText}>{post.text}</Text>
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.action} onPress={() => handleLike(post.id)}>
                    <Heart
                      size={18} color={likedByMe[post.id] ? '#EF4444' : tokens.colors.dark_navy.text_muted}
                      fill={likedByMe[post.id] ? '#EF4444' : 'none'}
                    />
                    <Text style={styles.actionText}>{post.likeCount || 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.action} onPress={() => openComments(post)}>
                    <MessageCircle size={18} color={tokens.colors.dark_navy.text_muted} />
                    <Text style={styles.actionText}>{post.commentCount || 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.action} onPress={() => handleShare(post)}>
                    <Share2 size={18} color={tokens.colors.dark_navy.text_muted} />
                    <Text style={styles.actionText}>{post.shareCount || 0}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          CHALLENGES.map(c => (
            <View key={c.id} style={styles.card}>
              <View style={styles.challengeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeName}>{c.name}</Text>
                  <Text style={styles.challengeMeta}>{c.participants} participants</Text>
                </View>
                <View style={styles.daysBadge}>
                  <Text style={styles.daysText}>{c.daysLeft}d left</Text>
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <PrimaryButton
                  title="Join"
                  variant="outline"
                  style={{ height: 36 }}
                  onPress={() => Alert.alert('Coming soon', 'Challenge tracking is coming soon.')}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share an update</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}>
                <X size={22} color={tokens.colors.dark_navy.bg_primary} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={postText}
              onChangeText={setPostText}
              placeholder="What's on your mind?"
              placeholderTextColor={tokens.colors.dark_navy.text_muted}
              style={styles.composerInput}
              multiline
              autoFocus
            />
            <PrimaryButton title="Post" onPress={handlePost} loading={posting} disabled={!postText.trim()} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!commentsPost} animationType="slide" transparent onRequestClose={closeComments}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={[styles.modalCard, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={closeComments}>
                <X size={22} color={tokens.colors.dark_navy.bg_primary} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color={tokens.colors.dark_navy.bg_primary} style={{ marginVertical: 30 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <Text style={{ color: tokens.colors.dark_navy.text_muted, textAlign: 'center', marginVertical: 20 }}>
                    No comments yet — be the first.
                  </Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={{ color: tokens.colors.dark_navy.bg_primary, fontWeight: '700', fontSize: 11 }}>
                        {initials(item.authorName)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.commentAuthor}>{item.authorName}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={tokens.colors.dark_navy.text_muted}
                style={styles.commentInput}
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={!commentText.trim() || sendingComment}
                style={styles.commentSendBtn}
              >
                <Send size={16} color={tokens.colors.dark_navy.text_primary} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  tabs: { flexDirection: 'row', paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.sm },
  tab: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  tabInactive: { backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border },
  tabText: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginBottom: 12,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: tokens.colors.dark_navy.bg_card,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: tokens.colors.dark_navy.bg_primary, fontWeight: '700', fontSize: 13 },
  postName: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, fontWeight: '600' },
  postTime: { color: tokens.colors.dark_navy.text_secondary, fontSize: 12 },
  postText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  postActions: {
    flexDirection: 'row', gap: 20,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: tokens.colors.dark_navy.text_muted, fontSize: 13 },
  challengeRow: { flexDirection: 'row', alignItems: 'center' },
  challengeName: { color: tokens.colors.dark_navy.bg_primary, fontSize: 16, fontWeight: '600' },
  challengeMeta: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 2 },
  daysBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  daysText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: tokens.spacing.md, gap: tokens.spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: tokens.colors.dark_navy.bg_primary, fontSize: 16, fontWeight: '700' },
  composerInput: {
    minHeight: 100, borderWidth: 1, borderColor: tokens.colors.dark_navy.border, borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md, color: tokens.colors.dark_navy.bg_primary, fontSize: 14, textAlignVertical: 'top',
  },
  commentRow: { flexDirection: 'row', paddingVertical: 8 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: tokens.colors.dark_navy.bg_card,
    alignItems: 'center', justifyContent: 'center',
  },
  commentAuthor: { color: tokens.colors.dark_navy.bg_primary, fontSize: 13, fontWeight: '600' },
  commentText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 13, marginTop: 2 },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm, paddingTop: tokens.spacing.sm,
    borderTopWidth: 1, borderTopColor: tokens.colors.dark_navy.border,
  },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: tokens.colors.dark_navy.border, borderRadius: 999,
    paddingHorizontal: tokens.spacing.md, paddingVertical: 10, color: tokens.colors.dark_navy.bg_primary, fontSize: 14,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.dark_navy.bg_primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

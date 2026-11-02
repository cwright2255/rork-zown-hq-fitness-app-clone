import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Share, FlatList, ActivityIndicator } from 'react-native';
import { Heart, MessageCircle, X, Send, Share2, EllipsisVertical, Ellipsis } from 'lucide-react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';
import { useCommunityStore } from '@/store/communityStore';
import { useUserStore } from '@/store/userStore';
import { getConversationId } from '@/store/messagingStore';
import PostMedia from '@/components/PostMedia';
import PostComposer from '@/components/PostComposer';
import ModerationSheet from '@/components/ModerationSheet';
import { useBlockStore } from '@/store/blockStore';
import { canPost, normalizeMedia, mediaSummary, postErrorMessage } from '@/lib/postMedia';
import { withoutBlocked, postTarget, commentTarget } from '@/lib/moderation';
import { isContentNotAllowed, NOT_ALLOWED_MESSAGE } from '@/lib/wordFilter';
import { MAX_COMMENT_LENGTH } from '@/lib/communityLimits';
import { useLikes } from '@/hooks/useLikes';
import RunPostCard from '@/components/RunPostCard';

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
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [mediaItems, setMediaItems] = useState([]); // photos or a video picked for the new post
  const [uploadProgress, setUploadProgress] = useState(0);

  const { posts, isLoading, subscribeFeed, unsubscribeFeed, createPost, toggleLike, hasLiked, loadComments, addComment, deleteComment } = useCommunityStore();
  const { user } = useUserStore();
  const { likedByMe, setLikedByMe, handleLike, likeCountOf } = useLikes({ uid: user?.uid, toggleLike });
  // People this person has blocked: their posts and comments are not shown (store/blockStore.js).
  const blocked = useBlockStore((st) => st.blocked);
  const subscribeBlocks = useBlockStore((st) => st.subscribeBlocks);
  const [moderationTarget, setModerationTarget] = useState(null); // the post or comment whose Report / Block menu is open

  useEffect(() => {
    subscribeFeed(50);
    return () => unsubscribeFeed();
  }, []);

  useEffect(() => {
    if (user?.uid) subscribeBlocks(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || posts.length === 0) return;
    Promise.all(posts.map((p) => hasLiked(p.id, user.uid))).then((results) => {
      const map = {};
      posts.forEach((p, i) => { map[p.id] = results[i]; });
      setLikedByMe(map);
    });
  }, [posts.map((p) => p.id).join(','), user?.uid]);

  const handlePost = async () => {
    if (!canPost(postText, mediaItems) || !user?.uid) return;
    setPosting(true);
    setUploadProgress(0);
    try {
      await createPost({
        uid: user.uid,
        authorName: user.name,
        authorAvatar: user.profileImage,
        text: postText,
        type: 'general',
        mediaItems,
        onProgress: setUploadProgress,
      });
      setPostText('');
      setMediaItems([]);
      setComposerOpen(false);
    } catch (e) {
      console.warn('[post] failed:', e?.code, e?.message);
      Alert.alert('Error', postErrorMessage(e, mediaItems.length > 0));
    } finally {
      setPosting(false);
    }
  };

  const closeComposer = () => {
    if (!posting) setComposerOpen(false);
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
      Alert.alert('Error', isContentNotAllowed(e) ? NOT_ALLOWED_MESSAGE : "Couldn't post your comment. Try again.");
    } finally {
      setSendingComment(false);
    }
  };

  // Removes a comment (its author and the owner of the post can; firestore.rules). It leaves the open list at once.
  const handleDeleteComment = async (target) => {
    const removed = await deleteComment(target.postId, target.id);
    if (removed) setComments((prev) => prev.filter((c) => c.id !== target.id));
    else Alert.alert('Error', "Couldn't delete that comment. Try again.");
  };

  // ---- Share ----
  // Real OS share sheet (React Native's built-in Share API — no new
  // dependency) rather than an internal "repost" concept, which would need
  // its own separate data model. A share is recorded (recordShare in
  // store/communityStore.js) only once the OS share sheet actually completes,
  // not just on tapping the button, as one document per person under the post;
  // the Cloud Function that sees it appear moves the post's shareCount.
  const handleShare = async (post) => {
    try {
      const summary = mediaSummary(normalizeMedia(post));
      const result = await Share.share({
        message: post.text
          ? `${post.authorName} on Zown: "${post.text}"`
          : `${post.authorName} shared ${summary || 'a post'} on Zown`,
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

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 100 }}>
        <PrimaryButton title="Share an update" onPress={() => setComposerOpen(true)} style={{ marginBottom: tokens.spacing.md }} />
        {posts.length === 0 && !isLoading && (
          <Text style={{ color: '#999999', textAlign: 'center', marginTop: 20 }}>
            No posts yet — be the first to share something.
          </Text>
        )}
        {withoutBlocked(posts, blocked).map(post => (
          <View key={post.id} style={styles.card}>
            <View style={styles.postHeaderRow}>
              <TouchableOpacity
                style={[styles.postHeader, { flex: 1 }]}
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
                  <MessageCircle size={16} color="#999999" />
                )}
              </TouchableOpacity>
              {post.authorId !== user?.uid && (
                <TouchableOpacity
                  style={styles.moreBtn}
                  testID={`post-more-${post.id}`}
                  accessibilityLabel="Report or block"
                  onPress={() => setModerationTarget(postTarget(post))}
                >
                  <EllipsisVertical size={18} color="#999999" />
                </TouchableOpacity>
              )}
            </View>
            {!!post.text && <Text style={styles.postText}>{post.text}</Text>}
            {!!post.run && <RunPostCard run={post.run} />}
            <PostMedia media={normalizeMedia(post)} />
            <View style={styles.postActions}>
              <TouchableOpacity style={styles.action} onPress={() => handleLike(post)} testID={`like-${post.id}`}>
                <Heart
                  size={18} color={likedByMe[post.id] ? '#EF4444' : '#999999'}
                  fill={likedByMe[post.id] ? '#EF4444' : 'none'}
                />
                <Text style={styles.actionText}>{likeCountOf(post)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => openComments(post)}>
                <MessageCircle size={18} color="#999999" />
                <Text style={styles.actionText}>{post.commentCount || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => handleShare(post)}>
                <Share2 size={18} color="#999999" />
                <Text style={styles.actionText}>{post.shareCount || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <PostComposer
        visible={composerOpen}
        onClose={closeComposer}
        authorName={user?.name}
        text={postText}
        onChangeText={setPostText}
        items={mediaItems}
        onChangeItems={setMediaItems}
        posting={posting}
        progress={uploadProgress}
        onSubmit={handlePost}
      />

      <Modal visible={!!commentsPost} animationType="slide" transparent onRequestClose={closeComments}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={[styles.modalCard, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={closeComments}>
                <X size={22} color="#000000" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 30 }} />
            ) : (
              <FlatList
                data={withoutBlocked(comments, blocked)}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <Text style={{ color: '#999999', textAlign: 'center', marginVertical: 20 }}>
                    No comments yet — be the first.
                  </Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={{ color: '#000000', fontWeight: '700', fontSize: 11 }}>
                        {initials(item.authorName)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.commentAuthor}>{item.authorName}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moreBtn}
                      testID={`comment-more-${item.id}`}
                      accessibilityLabel="Comment options"
                      onPress={() => setModerationTarget(commentTarget({ post: commentsPost, comment: item, myUid: user?.uid }))}
                    >
                      <Ellipsis size={16} color="#999999" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor="#999999"
                style={styles.commentInput}
                maxLength={MAX_COMMENT_LENGTH}
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={!commentText.trim() || sendingComment}
                style={styles.commentSendBtn}
              >
                <Send size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          <ModerationSheet
            target={moderationTarget?.kind === 'comment' ? moderationTarget : null}
            myUid={user?.uid}
            onClose={() => setModerationTarget(null)}
            onDeleteComment={handleDeleteComment}
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* Report / Block on a post. (A comment's is inside the comments window above: a phone cannot show two windows side by side.) */}
      <ModerationSheet
        target={moderationTarget?.kind === 'comment' ? null : moderationTarget}
        myUid={user?.uid}
        onClose={() => setModerationTarget(null)}
      />

      <BottomNavigation />
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass, applied across every JSX inline color prop and style
// here (icons, placeholders, modal chrome, the styles block below).
// Two spots needed a genuine contrast decision rather than a direct
// swap: the comment avatar's initials text (now black, since its
// background is now light gray #F5F5F5 instead of a dark bg_card) and
// the comment-send button's icon (now white, since its background is
// now black instead of the dark-navy bg_primary it was designed
// against). postActions' borderTopColor wasn't routed through
// dark_navy (a plain #2A2A2A), but was still a dark-background-designed
// separator - changed to #F0F0F0, matching the same subtle-divider
// convention already used in app/nutrition.jsx's food rows.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  card: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginBottom: 12,
  },
  postHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  moreBtn: { padding: 6 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  postName: { color: '#000000', fontSize: 14, fontWeight: '600' },
  postTime: { color: '#999999', fontSize: 12 },
  postText: { color: '#000000', fontSize: 14, lineHeight: 20, marginTop: 10 },
  postActions: {
    flexDirection: 'row', gap: 20,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#999999', fontSize: 13 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: tokens.spacing.md, gap: tokens.spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#000000', fontSize: 16, fontWeight: '700' },
  composerInput: {
    minHeight: 100, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md, color: '#000000', fontSize: 14, textAlignVertical: 'top',
  },
  commentRow: { flexDirection: 'row', paddingVertical: 8 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAuthor: { color: '#000000', fontSize: 13, fontWeight: '600' },
  commentText: { color: '#000000', fontSize: 13, marginTop: 2 },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm, paddingTop: tokens.spacing.sm,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 999,
    paddingHorizontal: tokens.spacing.md, paddingVertical: 10, color: '#000000', fontSize: 14,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center',
  },
});

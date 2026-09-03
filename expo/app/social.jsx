import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Platform,
  TextInput, Modal, KeyboardAvoidingView, Alert, Share, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCommunityStore } from '@/store/communityStore';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useDuelStore, DUEL_PRESETS } from '@/store/duelStore';
import { useGroupStore } from '@/store/groupStore';
import { useUserStore } from '@/store/userStore';
import { getConversationId } from '@/store/messagingStore';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const TABS = ['Feed', 'Leaderboard', 'Duels', 'Community'];

function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysLeftLabel(endDate) {
  if (!endDate) return '';
  const days = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default function SocialScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Feed');
  const { user } = useUserStore();
  const displayName = user?.name || 'Athlete';
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  /* -- Feed: real posts, real likes, real comments, real share, real
     edit/delete/visibility settings, real search over real posts and
     real people. -- */
  const {
    posts, isLoading: postsLoading, subscribeFeed, unsubscribeFeed, createPost, updatePost,
    updatePostSettings, deletePost, toggleLike, hasLiked, loadComments, addComment,
  } = useCommunityStore();
  const [likedByMe, setLikedByMe] = useState({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentsPost, setCommentsPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postMenuFor, setPostMenuFor] = useState(null); // post currently showing its 3-dot menu
  const [editingPost, setEditingPost] = useState(null); // post currently being edited
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [insightsPost, setInsightsPost] = useState(null); // post currently showing engagement insights

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
      await createPost({ uid: user.uid, authorName: user.name, authorAvatar: user.profileImage, text: postText, type: 'general' });
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
    setLikedByMe((prev) => ({ ...prev, [postId]: !prev[postId] }));
    const result = await toggleLike(postId, user.uid);
    if (result === null) setLikedByMe((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const openComments = async (post) => {
    if (post.commentsDisabled) return;
    setCommentsPost(post);
    setLoadingComments(true);
    setComments(await loadComments(post.id));
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
      const newId = await addComment(commentsPost.id, { uid: user.uid, authorName: user.name, text: commentText });
      setComments((prev) => [...prev, { id: newId, authorId: user.uid, authorName: user.name, text: commentText.trim() }]);
      setCommentText('');
    } catch (e) {
      Alert.alert('Error', "Couldn't post your comment. Try again.");
    } finally {
      setSendingComment(false);
    }
  };

  const handleShare = async (post) => {
    try {
      const result = await Share.share({ message: `${post.authorName} on Zown: "${post.text}"` });
      if (result.action === Share.sharedAction) {
        useCommunityStore.getState().recordShare(post.id, user?.uid);
      }
    } catch (e) {
      console.warn('[social] share failed', e?.message);
    }
  };

  /* -- Post menu actions -- */
  const openEdit = (post) => {
    setPostMenuFor(null);
    setEditingPost(post);
    setEditText(post.text);
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editText.trim() || !user?.uid) return;
    setSavingEdit(true);
    const ok = await updatePost(editingPost.id, user.uid, editText);
    setSavingEdit(false);
    if (ok) {
      setEditingPost(null);
      setEditText('');
    } else {
      Alert.alert('Error', "Couldn't save your edit. Try again.");
    }
  };

  const handleDelete = (post) => {
    setPostMenuFor(null);
    Alert.alert('Delete post?', 'This can\u2019t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(post.id, user?.uid) },
    ]);
  };

  const handleToggleSetting = (post, field) => {
    setPostMenuFor(null);
    updatePostSettings(post.id, { [field]: !post[field] });
  };

  const openInsights = (post) => {
    setPostMenuFor(null);
    setInsightsPost(post);
  };

  const messageFromSearch = (person) => {
    setSearchQuery('');
    router.push({
      pathname: '/messages/[id]',
      params: { id: getConversationId(user?.uid, person.id), name: person.name, otherUid: person.id, avatar: person.avatar || '' },
    });
  };

  /* -- Leaderboard: real, live entries. Also the real "people" source for
     search, since there's no user-search feature anywhere in this app. -- */
  const { entries, subscribeTop, unsubscribe: unsubscribeLeaderboard } = useLeaderboardStore();
  useEffect(() => {
    subscribeTop(50);
    return () => unsubscribeLeaderboard();
  }, []);

  const query = searchQuery.trim().toLowerCase();
  const matchingPeople = query
    ? entries.filter((e) => e.id !== user?.uid && (e.name || '').toLowerCase().includes(query))
    : [];
  const visiblePosts = query
    ? posts.filter((p) => (p.text || '').toLowerCase().includes(query))
    : posts;

  /* -- Duels: real, server-verified progress. -- */
  const { duels, subscribeDuels, unsubscribeDuels, proposeDuel, acceptDuel, declineDuel, getDisplayStatus } = useDuelStore();
  const [duelTarget, setDuelTarget] = useState(null); // { uid, name } of who's being challenged
  const [sendingDuel, setSendingDuel] = useState(false);

  useEffect(() => {
    if (user?.uid) subscribeDuels(user.uid);
    return () => unsubscribeDuels();
  }, [user?.uid]);

  const handleProposeDuel = async (preset) => {
    if (!duelTarget || !user?.uid) return;
    setSendingDuel(true);
    try {
      await proposeDuel({ fromUid: user.uid, fromName: user.name, toUid: duelTarget.uid, toName: duelTarget.name, preset });
      setDuelTarget(null);
    } catch (e) {
      Alert.alert('Error', "Couldn't send that duel. Try again.");
    } finally {
      setSendingDuel(false);
    }
  };

  const pendingForMe = duels.filter((d) => d.status === 'pending' && d.proposedBy !== user?.uid);
  const pendingSent = duels.filter((d) => d.status === 'pending' && d.proposedBy === user?.uid);
  const activeDuels = duels.filter((d) => d.status === 'active');
  const endedDuels = duels.filter((d) => {
    if (d.status === 'completed') return true;
    if (d.status === 'active' && d.mode === 'most_by_deadline' && d.endDate && new Date(d.endDate) < new Date()) return true;
    return false;
  });

  /* -- Community groups: real, admin-catalog + real join state. -- */
  const { groups, joinedGroupIds, loadGroups, joinGroup, leaveGroup } = useGroupStore();
  useEffect(() => {
    loadGroups(user?.uid);
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups(user?.uid);
    setRefreshing(false);
  };

  /* -- Renderers -- */

  const renderFeed = () => (
    <View>
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={18} color="#999" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search people or topics"
          placeholderTextColor="#999"
          style={s.searchInput}
        />
        {!!searchQuery && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#CCC" />
          </Pressable>
        )}
      </View>

      {!!query && (
        matchingPeople.length > 0 && (
          <View style={s.peopleResults}>
            <Text style={s.peopleResultsTitle}>People</Text>
            {matchingPeople.slice(0, 5).map((p) => (
              <Pressable key={p.id} style={s.peopleRow} onPress={() => messageFromSearch(p)}>
                <View style={s.peopleAvatar}><Text style={s.peopleAvatarText}>{initials(p.name)}</Text></View>
                <Text style={s.peopleName}>{p.name}</Text>
                <Ionicons name="chatbubble-outline" size={16} color="#999" />
              </Pressable>
            ))}
          </View>
        )
      )}

      {visiblePosts.length === 0 && !postsLoading && (
        <Text style={s.emptyText}>{query ? 'No posts match that search.' : 'No posts yet — be the first to share something.'}</Text>
      )}
      {visiblePosts.map((post) => {
        const isMe = post.authorId === user?.uid;
        const showLikes = !post.likesHidden || isMe;
        const showShares = !post.shareCountHidden || isMe;
        return (
          <View key={post.id} style={s.feedCard}>
            <View style={s.feedHeader}>
              <View style={s.feedAvatar}><Text style={s.feedAvatarText}>{initials(post.authorName)}</Text></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.feedUser}>{post.authorName}</Text>
                <Text style={s.feedTime}>{timeAgo(post.createdAt)}{post.editedAt ? ' · edited' : ''}</Text>
              </View>
              {isMe && (
                <Pressable style={s.postMenuBtn} onPress={() => setPostMenuFor(post)}>
                  <Ionicons name="ellipsis-vertical" size={18} color="#666" />
                </Pressable>
              )}
            </View>
            <Text style={s.feedText}>{post.text}</Text>
            <View style={s.feedActionsRow}>
              <Pressable style={s.feedActionBtn} onPress={() => handleLike(post.id)}>
                <Ionicons name={likedByMe[post.id] ? 'heart' : 'heart-outline'} size={18} color={likedByMe[post.id] ? '#FF3B30' : '#666'} />
                {showLikes && <Text style={s.feedActionText}>{post.likeCount || 0}</Text>}
              </Pressable>
              <Pressable style={[s.feedActionBtn, post.commentsDisabled && { opacity: 0.4 }]} onPress={() => openComments(post)} disabled={post.commentsDisabled}>
                <Ionicons name="chatbubble-outline" size={17} color="#666" />
                <Text style={s.feedActionText}>{post.commentsDisabled ? 'Off' : (post.commentCount || 0)}</Text>
              </Pressable>
              <Pressable style={s.feedActionBtn} onPress={() => handleShare(post)}>
                <Ionicons name="arrow-redo-outline" size={17} color="#666" />
                {showShares && <Text style={s.feedActionText}>{post.shareCount || 0}</Text>}
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderLeaderboard = () => (
    <View>
      {entries.length === 0 ? (
        <Text style={s.emptyText}>No one on the leaderboard yet.</Text>
      ) : (
        entries.map((entry, i) => {
          const isMe = entry.id === user?.uid;
          return (
            <View key={entry.id} style={[s.leaderRow, isMe && s.leaderRowMe]}>
              <Text style={[s.leaderRank, i < 3 && { color: MEDAL_COLORS[i] }]}>{i + 1}</Text>
              <View style={s.leaderAvatar}><Text style={s.leaderAvatarText}>{initials(entry.name)}</Text></View>
              <Text style={s.leaderName}>{isMe ? 'You' : entry.name}</Text>
              <Text style={s.leaderXp}>{(entry.xp || 0).toLocaleString()} XP</Text>
              {!isMe && (
                <Pressable style={s.duelIconBtn} onPress={() => setDuelTarget({ uid: entry.id, name: entry.name })}>
                  <Ionicons name="flash-outline" size={16} color="#000" />
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  const renderDuelCard = (duel, kind) => {
    const status = getDisplayStatus(duel, user?.uid);
    return (
      <View key={duel.id} style={s.duelCard}>
        <Text style={s.duelTitle}>{duel.label} vs {status.opponentName}</Text>

        {kind === 'incoming' ? (
          <>
            <Text style={s.duelSub}>Wants to duel you</Text>
            <View style={s.duelBtnRow}>
              <Pressable style={s.duelAcceptBtn} onPress={() => acceptDuel(duel.id)}>
                <Text style={s.duelAcceptBtnText}>Accept</Text>
              </Pressable>
              <Pressable style={s.duelDeclineBtn} onPress={() => declineDuel(duel.id)}>
                <Text style={s.duelDeclineBtnText}>Decline</Text>
              </Pressable>
            </View>
          </>
        ) : kind === 'sent' ? (
          <Text style={s.duelSub}>Waiting for them to respond</Text>
        ) : (
          <>
            <Text style={s.duelProgress}>You: {status.mine}  ·  Them: {status.theirs}</Text>
            {!status.ended && duel.mode === 'first_to_target' && (
              <Text style={s.duelSub}>First to {duel.goalTarget} wins</Text>
            )}
            {!status.ended && duel.endDate && <Text style={s.duelDays}>{daysLeftLabel(duel.endDate)}</Text>}
            {status.ended && (
              <Text style={[s.duelResult, { color: status.won ? '#22C55E' : '#DC2626' }]}>
                {status.won ? 'You won!' : 'You lost'}
              </Text>
            )}
          </>
        )}
      </View>
    );
  };

  const renderDuels = () => (
    <View>
      {pendingForMe.length === 0 && pendingSent.length === 0 && activeDuels.length === 0 && endedDuels.length === 0 && (
        <Text style={s.emptyText}>No duels yet — challenge someone from the Leaderboard tab.</Text>
      )}
      {pendingForMe.length > 0 && (
        <>
          <Text style={s.duelSectionTitle}>Challenges for You</Text>
          {pendingForMe.map((d) => renderDuelCard(d, 'incoming'))}
        </>
      )}
      {activeDuels.length > 0 && (
        <>
          <Text style={s.duelSectionTitle}>Active</Text>
          {activeDuels.filter((d) => !endedDuels.includes(d)).map((d) => renderDuelCard(d, 'active'))}
        </>
      )}
      {pendingSent.length > 0 && (
        <>
          <Text style={s.duelSectionTitle}>Sent</Text>
          {pendingSent.map((d) => renderDuelCard(d, 'sent'))}
        </>
      )}
      {endedDuels.length > 0 && (
        <>
          <Text style={s.duelSectionTitle}>Ended</Text>
          {endedDuels.map((d) => renderDuelCard(d, 'active'))}
        </>
      )}
    </View>
  );

  const renderCommunity = () => (
    <View>
      {groups.map((g) => {
        const joined = joinedGroupIds.has(g.id);
        return (
          <View key={g.id} style={s.communityRow}>
            <View style={s.communityIcon}><Ionicons name={g.icon || 'people-outline'} size={20} color="#000" /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.communityName}>{g.name}</Text>
              <Text style={s.communityDesc} numberOfLines={1}>{g.description}</Text>
              <Text style={s.communityMembers}>{(g.memberCount || 0).toLocaleString()} member{g.memberCount === 1 ? '' : 's'}</Text>
            </View>
            <Pressable
              style={[s.groupJoinBtn, joined && s.groupLeaveBtn]}
              onPress={() => (joined ? leaveGroup(g.id, user?.uid) : joinGroup(g.id, user?.uid))}
            >
              <Text style={[s.groupJoinBtnText, joined && s.groupLeaveBtnText]}>{joined ? 'Leave' : 'Join'}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAvatar}><Text style={s.headerAvatarText}>{initials(displayName)}</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.headerGreet}>Hello {displayName}!</Text>
            <Text style={s.headerDate}>{dateStr}</Text>
          </View>
          <Pressable style={s.iconBtn} onPress={() => router.push('/messages')}>
            <Ionicons name="chatbubble-outline" size={18} color="#000" />
          </Pressable>
          <Pressable style={[s.iconBtn, { marginLeft: 8 }]} onPress={() => setComposerOpen(true)}>
            <Ionicons name="add" size={20} color="#000" />
          </Pressable>
        </View>

        {/* Tab Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 16 }}>
          {TABS.map((t) => (
            <Pressable key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab === 'Feed' && renderFeed()}
        {activeTab === 'Leaderboard' && renderLeaderboard()}
        {activeTab === 'Duels' && renderDuels()}
        {activeTab === 'Community' && renderCommunity()}
      </ScrollView>

      {/* Composer */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Share an update</Text>
              <Pressable onPress={() => setComposerOpen(false)}><Ionicons name="close" size={22} color="#000" /></Pressable>
            </View>
            <TextInput
              value={postText} onChangeText={setPostText} placeholder="What's on your mind?"
              placeholderTextColor="#999" style={s.composerInput} multiline autoFocus
            />
            <Pressable style={[s.composeBtn, (!postText.trim() || posting) && { opacity: 0.5 }]} onPress={handlePost} disabled={!postText.trim() || posting}>
              <Text style={s.composeBtnText}>{posting ? 'Posting…' : 'Post'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments */}
      <Modal visible={!!commentsPost} animationType="slide" transparent onRequestClose={closeComments}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={[s.modalCard, { maxHeight: '75%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Comments</Text>
              <Pressable onPress={closeComments}><Ionicons name="close" size={22} color="#000" /></Pressable>
            </View>
            {loadingComments ? (
              <ActivityIndicator size="large" color="#000" style={{ marginVertical: 30 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={<Text style={s.emptyText}>No comments yet — be the first.</Text>}
                renderItem={({ item }) => (
                  <View style={s.commentRow}>
                    <View style={s.commentAvatar}><Text style={s.commentAvatarText}>{initials(item.authorName)}</Text></View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.commentAuthor}>{item.authorName}</Text>
                      <Text style={s.commentText}>{item.text}</Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={s.commentInputRow}>
              <TextInput
                value={commentText} onChangeText={setCommentText} placeholder="Add a comment..."
                placeholderTextColor="#999" style={s.commentInput}
              />
              <Pressable onPress={handleAddComment} disabled={!commentText.trim() || sendingComment} style={s.commentSendBtn}>
                <Ionicons name="send" size={16} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Post menu */}
      <Modal visible={!!postMenuFor} animationType="fade" transparent onRequestClose={() => setPostMenuFor(null)}>
        <Pressable style={s.menuOverlay} onPress={() => setPostMenuFor(null)}>
          <View style={s.menuCard}>
            <Pressable style={s.menuRow} onPress={() => openEdit(postMenuFor)}>
              <Ionicons name="create-outline" size={18} color="#000" />
              <Text style={s.menuRowText}>Edit</Text>
            </Pressable>
            <Pressable style={s.menuRow} onPress={() => handleDelete(postMenuFor)}>
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={[s.menuRowText, { color: '#DC2626' }]}>Delete</Text>
            </Pressable>
            <Pressable style={s.menuRow} onPress={() => handleToggleSetting(postMenuFor, 'likesHidden')}>
              <Ionicons name={postMenuFor?.likesHidden ? 'eye-outline' : 'eye-off-outline'} size={18} color="#000" />
              <Text style={s.menuRowText}>{postMenuFor?.likesHidden ? 'Show Like Count' : 'Hide Like Count'}</Text>
            </Pressable>
            <Pressable style={s.menuRow} onPress={() => handleToggleSetting(postMenuFor, 'shareCountHidden')}>
              <Ionicons name={postMenuFor?.shareCountHidden ? 'eye-outline' : 'eye-off-outline'} size={18} color="#000" />
              <Text style={s.menuRowText}>{postMenuFor?.shareCountHidden ? 'Show Share Count' : 'Hide Share Count'}</Text>
            </Pressable>
            <Pressable style={s.menuRow} onPress={() => handleToggleSetting(postMenuFor, 'commentsDisabled')}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#000" />
              <Text style={s.menuRowText}>{postMenuFor?.commentsDisabled ? 'Turn On Commenting' : 'Turn Off Commenting'}</Text>
            </Pressable>
            <Pressable style={[s.menuRow, { borderBottomWidth: 0 }]} onPress={() => openInsights(postMenuFor)}>
              <Ionicons name="stats-chart-outline" size={18} color="#000" />
              <Text style={s.menuRowText}>View Engagement Insights</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit post */}
      <Modal visible={!!editingPost} animationType="slide" transparent onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit post</Text>
              <Pressable onPress={() => setEditingPost(null)}><Ionicons name="close" size={22} color="#000" /></Pressable>
            </View>
            <TextInput
              value={editText} onChangeText={setEditText} placeholder="What's on your mind?"
              placeholderTextColor="#999" style={s.composerInput} multiline autoFocus
            />
            <Pressable style={[s.composeBtn, (!editText.trim() || savingEdit) && { opacity: 0.5 }]} onPress={handleSaveEdit} disabled={!editText.trim() || savingEdit}>
              <Text style={s.composeBtnText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Engagement insights */}
      <Modal visible={!!insightsPost} animationType="slide" transparent onRequestClose={() => setInsightsPost(null)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Engagement Insights</Text>
              <Pressable onPress={() => setInsightsPost(null)}><Ionicons name="close" size={22} color="#000" /></Pressable>
            </View>
            <View style={s.insightsRow}>
              <View style={s.insightsCell}>
                <Text style={s.insightsNum}>{insightsPost?.likeCount || 0}</Text>
                <Text style={s.insightsLabel}>Likes</Text>
              </View>
              <View style={s.insightsCell}>
                <Text style={s.insightsNum}>{insightsPost?.commentCount || 0}</Text>
                <Text style={s.insightsLabel}>Comments</Text>
              </View>
              <View style={s.insightsCell}>
                <Text style={s.insightsNum}>{insightsPost?.shareCount || 0}</Text>
                <Text style={s.insightsLabel}>Shares</Text>
              </View>
            </View>
            <Text style={s.insightsSub}>Posted {timeAgo(insightsPost?.createdAt)}</Text>
            {(insightsPost?.likesHidden || insightsPost?.shareCountHidden || insightsPost?.commentsDisabled) && (
              <Text style={s.insightsNote}>
                {[
                  insightsPost?.likesHidden && 'like count hidden from others',
                  insightsPost?.shareCountHidden && 'share count hidden from others',
                  insightsPost?.commentsDisabled && 'commenting off',
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Duel proposal */}
      <Modal visible={!!duelTarget} animationType="slide" transparent onRequestClose={() => setDuelTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Challenge {duelTarget?.name}</Text>
              <Pressable onPress={() => setDuelTarget(null)}><Ionicons name="close" size={22} color="#000" /></Pressable>
            </View>
            {DUEL_PRESETS.map((preset) => (
              <Pressable key={preset.key} style={s.presetRow} disabled={sendingDuel} onPress={() => handleProposeDuel(preset)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.presetLabel}>{preset.label}</Text>
                  <Text style={s.presetDesc}>{preset.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#999" />
              </Pressable>
            ))}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollPad: { paddingBottom: 100 },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16, marginTop: 8 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  headerGreet: { fontSize: 13, color: '#666' },
  headerDate: { fontSize: 15, fontWeight: '700', color: '#000', marginTop: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },

  emptyText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 24, paddingHorizontal: 20 },

  /* Tabs */
  tab: { backgroundColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  tabActive: { backgroundColor: '#000' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#333' },
  tabTextActive: { color: '#FFF' },

  /* Feed */
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 16, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#000' },
  peopleResults: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#F8F8F8', borderRadius: 14, padding: 12 },
  peopleResultsTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  peopleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  peopleAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
  peopleAvatarText: { fontSize: 11, fontWeight: '700', color: '#333' },
  peopleName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  composeBtn: { backgroundColor: '#000', borderRadius: 14, height: 48, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginBottom: 16 },
  composeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  feedCard: {
    backgroundColor: '#FFF', borderRadius: 16, marginHorizontal: 20, marginBottom: 14, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 }, default: {} }),
  },
  feedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  feedAvatarText: { fontSize: 12, fontWeight: '700', color: '#333' },
  feedUser: { fontSize: 14, fontWeight: '700', color: '#000' },
  feedTime: { fontSize: 11, color: '#999', marginTop: 1 },
  postMenuBtn: { padding: 6 },
  feedText: { fontSize: 14, color: '#000', lineHeight: 20, marginBottom: 10 },
  feedActionsRow: { flexDirection: 'row', gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  feedActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  feedActionText: { fontSize: 13, color: '#666' },

  /* Leaderboard */
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  leaderRowMe: { backgroundColor: '#F5F5F5', borderRadius: 12, marginHorizontal: 12, paddingHorizontal: 8 },
  leaderRank: { fontSize: 14, fontWeight: '700', color: '#000', width: 24 },
  leaderAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  leaderAvatarText: { fontSize: 11, fontWeight: '700', color: '#333' },
  leaderName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  leaderXp: { fontSize: 13, fontWeight: '700', color: '#000', marginRight: 8 },
  duelIconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },

  /* Duels */
  duelSectionTitle: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  duelCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 }, default: {} }),
  },
  duelTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 4 },
  duelSub: { fontSize: 13, color: '#666' },
  duelProgress: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 2 },
  duelDays: { fontSize: 12, color: '#999', marginTop: 6 },
  duelResult: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  duelBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  duelAcceptBtn: { flex: 1, backgroundColor: '#000', height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  duelAcceptBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  duelDeclineBtn: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#DC2626', height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  duelDeclineBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },

  /* Community groups */
  communityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  communityIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  communityName: { fontSize: 14, fontWeight: '700', color: '#000' },
  communityDesc: { fontSize: 12, color: '#666', marginTop: 1 },
  communityMembers: { fontSize: 11, color: '#999', marginTop: 2 },
  groupJoinBtn: { backgroundColor: '#000', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
  groupJoinBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  groupLeaveBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#DC2626' },
  groupLeaveBtnText: { color: '#DC2626' },

  /* Modals */
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  composerInput: { minHeight: 100, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 14, padding: 14, color: '#000', fontSize: 14, textAlignVertical: 'top' },
  presetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  presetLabel: { fontSize: 14, fontWeight: '700', color: '#000' },
  presetDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  commentRow: { flexDirection: 'row', paddingVertical: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { fontSize: 10, fontWeight: '700', color: '#333' },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#000' },
  commentText: { fontSize: 13, color: '#333', marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: '#000', fontSize: 14 },
  commentSendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  /* Post 3-dot menu */
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  menuCard: { backgroundColor: '#FFF', borderRadius: 16, width: 260, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  menuRowText: { fontSize: 14, fontWeight: '600', color: '#000' },

  /* Engagement insights */
  insightsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  insightsCell: { alignItems: 'center' },
  insightsNum: { fontSize: 22, fontWeight: '800', color: '#000' },
  insightsLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  insightsSub: { fontSize: 12, color: '#999', textAlign: 'center' },
  insightsNote: { fontSize: 11, color: '#AAA', textAlign: 'center', fontStyle: 'italic' },
});

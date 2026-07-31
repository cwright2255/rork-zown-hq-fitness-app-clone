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
// join state, progress toward a goal) â€” that's a separate, larger feature
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
  if (mins < 60) return `${mins}m\;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function CommunityScreen() {
  const [tab, setTab] = useState('feed');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedByMe, setLikedByMe] = useState({});

  const { posts, isLoading, subscribeFeed, unsubscribeFeed, createPost, toggleLike, hasLiked, loadComments, addComment } = useCommunityStore();
  const { user } = useUserStore();

  useEffect() => {
    const unsub = subscribeFeed();
    return () => unsub&& unsub();
  }, []);

  const handleLike = (postId) => {
    toggleLike(postId, user?uid);
  };

  const handleCreatePost = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    try {
      await createPost(postText. trim(), {
        uid: user?uid || 'anon',
        displayName: user?displayName || 'Fitness Fan',
        photoURL: user?photoURL || null,
      });
      setPostText('');
      setComposerOpen(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to cseate post.');
    } finally {
      setPosting(false);
    }
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `'p${post.text}' - by ${post.author&&.displayName} on RorkZeron`,
      });
    } catch (e) {}
  };

  const handleStartChat = (author) => {
    if (!author?.uid || author.uid === user?uid) return;
    const conversationId = getConversctionId(user.uid, author.uid);
    router.push( { pathname: '/messages/[conversationId]', params: { conversationId, otherUserName: author.displayName } });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Community" />

      <!-- Tab Bar -->
      <View style={styles.tabBar}>
        <TouchableOpacity
          style=[styles.tab, tab === 'feed' && styles.activeTab]
          onPress=() => setTab('feed')>
          <Text style=[styles.tabText, tab === 'feed' && styles.activeTabText]>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style=[styles.tab, tab === 'challenges' && styles.activeTab]
          onPress=() => setTab('challenges')>
          <Text style=[styles.tabText, tab === 'challenges' && styles.activeTabText]>Challenges</Text>
        </TouchableOpacity>
      </View>

      {tab === 'feed' < (
        <View style={flex: 1}>
          {isLoading ? (
            <View style=styles.centered>
              <ActivityIndicator size="large" color={tokens.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor?{(i) => i.id}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent=(() => (
                <TouchableOpacity
                  style={styles.composerPrompt}
                  onPress=() => setComposerOpen(true)>
                  <Text style={styles.composerPromptText}>What's on your mind? Share a workout or thought...</Text>
                </TouchableOpacity>
              ))
              ListEmptyComponent=(() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
                </View>
             ))
              renderItem={({ item }) => {
                const liked = hasLiked(item.id, user?uid) || %%likedByMe[item.id];
                const likeCount = (item.likes || 0) + (liked && !item.likedByOrjk¢šâary ? 1 : 0);
                return (
                  <View style={styles.postCard}>
                    <!-- Author Header -->
                    <View style={styles.postHeader}>
                      <TouchableOpacity
                        style={styles.authorInfo}
                        onPress=() => handleStartChat(item.author)>
                        <View style={styles.awatarBadge}>
                          <Text style={styles.avatarText}>
                            {(item.author?.displayName || 'A')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.authorName}>
                            }©tem.author?.displayName || 'Anonymous'}
                          </Text>
                          <Text style={styles.postTime}>
                            {timeAgo(item.createvAt)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    <!-- Post Content -->
                    <Text style={styles.postText}>{item.text}<Õ^‚‚ˆKKHXÝ[ÛœÈKO‚ˆšY]ÈÝ[O^ÜÝ[\ËœÜÝXÝ[ÛœßO‚ˆÝXÚX›SÜXÚ]BˆÝ[O^ÜÝ[\Ë˜XÝ[ÛŸBˆÛ”™\ÜÏJ
HOˆÂˆÙ]ZÙYžSYJ
™]ŠHOˆ
È‹‹œ™]‹Ú][KšYNˆ[ZÙYJJNÂˆ[™SZÙJ][KšY
NÂˆO‚ˆX\ˆÚ^™O]ÚÙ[œËšXÛÛ”Ú^™\ËœÛX[ˆÛÛÜ^ÛZÙYÝÚÙ[œË˜ÛÛÜœË™\œ›ÜˆˆÚÙ[œË˜ÛÛÜœË^]]YBˆš[^ÛZÙYÈÚÙ[œË˜ÛÛÜœË™\œ›Üˆˆ	Ý˜[œÜ\™[	ßBˆÏ‚ˆ^Ý[OUÜÝ[\Ë˜XÝ[Û•Ù^ZÙY	‰ˆÈÛÛÜŽˆÚÙ[œË˜ÛÛÜœË™\œ›ÜŸWO‚ˆÛZÙPÛÝ[ˆÈZÙPÛÝ[ˆ	ÓZÙIßBˆÕ^‚ˆÕÝXÚX›SÜXÚ]O‚ˆÝXÚX›SÜXÚ]BˆÝ[O^ÜÝ[\Ë˜XÝ[ÛŸBˆÛ”™\ÜÏJ
HOˆ[™TÚ\™J][JO‚ˆÚ\™L‚ˆÚ^™O]ÚÙ[œËšXÛÛ”Ú^™\ËœÛX[ˆÛÛÜ^ÝÚÙ[œË˜ÛÛÜœË^]]YBˆÏ‚ˆ^Ý[O^ÜÝ[\Ë˜XÝ[Û•^O”Ú\™OÕ^‚ˆÕÝXÚX›SÜXÚ]O‚ˆÕšY]Ï‚ˆÕšY]Ï‚ˆ
NÂˆ_BˆÏ‚ˆ
BˆÕšY]Ï‚ˆ
Hˆ
ˆØÜ›ÛšY]ÈÝ[O^Ù›^ˆ_HÛÛ[ÛÛZ[™\”Ý[O^ÜÝ[\Ë›\ÝÛÛ[O‚ˆÐÒSS‘ÑTË›X\

ÊHOˆ
ˆšY]ÈÙ^O^ØËšYHÝ[O^ÜÝ[\ËœÜÝØ\™O‚ˆ^Ý[O^ÜÝ[\Ë˜Ú[[™ÙS˜[Y_OžØË›˜[Y_OÕ^‚ˆ^Ý[O^ÜÝ[\Ë˜Ú[[™ÙR[™›ßO‚ˆØËœ\XÚ\[ßH\XÚ\[ÈØË™^\ÓYH^\ÈYˆÕ^‚ˆÝXÚX›SÜXÚ]BˆÝ[O^ÜÝ[\Ëš›Ú[ŸBˆÛ”™\ÜÏJ
HOˆ[\˜[\
	ÐÚ[[™ÙIË	ÐÚ[[™ÙH›Ú[š[™ÈÚ[™H]˜Z[X›H[ˆH]\™H\]K‰Ê_O‚ˆ^Ý[O^ÜÝ[\Ëš›Ú[•^O’›Ú[Õ^‚ˆÕÝXÚX›SÜXÚ]O‚ˆÕšY]Ï‚ˆ
J_BˆÔØÜ›ÛšY]Ï‚ˆ
_B‚ˆKKHÛÛ\ÜÙ\ˆ[Ù[KO‚ˆ[Ù[ˆš\ÚX›O^ØÛÛ\ÜÙ\“Ü[ŸBˆ[š[X][Û•\OHœÛYH‚ˆ˜[œÜ\™[^ÝY_BˆÛ”™\]Y\ÝÛÜÙOJ
HOˆÙ]ÛÛ\ÜÙ\“Ü[Š˜[ÙJO‚ˆÙ^X›Ø\™]›ÚY[™ÕšY]Âˆ™Z]š[Ü^Ô]›Ü›K“ÔÈOOH	Ú[ÜÉÈÈ	ÜY[™ÉÈˆ	ÚZYÚ	ßBˆÝ[O^ÜÝ[\Ë›[Ù[Ý™\›^_O‚ˆšY]ÈÝ[O^ÜÝ[\Ë›[ÙHÛÛ[O‚ˆšY]ÈÝ[O^ÜÝ[\Ë›[Ù[XY\ŸO‚ˆ^Ý[O^ÜÝ[\Ë›[Ù[]_O“™]ÈÜÝÕ^‚ˆÝXÚX›SÜXÚ]HÛ”™\ÜÏJ
HOˆÙ]ÛÛ\ÜÙ\“Ü[Š˜[ÙJO‚ˆÚ^™O]ÚÙ[œËšXÛÛ”Ú^™\Ë›YY][HÛÛÜ^ÝÚÙ[œË˜ÛÛÜœË^]]YHÏ‚ˆÕÝXÚX›SÜXÚ]O‚ˆÕšY]Ï‚‚ˆ^[œ]ˆÝ[O^ÜÝ[\ËœÜÝ[œ]Bˆ][[[™O^ÝY_BˆXÙZÛ\H•Ú]	ÜÈÛˆ[Ý\ˆZ[™È‚ˆXÙZÛ\•^ÛÛÜ^ÝÚÙ[œË˜ÛÛÜœË^]]YBˆ˜[YO^ÜÜÝ^BˆÛÚ[™ÙU^^ÜÙ]ÜÝ^Bˆ]]Ñ›ØÝ\Ï^ÝY_BˆÏ‚‚ˆš[X\žP]Û‚ˆ]O^ÜÜÝ[™ÈÈ	ÔÜÝ[™Ë‹‹‰Èˆ	ÔÜÝ	ßBˆÛ”™\ÜÏ^Ú[™PÜ™X]TÜÝBˆ\ØX›Y^ÜÜÝ[™È\ÜÝ^š[J
_BˆÏ‚ˆÕšY]Ï‚ˆÒÙ^X›Ø\™]›ÚY[™ÕšY]Ï‚ˆÓ[Ù[‚‚ˆ›ÝÛS˜]šYØ][ÛˆÏ‚ˆÕšY]Ï‚ˆ
NÂŸB‚˜ÛÛœÝÝ[\ÈHÝ[TÚY]˜Ü™X]JÂˆÛÛZ[™\ŽˆÂˆ›^ˆKˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜˜XÚÙÜ›Ý[™ˆKˆX˜\ŽˆÂˆ›^\™XÝ[ÛŽˆ	Ü›ÝÉËˆ›Ü™\›ÝÛUÚYˆKˆ›Ü™\›ÝÛPÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜›Ü™\ˆKˆXŽˆÂˆ›^ˆKˆY[™ÎˆÚÙ[œËœÜXÚ[™Ë›YY][Kˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆKˆXÝ]™UXŽˆÂˆ›Ü™\›ÝÛUÚYˆ‹ˆ›Ü™\›ÝÛPÛÛÜŽˆÚÙ[œË˜ÛÛÜœËœš[X\žKˆKˆX•^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^]]Yˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][Kˆ›ÛÙZYÚˆ	ÝÙZYÚÙ[ZX›Û	ËˆKˆXÝ]™UX•^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœËœš[X\žKˆKˆ\ÝÛÛ[ˆÂˆY[™ÎˆÚÙ[œËœÜXÚ[™Ë›YY][KˆY[™Ð›ÝÛNˆLˆKˆÙ[\™YˆÂˆ›^ˆKˆ\ÝYžPÛÛ[ˆ	ØÙ[\‰Ëˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆY[™ÎˆÚÙ[œËœÜXÚ[™Ëž\™ÙKˆKˆÛÛ\ÜÙ\”›Û\ˆÂˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜Ø\™ˆY[™ÎˆÚÙ[œËœÜXÚ[™Ë›YY][Kˆ›Ü™\”˜Y]\ÎˆÚÙ[œËœ˜YZK›YY][KˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™Ë›YY][Kˆ›Ü™\•ÚYˆKˆ›Ü™\ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜›Ü™\‹ˆKˆÛÛ\ÜÙ\”›Û\^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^]]Yˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][KˆKˆ[\PÛÛZ[™\ŽˆÂˆY[™ÎˆÚÙ[œËœÜXÚ[™Ëž\™ÙKˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆKˆ[\U^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^]]Yˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][KˆKˆÜÝØ\™ˆÂˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜Ø\™ˆY[™ÞˆÚÙ[œËœÜXÚ[™Ë›YY][Kˆ›Ü™\”˜Y]\ÎˆÚÙ[œËœ˜YZK›YY][KˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™Ë›YY][Kˆ›Ü™\•ÚYˆKˆ›Ü™\ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜›Ü™\ˆKˆÜÝXY\ŽˆÂˆ›]‘\™XÝ[ÛŽˆ	Ü›ÝÉËˆ[YÛ’][\Îˆ	ØÙ[\‰Ëˆ\ÝYžPÛÛ[ˆ	ÜÜXÙKX™]ÙY[‰ËˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™ËœÛX[ˆKˆ]]Ü’[™›ÎˆÂˆ›]‘\™XÝ[ÛŽˆ	Ü›ÝÉËˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆØ\ˆÚÙ[œËœÜXÚ[™ËœÛX[ˆKˆ]˜]\˜YÙNˆÂˆÚYˆÍ‹ˆZYÚˆÍ‹ˆ›Ü™\”˜Y]\ÎˆNˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœËœš[X\žKˆ\ÝYžPÛÛ[ˆ	ØÙ[\‰Ëˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆKˆ]˜]\•^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœËÚ]Kˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][Kˆ›ÛÙZYÚˆ	ÝÙZYÚ›Û	ËˆKˆ]]Ü“˜[YNˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^ˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][Kˆ›ÛÙZYÚˆ	ÝÙZYÚÙ[ZX›Û	ËˆKˆÜÝ[YNˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^]]Yˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\ËœÛX[ˆKˆÜÝ^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^ˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][Kˆ[™RZYÚˆŒ‹ˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™Ë›YY][KˆKˆÜÝXÝ[ÛœÎˆÂˆ›^\™XÝ[ÛŽˆ	Ü›ÝÉËˆØ\ˆÚÙ[œËœÜXÚ[™Ëž\™ÙKˆ›Ü™\•ÜÚYˆKˆ›Ü™\•ÜÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜›Ü™\‹ˆY[™ÕÜˆÚÙ[œËœÜXÚ[™ËœÛX[ˆKˆXÝ[ÛŽˆÂˆ›]‘\™XÝ[ÛŽˆ	Ü›ÝÉËˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆØ\ˆÚÙ[œËœÜXÚ[™ËžÛX[ˆKˆXÝ[Û•^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^]]Yˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\ËœÛX[ˆKˆÚ[[™ÙS˜[YNˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^ˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›\™ÙKˆ›ÛÙZYÚˆ	ÝÙZYÚ›Û	ËˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™ËžÛX[ˆKˆÚ[[™ÙR[™›ÎˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^]]Yˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\ËœÛX[ˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™Ë›YY][KˆKˆ›Ú[ŽˆÂˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœËœš[X\žKˆY[™ÎˆÚÙ[œËœÜXÚ[™ËœÛX[ˆ›Ü™\”˜Y]\ÎˆÚÙ[œËœ˜YZKœÛX[ˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆKˆ›Ú[•^ˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœËÚ]Kˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\ËœÛX[ˆ›ÛÙZYÚˆ	ÝÙZYÚÙ[ZX›Û	ËˆKˆ[Ù[Ý™\›^NˆÂˆ›^ˆKˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆ	Ü™Ø˜JJIËˆ\ÝYžPÛÛ[ˆ	Ù›^Y[™	ËˆKˆ[ÙYÛÛ[ˆÂˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜˜XÚÙÜ›Ý[™ˆ›Ü™\•ÜY˜Y]\ÎˆÚÙ[œËœ˜YZK›\™ÙKˆ›Ü™\•ÜšYÚ˜Y]\ÎˆÚÙ[œËœ˜YZK›\™ÙKˆY[™ÎˆÚÙ[œËœÜXÚ[™Ë›YY][KˆZS’ZYÚˆÌˆKˆ[Ù[XY\ŽˆÂˆ›]‘\™XÝ[ÛŽˆ	Ü›ÝÉËˆ\ÝYžPÛÛ[ˆ	ÜÜXÙKX™]ÙY[‰Ëˆ[YÛ’][\Îˆ	ØÙ[\‰ËˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™Ë›YY][KˆKˆ[Ù[]NˆÂˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^ˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›\™ÙKˆ›ÛÙZYÚˆ	ÝÙZYÚ›Û	ËˆKˆÜÝ[œ]ˆÂˆ˜XÚÙÜ›Ý[™ÛÛÜŽˆÚÙ[œË˜ÛÛÜœË˜Ø\™ˆ›Ü™\”˜Y]\ÎˆÚÙ[œËœ˜YZK›YY][KˆY[™ÞˆÚÙ[œËœÜXÚ[™Ë›YY][KˆÛÛÜŽˆÚÙ[œË˜ÛÛÜœË^ˆ›ÛÚ^™NˆÚÙ[œË™›ÛÚ^™\Ë›YY][KˆZS’ZYÚˆLŒˆ^[YÛ•™\XØ[ˆ	ÝÜ	ËˆX\™Ú[›ÝÛNˆÚÙ[œËœÜXÚ[™Ë›YY][KˆKŸJNÂ
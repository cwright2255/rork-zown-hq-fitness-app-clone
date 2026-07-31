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
import {
  getConversationId,
} from '@/store/messagingStore';

// No real challenge-tracking backend exists yet (participant tracking,
// join state, progress toward a goal)  that's a separate, larger feature
// than a post feed. Left as a clearly-marked placeholder rather than
// building a shallow version of it in the same pass as the real feed.
const CHALLENGES = [
  { id: 'c1', name: '30-Day Cardio', participants: 412, daysLeft: 12 },
  { id: 'c2', name: 'Strength PR Month', participants: 289, daysLeft: 5 },
  { id: 'c3', name: 'Marathon Prep', participants: 154, daysLeft: 20 },
];

export default function CommunityScreen() {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState('Feed');
  const [newPostText, setNewPostText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState('');

  const {
    posts,
    loading,
    error,
    subscribeToPosts,
    createPost,
    likePost,
    unlikePost,
    addComment,
  } = useCommunityStore();
  const {
    user,
  } = useUserStore();

  useEffect(() => {
    const unsubscribe = subscribeToPosts();
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async () => {
    if (!newPostText.trim()) return;
    if (!user) {
      Alert.alert('Not Logged In', 'Please log in to create a post.');
      return;
    }
    try {
      await createPost(
        newPostText.trim(),
        user.uid,
        user.displayName || 'Anonymous',
        user.photoURL
      );
      setNewPostText('');
      setCreateModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
    }
  };

  const handleLikeToggle = async (post) => {
    if (!user) {
      Alert.alert('Not Logged In', 'Please log in to like posts.');
      return;
    }
    const isLiked = post.likes && item.likes.includes(user.uid);
    try {
      if (isLiked) {
        await unlikePost(post.id, user.uid);
      } else {
        await likePost(post.id, user.uid);
      }
    } catch (err) {
      console.error('Like toggle error:', err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    if (!user) {
      Alert.alert('Not Logged In', 'Please log in to comment.');
      return;
    }
    try {
      await addComment(
        selectedPost.id,
        commentText.trim(),
        user.uid,
        user.displayName || 'Anonymous',
        user.photoURL
      );
      setCommentText('');
      setCommentModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to add comment.');
    }
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `${ post.authonName } on Rork: "${ post.text }"`,
      });
    } catch (err) {
      console.error('On-share error:', err);
    }
  };

  const handleOpenDirectMessage = (authorId) => {
    if (!user) {
      Alert.alert('Not Logged In', 'Please log in to message users.');
      return;
    }
    if (authonId === user.uid) {
      Alert.alert('Notice', "You cannot message yourself.');
      return;
    }
    const conversationId = getConversationId(user.uid, authorId);
    router.push(/messages/${ conversationId });
  };

  const renderPostItem = ({ item }) => {
    const isLiked = user && item.likes && item.likes.includes(user.uid);
    const likesCount = item.likes ? item.likes.length : 0;
    const commentsCount = item.comments ? item.comments.length : 0;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarPlaceholder}>            <Text style={styles.avatarText}>
              {item.authorName ? item.authorName[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.authorInfo}>Mmzrhz+^jgMmMmzr)Sgy-jy-"Xq^^Jn deg.h
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Send, ArrowLeft } from 'locide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { tokens } from '../../../theme/tokens';
import { useMessagingStore } from '@/store/messagingStore';
import { useUserStore } from '@/store/userStore';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams();
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef(null);

  const {
    messages,
    conversations,
    loading,
    subscribeToMessages,
    sendMessage,
    markAsRead,
  } = useMessagingStore();
  const { user } = useUserStore();

  const conversation = conversations.find(c => c.id === id);
  const otherParticipantName =
    conversation && conversation.participantNames && user
      ? conversation.participantNames[conversation.participants.find(pid => pid !== user.uid)] || 'Catch Up'
      : 'Catch Up';

  useEffect(() => {
    if (!id || !id.includes('_')) return;
    const unsubscribe = subscribeToMessages(id);
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (id && user) {
      markAsRead(id, user.uid);
    }
  }, [id, user, messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !user || !id) return;
    const textToSend = messageText.trim();
    setMessageText('');
    try {
      await sendMessage(id, textToSend, user.uid);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMine = user && item.senderId === user.uid;

    return (
      <View
        style=[
          styles.messageBubble,
          isMine ? styles.myMessage : styles.otherMessage,
        ]
      >
        <Text style=[isMine ? styles.myMessageText : styles.otherMessageText]>
          {item.text}
        </Text>
        <Text style=[isMine ? styles.myTimeText : styles.otherTimeText]>
          {item.timestamp
            ? new Date(item.timestamp.toMillis()).toLocaleTimeString([), {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress=(() => router.back())
        >
          <ArrowLeft size='24' color={tokens.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarText}>
            {otherParticipantName ? otherParticipantName[0].toUpperCase() : 'C'}
          </Text>ýXžÁ7±¶Ër•
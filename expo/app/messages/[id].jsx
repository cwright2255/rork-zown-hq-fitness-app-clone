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
import { Send, ArrowLeft } from 'lucide-react-native';
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
        style={[
          styles.messageBubble,
          isMine ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <Text style={[isMine ? styles.myMessageText : styles.otherMessageText]}>
          {item.text}
        </Text>
        <Text style={[isMine ? styles.myTimeText : styles.otherTimeText]}>
          {item.timestamp
            ? new Date(item.timestamp.toMillis()).toLocaleTimeString([], {
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
          </Text>
        </View>
        <Text style={styles.headerTitle}>{otherParticipantName}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id || String(item.createdAt)}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={tokens.colors.textSecondary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: tokens.colors.surface },
  backButton: { marginRight: 12 },
  avatarBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.colors.primary || '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: tokens.colors.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: tokens.colors.primary || '#000', borderBottomRightRadius: 4 },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: tokens.colors.surface, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 14, color: tokens.colors.text },
  myMessageText: { color: '#FFFFFF' },
  otherMessageText: { color: tokens.colors.text },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: tokens.colors.surface, backgroundColor: tokens.colors.background },
  textInput: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: tokens.colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: tokens.colors.text, marginRight: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.primary || '#000', justifyContent: 'center', alignItems: 'center' },
});

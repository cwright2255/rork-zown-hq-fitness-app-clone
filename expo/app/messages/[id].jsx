import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useMessagingStore, getConversationId } from '@/store/messagingStore';

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return '';
  return timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatScreen() {
  const { id, name, otherUid: otherUidParam, avatar } = useLocalSearchParams();
  const contactName = name || 'Chat';
  const conversationId = typeof id === 'string' ? id : '';
  const { user } = useUserStore();
  const { activeMessages, isLoadingMessages, subscribeMessages, unsubscribeMessages, sendMessage } = useMessagingStore();

  // Prefer the otherUid passed from the conversation list; fall back to
  // parsing it out of the deterministic conversation id (sortedUidA_sortedUidB)
  // for any navigation path that only has the id.
  const otherUid = typeof otherUidParam === 'string' && otherUidParam
    ? otherUidParam
    : conversationId.split('_').find((part) => part !== user?.uid) || '';

  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (conversationId) subscribeMessages(conversationId);
    return () => unsubscribeMessages();
  }, [conversationId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [activeMessages.length]);

  const handleSend = async () => {
    const text = msgText.trim();
    if (!text || !user?.uid || !otherUid) return;
    setMsgText('');
    setSending(true);
    try {
      await sendMessage({
        myUid: user.uid,
        myName: user.name,
        myAvatar: user.profileImage,
        otherUid,
        otherName: contactName,
        otherAvatar: typeof avatar === 'string' ? avatar : null,
        text,
      });
    } catch (e) {
      // real-time listener will simply not show the message; text stays
      // clearable so the user can just retry rather than losing input on
      // a network hiccup
      setMsgText(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (msg) => {
    const isMine = msg.senderId === user?.uid;
    return (
      <View key={msg.id} style={isMine ? s.sentRow : s.receivedRow}>
        {!isMine && <View style={s.receivedAvSmall}><Ionicons name="person" size={12} color="#999" /></View>}
        <View style={isMine ? s.sentBubble : s.receivedBubble}>
          <Text style={isMine ? s.sentText : s.receivedText}>{msg.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <View style={s.headerAvatar}><Ionicons name="person" size={20} color="#999" /></View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerName}>{contactName}</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={s.chatArea}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingMessages && activeMessages.length === 0 ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
          ) : activeMessages.length === 0 ? (
            <Text style={s.timestamp}>Say hello 👋</Text>
          ) : (
            activeMessages.map(renderMessage)
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.textInput}
            placeholder="Type message..."
            placeholderTextColor="#999"
            value={msgText}
            onChangeText={setMsgText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={s.sendBtn} onPress={handleSend} disabled={sending}>
            <Ionicons name="send" size={16} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#000' },
  headerStatus: { fontSize: 12, color: '#22C55E', marginTop: 1 },
  menuBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  /* Shared Workout */
  sharedWorkout: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 16, padding: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  sharedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* Chat */
  chatArea: { flex: 1 },
  timestamp: { textAlign: 'center', fontSize: 11, color: '#999', marginVertical: 16 },

  /* Sent */
  sentRow: { alignItems: 'flex-end', marginHorizontal: 16, marginBottom: 8 },
  sentBubble: { maxWidth: '75%', backgroundColor: '#FF8A9B', borderRadius: 20, borderBottomRightRadius: 4, padding: 14 },
  sentText: { fontSize: 15, color: '#FFF', lineHeight: 22 },

  /* Received */
  receivedRow: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 16, marginRight: 60, marginBottom: 8 },
  receivedAvSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  receivedBubble: { maxWidth: '85%', backgroundColor: '#F5F5F5', borderRadius: 20, borderBottomLeftRadius: 4, padding: 14 },
  receivedText: { fontSize: 15, color: '#000', lineHeight: 22 },

  /* Workout bubble */
  workoutBubble: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 12, maxWidth: '85%' },
  workoutRow: { flexDirection: 'row', alignItems: 'center' },
  workoutIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* Map bubble */
  mapBubble: { width: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  mapArea: { height: 140, backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center' },
  mapPin: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#FF8A9B', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* Input Bar */
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', backgroundColor: '#FFF' },
  textInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, marginHorizontal: 10, color: '#000' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing as spacing, Radius as radius } from '@/src/constants/tokens';
import { chatAI } from '@/services/aiService';
import { buildCoachSystemPrompt, getCoachHistory, saveCoachMessage } from '@/services/coachService';
import { useUserStore } from '@/store/userStore';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: "👋 Hey, I'm your ZOWN AI coach. This is our own space to talk through your training, form, nutrition, or anything else on your mind - I'll remember what we've talked about here.",
};

// Real, new: a dedicated, ongoing coach - distinct from
// app/profile/help.jsx's AI tab (a FAQ assistant, local-only history,
// no real user context). Loads real, persisted history from Firestore
// on mount (services/coachService.js) so returning here later shows the
// real, prior conversation, and every message includes a system prompt
// built from the user's own, real, stored goals/injuries/fitness level -
// not a generic chatbot persona.
export default function CoachScreen() {
  const { user } = useUserStore();
  const [chatHistory, setChatHistory] = useState([WELCOME_MESSAGE]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) {
        setIsLoadingHistory(false);
        return;
      }
      try {
        const history = await getCoachHistory(user.uid);
        if (!cancelled && history.length > 0) {
          setChatHistory(history);
        }
      } catch (e) {
        console.warn('[Coach] failed to load history:', e?.message);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const handleSend = async (textToSend) => {
    const text = textToSend || chatMessage;
    if (!text.trim() || isAiThinking) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim().slice(0, 500),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setChatMessage('');
    setIsAiThinking(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    if (user?.uid) {
      saveCoachMessage(user.uid, 'user', userMsg.content).catch((e) =>
        console.warn('[Coach] failed to save user message:', e?.message)
      );
    }

    try {
      const systemMsg = buildCoachSystemPrompt(user);
      const messagesPayload = [systemMsg]
        .concat(chatHistory.filter((m) => m.id !== 'welcome'))
        .concat(userMsg)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await chatAI(messagesPayload);

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };
      setChatHistory((prev) => [...prev, assistantMsg]);

      if (user?.uid) {
        saveCoachMessage(user.uid, 'assistant', assistantMsg.content).catch((e) =>
          console.warn('[Coach] failed to save assistant message:', e?.message)
        );
      }
    } catch (e) {
      console.error('[Coach] chatAI failed:', e?.message);
      setChatHistory((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Sorry, I couldn't respond just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsAiThinking(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </Pressable>
        <Text style={s.headerTitle}>AI Coach</Text>
        <View style={s.placeholder} />
      </View>

      {isLoadingHistory ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="small" color="#000000" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={s.tabContent}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={s.chatScroll}
            showsVerticalScrollIndicator={false}
          >
            {chatHistory.map((msg) => (
              <View
                key={msg.id}
                style={[s.chatBubbleContainer, msg.role === 'user' ? s.bubbleRight : s.bubbleLeft]}
              >
                {msg.role !== 'user' && (
                  <View style={s.avatarContainer}>
                    <Text style={s.avatarText}>Z</Text>
                  </View>
                )}
                <View style={[s.chatBubble, msg.role === 'user' ? s.chatBubbleUser : s.chatBubbleAssistant]}>
                  <Text style={[s.chatText, msg.role === 'user' ? s.chatTextUser : s.chatTextAssistant]}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}

            {isAiThinking && (
              <View style={[s.chatBubbleContainer, s.bubbleLeft]}>
                <View style={s.avatarContainer}>
                  <Text style={s.avatarText}>Z</Text>
                </View>
                <View style={[s.chatBubble, s.chatBubbleAssistant, s.typingBubble]}>
                  <ActivityIndicator size="small" color="#000000" />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={s.inputContainer}>
            <TextInput
              style={s.input}
              placeholder="Ask your coach anything..."
              placeholderTextColor="#666666"
              value={chatMessage}
              onChangeText={setChatMessage}
              maxLength={500}
              multiline
            />
            <Pressable
              style={[s.sendCircle, (!chatMessage.trim() || isAiThinking) && s.sendCircleDisabled]}
              onPress={() => handleSend()}
              disabled={!chatMessage.trim() || isAiThinking}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: { padding: spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000000' },
  placeholder: { width: 32 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabContent: { flex: 1 },
  chatScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  chatBubbleContainer: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-end' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  chatBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  chatBubbleUser: { backgroundColor: '#000000', borderBottomRightRadius: 2 },
  chatBubbleAssistant: { backgroundColor: '#F5F5F5', borderBottomLeftRadius: 2 },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  chatText: { fontSize: 14, lineHeight: 18 },
  chatTextUser: { color: '#FFFFFF' },
  chatTextAssistant: { color: '#000000' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 100,
    color: '#000000',
    fontSize: 14,
    marginRight: spacing.sm,
  },
  sendCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleDisabled: { backgroundColor: '#CCCCCC' },
});

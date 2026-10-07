import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing as spacing, Radius as radius } from '@/src/constants/tokens';
import { chatAI } from '@/services/aiService';
import {
  extractCoachAction, normalizeActions, describeActions, buildQuestion, endsWithQuestion, classifyReply,
} from '@/lib/coachActions';
import { executeCoachActions } from '@/services/coachActionService';
import { loadSnapshotSources, buildSnapshotFromStores } from '@/services/coachSnapshotService';
import {
  buildCoachSystemPrompt, getCoachHistory, saveCoachMessage,
  summarizeLiftPRs, summarizeCardioVolume, buildUserDataContext,
} from '@/services/coachService';
import { useUserStore } from '@/store/userStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { PRIMARY_LIFT_MUSCLES } from '@/lib/crossDomainInsights';
import { aggregateDailyLoad, calculateTrainingLoad } from '@/lib/trainingLoad';

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
  const { completedWorkouts, loadWorkouts, getExerciseHistory } = useWorkoutStore();
  const { runs, loadRuns } = useRunningStore();
  const { completedHikes, loadCompletedHikes } = useHikingStore();
  const [chatHistory, setChatHistory] = useState([WELCOME_MESSAGE]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  // null until the one-time load below finishes, so the model is never told
  // "here is the user's data" before there is any.
  const [liftPRs, setLiftPRs] = useState(null);
  const scrollViewRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Always-current copy of the chat for the async handlers below, so a
  // reply that finishes later never works from an out-of-date list.
  const chatRef = useRef(chatHistory);
  chatRef.current = chatHistory;

  // The input bar sits above the home indicator when the keyboard is down
  // (it used to sit right on the screen edge), and snug against the
  // keyboard when it is up.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardOpen(true);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  // Real, new: this is what actually lets the coach cite real numbers
  // instead of only ever giving generic encouragement - a compact,
  // honest summary of the user's actual logged lifts/runs/hikes, built
  // fresh into every message below (services/coachService.js). Loads
  // the three stores' own data directly (same loader calls app/health.jsx
  // already makes) since there's no shared cache between screens, then
  // fetches each primary lift's real set-by-set history the same way
  // lib/crossDomainInsights.js's plateau detection already does.
  // One-time load per user. Deliberately depends ONLY on user?.uid: the
  // store loaders below replace runs/completedHikes/completedWorkouts with
  // brand-new arrays when they finish, so an effect that both called them
  // AND listed that data as a dependency re-triggered itself forever (a
  // continuous reload loop that froze and crashed the screen). The derived
  // numbers are computed in the useMemo below instead, which re-runs on
  // data changes without re-fetching anything.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadWorkouts(user.uid), loadRuns(user.uid), loadCompletedHikes(user.uid), loadSnapshotSources(user.uid)]);
        if (cancelled) return;

        const liftNames = Object.keys(PRIMARY_LIFT_MUSCLES);
        const histories = await Promise.all(
          liftNames.map((name) => getExerciseHistory(name, user.uid))
        );
        if (cancelled) return;

        const historiesByLift = {};
        liftNames.forEach((name, i) => { historiesByLift[name] = histories[i]; });
        setLiftPRs(summarizeLiftPRs(historiesByLift));
      } catch (e) {
        console.warn('[Coach] failed to load training data context:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const dataContext = useMemo(() => {
    if (liftPRs === null) return null;
    try {
      const workouts = completedWorkouts || [];
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const monthlyWorkoutCount = workouts.filter((w) => {
        const d = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        return !Number.isNaN(d.getTime()) && d.getTime() >= thirtyDaysAgo;
      }).length;
      return {
        liftPRs,
        cardioVolume: summarizeCardioVolume({ runs: runs || [], completedHikes: completedHikes || [], days: 7 }),
        monthlyWorkoutCount,
        trainingLoad: calculateTrainingLoad(
          aggregateDailyLoad({ completedWorkouts: workouts, runs: runs || [], completedHikes: completedHikes || [] })
        ),
      };
    } catch (e) {
      // A problem summarizing the data must never take down the chat; the
      // coach just answers without the data context.
      console.warn('[Coach] failed to build data context:', e?.message);
      return null;
    }
  }, [liftPRs, runs, completedHikes, completedWorkouts]);

  // ---- Chat helpers -------------------------------------------------------

  const scrollToEndSoon = () => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

  const appendMessage = (role, content, extra = {}) => {
    const msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content, ...extra };
    setChatHistory((prev) => [...prev, msg]);
    if (user?.uid) {
      saveCoachMessage(user.uid, role, content).catch((e) =>
        console.warn('[Coach] failed to save message:', e?.message)
      );
    }
    scrollToEndSoon();
    return msg;
  };

  const updateAction = (messageId, patch) => {
    setChatHistory((prev) =>
      prev.map((m) => (m.id === messageId && m.action ? { ...m, action: { ...m.action, ...patch } } : m))
    );
  };

  // The newest proposal still waiting for a Yes / No.
  const findPending = () => [...chatRef.current].reverse().find((m) => m.action?.status === 'pending') || null;

  // The coach only ever PROPOSES. Nothing is created until the user taps
  // Yes (or types a plain "yes"), and the result is reported back in chat.
  const confirmAction = async (messageId) => {
    const msg = chatRef.current.find((m) => m.id === messageId);
    if (!msg || msg.action?.status !== 'pending') return;
    updateAction(messageId, { status: 'running' });
    try {
      const result = await executeCoachActions(msg.action.actions, user);
      const allFailed = result.failures.length >= msg.action.actions.length;
      updateAction(messageId, allFailed ? { status: 'pending' } : { status: 'done', links: result.links });
      appendMessage('assistant', result.message);
    } catch (e) {
      console.warn('[Coach] action failed:', e?.message);
      updateAction(messageId, { status: 'pending' });
      appendMessage('assistant', "Sorry, I couldn't save that. Nothing was changed - please try again.");
    }
  };

  const declineAction = (messageId) => {
    const msg = chatRef.current.find((m) => m.id === messageId);
    if (!msg || msg.action?.status !== 'pending') return;
    updateAction(messageId, { status: 'declined' });
    appendMessage('assistant', "No problem - I haven't added anything. Tell me what you'd like changed and I'll adjust it.");
  };

  const handleSend = async (textToSend) => {
    const text = textToSend || chatMessage;
    if (!text.trim() || isAiThinking) return;

    // A short typed "yes" / "no" answers the open proposal, same as the buttons.
    const pending = findPending();
    const verdict = pending ? classifyReply(text) : null;
    if (pending && verdict) {
      setChatMessage('');
      appendMessage('user', text.trim().slice(0, 500));
      if (verdict === 'yes') await confirmAction(pending.id);
      else declineAction(pending.id);
      return;
    }

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim().slice(0, 500),
    };

    // Snapshot of the conversation BEFORE this message, for the model.
    const historyForModel = chatRef.current.filter((m) => m.id !== 'welcome');

    // Anything else typed means the old proposal is being changed or
    // dropped; its buttons go away so a stale one can't be tapped later.
    setChatHistory((prev) => [
      ...prev.map((m) => (m.action?.status === 'pending' ? { ...m, action: { ...m.action, status: 'superseded' } } : m)),
      userMsg,
    ]);
    setChatMessage('');
    setIsAiThinking(true);
    scrollToEndSoon();

    if (user?.uid) {
      saveCoachMessage(user.uid, 'user', userMsg.content).catch((e) =>
        console.warn('[Coach] failed to save user message:', e?.message)
      );
    }

    try {
      const systemMsg = buildCoachSystemPrompt(user);
      // Real, new: rebuilt fresh on every send, same as systemMsg itself -
      // reflects whatever's actually been loaded so far rather than a
      // stale snapshot from when the screen first mounted. Omitted
      // entirely (not sent as an empty/placeholder message) until the
      // real fetch above finishes, so the model is never told "here is
      // the user's data" with nothing actually in it yet.
      const dataMsg = dataContext ? buildUserDataContext(dataContext) : null;
      // Profile, weight trend, goals, nutrition and calendar, read fresh.
      let snapshotMsg = null;
      try { snapshotMsg = buildSnapshotFromStores(user); } catch (e) { console.warn('[Coach] snapshot skipped:', e?.message); }
      const messagesPayload = [systemMsg]
        .concat(snapshotMsg ? [snapshotMsg] : [])
        .concat(dataMsg ? [dataMsg] : [])
        .concat(historyForModel)
        .concat(userMsg)
        .map((m) => ({ role: m.role, content: m.content }));

      // Longer timeout than a plain chat reply: a full plan with its
      // action block is a much bigger answer.
      const response = await chatAI(messagesPayload, 45000);

      // Pull the machine-readable block out so raw JSON is never shown,
      // validate it, and attach it as a Yes / No proposal.
      const { text: replyText, actions: rawActions } = extractCoachAction(response);
      let proposal = null;
      if (rawActions) {
        const { actions } = normalizeActions(rawActions, { user });
        const lines = describeActions(actions);
        if (actions.length > 0 && lines.length > 0) proposal = { status: 'pending', actions, lines, links: [] };
      }

      let content = replyText;
      if (proposal) {
        if (!content) content = "Here's what I put together.";
        if (!endsWithQuestion(content)) content = `${content}\n\n${buildQuestion(proposal.actions)}`;
      } else if (!content) {
        content = "I couldn't put that together cleanly. Tell me the days and times you'd like and I'll try again.";
      }

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        ...(proposal ? { action: proposal } : {}),
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
      scrollToEndSoon();
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
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={s.chatScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
                <View
                  style={[
                    s.chatBubble,
                    msg.role === 'user' ? s.chatBubbleUser : s.chatBubbleAssistant,
                    msg.action && s.chatBubbleWide,
                  ]}
                >
                  <Text style={[s.chatText, msg.role === 'user' ? s.chatTextUser : s.chatTextAssistant]}>
                    {msg.content}
                  </Text>

                  {msg.action && (
                    <View style={s.actionCard}>
                      {msg.action.lines.map((line, i) => (
                        <Text key={i} style={s.actionLine}>{`• ${line}`}</Text>
                      ))}

                      {msg.action.status === 'pending' && (
                        <View style={s.actionButtons}>
                          <Pressable style={s.yesButton} onPress={() => confirmAction(msg.id)}>
                            <Text style={s.yesButtonText}>Yes, do it</Text>
                          </Pressable>
                          <Pressable style={s.noButton} onPress={() => declineAction(msg.id)}>
                            <Text style={s.noButtonText}>No thanks</Text>
                          </Pressable>
                        </View>
                      )}

                      {msg.action.status === 'running' && (
                        <View style={s.actionStatusRow}>
                          <ActivityIndicator size="small" color="#000000" />
                          <Text style={s.actionStatusText}>Adding it now...</Text>
                        </View>
                      )}

                      {msg.action.status === 'done' && (msg.action.links || []).map((link) => (
                        <Pressable key={link.route} onPress={() => router.push(link.route)} style={s.actionLinkRow}>
                          <Text style={s.actionLink}>{`${link.label} ›`}</Text>
                        </Pressable>
                      ))}

                      {msg.action.status === 'declined' && <Text style={s.actionStatusText}>Not added</Text>}
                      {msg.action.status === 'superseded' && <Text style={s.actionStatusText}>Replaced by a newer message</Text>}
                    </View>
                  )}
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

          <View style={[s.inputContainer, { paddingBottom: keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.sm) }]}>
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
  chatBubbleWide: { maxWidth: '88%' },
  actionCard: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionLine: { fontSize: 13, lineHeight: 18, color: '#000000', marginBottom: 4 },
  actionButtons: { flexDirection: 'row', marginTop: spacing.sm },
  yesButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: radius.xl,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  yesButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  noButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    paddingVertical: 10,
    alignItems: 'center',
  },
  noButtonText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  actionStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  actionStatusText: { fontSize: 12, color: '#666666', marginLeft: spacing.xs, marginTop: 2 },
  actionLinkRow: { marginTop: spacing.xs, paddingVertical: 4 },
  actionLink: { fontSize: 14, fontWeight: '700', color: '#000000' },
});

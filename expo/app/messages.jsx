import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Platform, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useMessagingStore, getConversationId } from '@/store/messagingStore';
import { useLeaderboardStore } from '@/store/leaderboardStore';

function formatTime(timestamp) {
  if (!timestamp?.toDate) return '';
  const diffMs = Date.now() - timestamp.toDate().getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function MessagesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { user } = useUserStore();
  const { conversations, isLoadingConversations, subscribeConversations, unsubscribeConversations } = useMessagingStore();

  // Real, already-available list of other real users — the same source
  // app/social.jsx's Duel challenge picker uses. There's no user-search
  // feature anywhere in this app yet, so this is the honest option: pick
  // from people who are actually on the leaderboard, not a fabricated
  // contacts list.
  const { entries, loadTop } = useLeaderboardStore();

  useEffect(() => {
    if (user?.uid) subscribeConversations(user.uid);
    return () => unsubscribeConversations();
  }, [user?.uid]);

  useEffect(() => {
    if (pickerOpen && entries.length === 0) loadTop(50);
  }, [pickerOpen]);

  const onRefresh = async () => {
    // The conversation list is a live subscription (see useEffect above),
    // not a one-time fetch — pull-to-refresh here is mostly a reassurance
    // gesture rather than something that needs to re-query anything.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const startConversation = (person) => {
    setPickerOpen(false);
    // Reuses the exact same real, already-working flow as opening an
    // existing conversation — no separate "new conversation" backend
    // path needed. app/messages/[id].jsx already handles a conversation
    // that doesn't exist yet (shows "Say hello 👋"); sendMessage creates
    // the real document on first send.
    router.push({
      pathname: '/messages/[id]',
      params: { id: getConversationId(user?.uid, person.id), name: person.name, otherUid: person.id, avatar: person.avatar || '' },
    });
  };

  const pickablePeople = entries.filter((e) => e.id !== user?.uid);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </Pressable>
        <Text style={s.headerTitle}>Messages</Text>
        <Pressable onPress={() => setPickerOpen(true)} style={s.menuBtn}>
          <Ionicons name="add" size={26} color="#000" />
        </Pressable>
      </View>

      <ScrollView style={s.scrollContainer} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        } contentContainerStyle={s.scrollContent}>

        <View style={s.convList}>
          {isLoadingConversations && conversations.length === 0 ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
          ) : conversations.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={40} color="#CCC" />
              <Text style={{ color: '#999', marginTop: 12, textAlign: 'center' }}>
                No conversations yet. Tap + to start one.
              </Text>
            </View>
          ) : (
            conversations.map(c => (
              <Pressable
                key={c.id}
                style={s.convRow}
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: c.id, name: c.name, otherUid: c.otherUid, avatar: c.avatar || '' } })}
              >
                <View style={s.convAvatar}>
                  <Text style={{ color: '#666', fontWeight: '700' }}>{initials(c.name)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.convName}>{c.name}</Text>
                  <Text style={s.convMsg} numberOfLines={1}>
                    {c.lastMessage?.senderId === user?.uid ? 'You: ' : ''}{c.lastMessage?.text || 'Say hello 👋'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.convTime}>{formatTime(c.lastMessage?.createdAt || c.updatedAt)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

      </ScrollView>

      {/* New message picker */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Message</Text>
              <Pressable onPress={() => setPickerOpen(false)}><Ionicons name="close" size={22} color="#000" /></Pressable>
            </View>
            {pickablePeople.length === 0 ? (
              <Text style={s.emptyText}>No one on the leaderboard yet to message.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {pickablePeople.map((p) => (
                  <Pressable key={p.id} style={s.pickerRow} onPress={() => startConversation(p)}>
                    <View style={s.pickerAvatar}><Text style={s.pickerAvatarText}>{initials(p.name)}</Text></View>
                    <Text style={s.pickerName}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#000' },
  menuBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  /* Search */
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 12 },
  searchText: { flex: 1, fontSize: 14, color: '#999', marginLeft: 8 },

  /* Vertical scroll container */
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  /* Stories */
  storiesRow: { height: 96 },
  storiesContent: { paddingLeft: 20, paddingRight: 6, paddingBottom: 12 },
  storyAdd: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFB5B5', justifyContent: 'center', alignItems: 'center' },
  storyRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  storyInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  storyName: { fontSize: 10, color: '#333', marginTop: 4, textAlign: 'center' },

  /* Conversations */
  convList: {},
  convRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  convAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  convName: { fontSize: 15, fontWeight: '600', color: '#000' },
  convMsg: { fontSize: 13, color: '#999', marginTop: 2 },
  convTime: { fontSize: 11, color: '#999' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000', marginTop: 4 },

  /* Input bar */
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', backgroundColor: '#FFF' },
  inputIcon: { padding: 6 },
  inputField: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 8 },
  inputPlaceholder: { fontSize: 14, color: '#999' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* New message picker modal */
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  emptyText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 24 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  pickerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  pickerAvatarText: { fontSize: 12, fontWeight: '700', color: '#333' },
  pickerName: { fontSize: 14, fontWeight: '600', color: '#000' },
});

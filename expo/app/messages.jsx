import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';
import { useMessagingStore } from '@/store/messagingStore';
import { useUserStore } from '@/store/userStore';

export default function MessagesScreen() {
  const {
    conversations,
    loading,
    error,
    subscribeToConversations,
  } = useMessagingStore();
  const {
    user,
  } = useUserStore();

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToConversations(user.uid);
    return () => unsubscribe();
  }, [user]);

  const handleOpenConversation = (conversationId) => {
    router.push(`/messages/${conversationId}`);
  };

  const renderConversationItem = ({ item }) => {
    const otherParticipantName =
      item.participantNames && user
        ? item.participantNames[item.participants.find(id => id !== user.uid)] || 'Anonymous'
        : 'Anonymous';

    const hasUnread =
      item.unreadBy && user && item.unreadBy.includes(user.uid);

    return (
      <TouchableOpacity
        style={[styles.itemCard, hasUnread && styles.unreadCard]}
        onPress={() => handleOpenConversation(item.id)}
      >
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarText}>
            {otherParticipantName ? otherParticipantName[0].toUpperCase() : 'A'}
          </Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{otherParticipantName}</Text>
          <Text style={styles.lastMessageText} numberOfLines={1}>
            {item.lastMessageText || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Messages" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
        <BottomNavigation />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Messages" />
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={48} color={tokens.colors.textSecondary} />
              <Text style={styles.emptyText}>No conversations yet.</Text>
            </View>
          }
        />
      )}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.surface, borderRadius: 12, padding: 16, marginBottom: 8 },
  unreadCard: { borderWidth: 1, borderColor: tokens.colors.primary },
  avatarBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colors.primary || '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  infoContainer: { flex: 1 },
  nameText: { fontSize: 14, fontWeight: '600', color: tokens.colors.text },
  lastMessageText: { fontSize: 12, color: tokens.colors.textSecondary, marginTop: 2 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: tokens.colors.error || 'red' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: tokens.colors.textSecondary, marginTop: 12, fontSize: 14 },
});

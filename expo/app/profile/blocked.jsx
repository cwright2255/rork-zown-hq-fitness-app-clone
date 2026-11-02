// app/profile/blocked.jsx
//
// Settings, then Blocked people: everyone this person has blocked (store/blockStore.js), each with an Unblock button. Blocking is done from
// the three-dot menu on a post, comment or message; this is where it is undone.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useBlockStore } from '@/store/blockStore';

const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function BlockedPeopleScreen() {
  const { user } = useUserStore();
  const blocked = useBlockStore((s) => s.blocked);
  const isLoaded = useBlockStore((s) => s.isLoaded);
  const error = useBlockStore((s) => s.error);
  const subscribeBlocks = useBlockStore((s) => s.subscribeBlocks);
  const unblockUser = useBlockStore((s) => s.unblockUser);

  useEffect(() => {
    if (user?.uid) subscribeBlocks(user.uid);
  }, [user?.uid]);

  const people = Object.values(blocked).sort((a, b) => (b.blockedAt || '').localeCompare(a.blockedAt || ''));

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile/settings');
  };

  const confirmUnblock = (person) => {
    Alert.alert(
      `Unblock ${person.name}?`,
      'You will see their posts and comments again, and the two of you can message each other.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            const done = await unblockUser({ myUid: user?.uid, uid: person.uid });
            if (!done) Alert.alert("Couldn't unblock", 'Check your connection and try again.');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable style={s.backButton} onPress={handleBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text style={s.headerTitle}>Blocked people</Text>
        <View style={s.placeholder} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          You don't see posts or comments from people you block, and neither of you can message the other. They are not told.
        </Text>

        {!isLoaded && people.length === 0 && !error ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 30 }} />
        ) : people.length === 0 ? (
          <Text style={s.empty}>
            {error
              ? "Couldn't load your blocked people. Check your connection and try again."
              : "You haven't blocked anyone. To block someone, tap the three dots on their post, comment or message."}
          </Text>
        ) : (
          people.map((person) => (
            <View key={person.uid} style={s.row}>
              <View style={s.avatar}><Text style={s.avatarText}>{initials(person.name)}</Text></View>
              <Text style={s.name} numberOfLines={1}>{person.name}</Text>
              <Pressable
                style={s.unblockBtn}
                testID={`unblock-${person.uid}`}
                accessibilityLabel={`Unblock ${person.name}`}
                onPress={() => confirmUnblock(person)}
              >
                <Text style={s.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  placeholder: { width: 40 },
  content: { padding: 20 },
  intro: { fontSize: 14, lineHeight: 20, color: '#666666', marginBottom: 16 },
  empty: { fontSize: 14, color: '#999999', textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#333' },
  name: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#000' },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#000' },
  unblockText: { fontSize: 13, fontWeight: '700', color: '#000' },
});

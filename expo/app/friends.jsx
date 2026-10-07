// app/friends.jsx
//
// Manage who you follow and who your Close Friends are. Close Friends is a
// private list - only you see it - used by the Close Friends filter on the
// Leaderboard, Challenges and Duels. Find people by name among the ranked
// users on the leaderboard (the only public list of people in the app).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PersonSheet from '@/components/PersonSheet';
import { useUserStore } from '@/store/userStore';
import { useSocialGraphStore } from '@/store/socialGraphStore';
import { useLeaderboardStore } from '@/store/leaderboardStore';

function Row({ person, onPress, onStar, starred, subtitle }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(person.name || '?').slice(0, 1).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      {!!onStar && (
        <Pressable onPress={onStar} hitSlop={10} accessibilityLabel={starred ? 'Remove from Close Friends' : 'Add to Close Friends'}>
          <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color="#16A34A" />
        </Pressable>
      )}
    </Pressable>
  );
}

export default function FriendsScreen() {
  const { user } = useUserStore();
  const following = useSocialGraphStore((s) => s.following);
  const isLoading = useSocialGraphStore((s) => s.isLoading);
  const loadFollowing = useSocialGraphStore((s) => s.loadFollowing);
  const updateRelationship = useSocialGraphStore((s) => s.updateRelationship);
  const { entries, loadTop } = useLeaderboardStore();
  const [search, setSearch] = useState('');
  const [sheetPerson, setSheetPerson] = useState(null);

  useEffect(() => {
    if (user?.uid) loadFollowing(user.uid);
    loadTop(100);
  }, [user?.uid]);

  const close = useMemo(() => following.filter((f) => f.close).sort((a, b) => a.name.localeCompare(b.name)), [following]);
  const others = useMemo(() => following.filter((f) => !f.close).sort((a, b) => a.name.localeCompare(b.name)), [following]);

  const query = search.trim().toLowerCase();
  const results = query
    ? entries
        .filter((e) => e.id !== user?.uid && (e.name || '').toLowerCase().includes(query))
        .slice(0, 10)
    : [];

  const toggleStar = (f) => updateRelationship(user?.uid, f, f.close ? 'removeClose' : 'addClose');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Friends" showBack />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Find people by name"
            placeholderTextColor="#999"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#CCC" /></Pressable>
          )}
        </View>

        {!!query && (
          <View style={{ marginBottom: 16 }}>
            {results.length === 0 ? (
              <Text style={styles.empty}>No one with that name on the leaderboard yet.</Text>
            ) : (
              results.map((e) => (
                <Row
                  key={e.id}
                  person={{ name: e.name }}
                  subtitle={following.some((f) => f.uid === e.id) ? 'Following' : null}
                  onPress={() => setSheetPerson({ uid: e.id, name: e.name, avatar: e.avatar })}
                />
              ))
            )}
          </View>
        )}

        <Text style={styles.section}>Close Friends ({close.length})</Text>
        {close.length === 0 ? (
          <Text style={styles.empty}>Tap the star next to someone you follow to add them. Only you can see this list.</Text>
        ) : (
          close.map((f) => (
            <Row key={f.uid} person={f} starred onStar={() => toggleStar(f)}
              onPress={() => setSheetPerson({ uid: f.uid, name: f.name, avatar: f.avatar })} />
          ))
        )}

        <Text style={styles.section}>Following ({others.length})</Text>
        {isLoading && following.length === 0 ? (
          <ActivityIndicator color="#000" style={{ marginTop: 12 }} />
        ) : others.length === 0 ? (
          <Text style={styles.empty}>
            {following.length === 0
              ? 'You are not following anyone yet. Search above, or tap a person on the Leaderboard.'
              : 'Everyone you follow is a close friend.'}
          </Text>
        ) : (
          others.map((f) => (
            <Row key={f.uid} person={f} starred={false} onStar={() => toggleStar(f)}
              onPress={() => setSheetPerson({ uid: f.uid, name: f.name, avatar: f.avatar })} />
          ))
        )}
      </ScrollView>
      <PersonSheet person={sheetPerson} onClose={() => setSheetPerson(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0F0F0', borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#000' },
  section: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  empty: { fontSize: 13, color: '#999', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  name: { fontSize: 15, fontWeight: '600', color: '#000' },
  sub: { fontSize: 12, color: '#888', marginTop: 2 },
});

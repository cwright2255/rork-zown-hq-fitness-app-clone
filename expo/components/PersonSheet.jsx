// components/PersonSheet.jsx
//
// Bottom sheet with what you can do with another person: follow / unfollow,
// add to / remove from Close Friends, and (when the screen supports it)
// challenge them to a duel. Close Friends are always people you follow, so
// starring someone also follows them.
import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocialGraphStore } from '../store/socialGraphStore';
import { useUserStore } from '../store/userStore';

export default function PersonSheet({ person, onClose, onDuel }) {
  const { user } = useUserStore();
  const following = useSocialGraphStore((s) => s.following);
  const updateRelationship = useSocialGraphStore((s) => s.updateRelationship);

  const record = person ? following.find((f) => f.uid === person.uid) : null;
  const isFollowing = !!record;
  const isClose = !!record?.close;

  const run = async (action) => {
    if (!person || !user?.uid) return;
    await updateRelationship(user.uid, person, action);
  };

  return (
    <Modal visible={!!person} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(person?.name || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{person?.name}</Text>
            <Text style={styles.sub}>
              {isClose ? 'Close friend' : isFollowing ? 'You follow them' : 'Not following'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color="#000" /></Pressable>
        </View>

        <Pressable style={styles.row} onPress={() => run(isFollowing ? 'unfollow' : 'follow')}>
          <Ionicons name={isFollowing ? 'person-remove-outline' : 'person-add-outline'} size={20} color="#000" />
          <Text style={styles.rowText}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => run(isClose ? 'removeClose' : 'addClose')}>
          <Ionicons name={isClose ? 'star' : 'star-outline'} size={20} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{isClose ? 'Remove from Close Friends' : 'Add to Close Friends'}</Text>
            <Text style={styles.rowHint}>Only you can see your Close Friends list.</Text>
          </View>
        </Pressable>

        {!!onDuel && (
          <Pressable style={styles.row} onPress={() => { const target = person; onClose(); setTimeout(() => onDuel(target), 400); }}>
            <Ionicons name="flash-outline" size={20} color="#000" />
            <Text style={styles.rowText}>Challenge to a duel</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  name: { fontSize: 17, fontWeight: '700', color: '#000' },
  sub: { fontSize: 12, color: '#888', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5' },
  rowText: { fontSize: 15, fontWeight: '600', color: '#000' },
  rowHint: { fontSize: 12, color: '#999', marginTop: 2 },
});

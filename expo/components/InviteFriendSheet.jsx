import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useSocialGraphStore } from '@/store/socialGraphStore';
import { useCalendarInviteStore } from '@/store/calendarInviteStore';
import { activeInviteFor, canInviteTo, describeInviteWhen, inviteStatusLabel } from '@/lib/calendarInvites';
import { sanitizeEvent } from '@/lib/calendarEvents';

// The sheet for inviting someone to one of the person's own calendar events: the people they follow, close friends first, each with an
// Invite button, or "Waiting" / "Going" when they have already been asked. The person invited gets a copy of the event to accept or
// decline; changes made to the event afterwards are not sent. It is shown for as long as it is rendered, so the screen renders it only
// when open.
//
//   event     the event, as saved on the calendar
//   onClose()
export default function InviteFriendSheet({ event, onClose }) {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const following = useSocialGraphStore((s) => s.following);
  const isLoaded = useSocialGraphStore((s) => s.isLoaded);
  const isLoading = useSocialGraphStore((s) => s.isLoading);
  const loadFollowing = useSocialGraphStore((s) => s.loadFollowing);
  const invites = useCalendarInviteStore((s) => s.invites);
  const sendInvite = useCalendarInviteStore((s) => s.sendInvite);
  // Who is being asked right now, the ones asked in this sheet (so the row changes at once), and what went wrong.
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState({});
  const [error, setError] = useState('');

  const uid = user && user.uid;
  useEffect(() => {
    if (uid && !isLoaded) loadFollowing(uid);
  }, [uid, isLoaded, loadFollowing]);

  const people = useMemo(
    () => [...following].sort((a, b) => (a.close === b.close ? String(a.name).localeCompare(String(b.name)) : a.close ? -1 : 1)),
    [following]
  );

  const clean = sanitizeEvent(event);
  const allowed = canInviteTo(event);
  const when = clean ? describeInviteWhen({ start: clean.start, repeat: clean.repeat }) : '';

  const invite = async (person) => {
    if (sending) return;
    setSending(person.uid);
    setError('');
    try {
      const result = await sendInvite({
        event,
        from: { uid, name: user && user.name },
        to: { uid: person.uid, name: person.name },
      });
      if (result.ok) setSent((prev) => ({ ...prev, [person.uid]: true }));
      else setError(result.error || 'That did not go through.');
    } catch (e) {
      setError('That did not go through.');
    } finally {
      setSending(null);
    }
  };

  const findFriends = () => {
    onClose();
    router.push('/friends');
  };

  const row = (person) => {
    const standing = activeInviteFor(invites, uid, event.id, person.uid);
    const label = standing ? inviteStatusLabel(standing) : sent[person.uid] ? 'Waiting' : '';
    return (
      <View key={person.uid} testID={`invite-person-${person.uid}`} style={styles.person}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{String(person.name || '?').slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.personInfo}>
          <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
          {person.close ? <Text style={styles.sub}>Close friend</Text> : null}
        </View>
        {label ? (
          <Text testID={`invite-status-${person.uid}`} style={styles.status}>{label}</Text>
        ) : (
          <TouchableOpacity
            testID={`invite-send-${person.uid}`}
            accessibilityRole="button"
            accessibilityLabel={`Invite ${person.name}`}
            accessibilityState={{ disabled: !!sending }}
            disabled={!!sending || !allowed.ok}
            style={[styles.inviteBtn, (sending || !allowed.ok) && styles.inviteBtnOff]}
            onPress={() => invite(person)}>
            <Text style={styles.inviteText}>{sending === person.uid ? 'Sending...' : 'Invite'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID="invite-sheet" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title} numberOfLines={2}>Invite someone to {clean ? clean.title : 'this event'}</Text>
          {when ? <Text style={styles.when}>{when}</Text> : null}
          <Text style={styles.note}>They get a copy of this event to accept or decline. Changes you make to it later are not sent.</Text>

          {allowed.ok ? null : <Text testID="invite-blocked" style={styles.error}>{allowed.error}</Text>}
          {error ? <Text testID="invite-error" accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {isLoading && people.length === 0 ? <ActivityIndicator color="#000000" style={styles.loading} /> : null}
            {people.map(row)}
            {!isLoading && people.length === 0 ? (
              <View testID="invite-empty" style={styles.empty}>
                <Text style={styles.emptyText}>You are not following anyone yet. People you follow show up here.</Text>
                <TouchableOpacity testID="invite-find-friends" accessibilityRole="button" style={styles.findBtn} onPress={findFriends}>
                  <Text style={styles.findText}>Find friends</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity testID="invite-done" accessibilityRole="button" style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '700', color: '#000000' },
  when: { fontSize: 13, color: '#666666', marginTop: 4 },
  note: { fontSize: 13, color: '#999999', marginTop: 10 },
  error: { fontSize: 14, color: '#C62828', marginTop: 10 },
  list: { marginTop: 12 },
  loading: { marginVertical: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  personInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#000000' },
  sub: { fontSize: 12, color: '#888888', marginTop: 2 },
  status: { fontSize: 13, fontWeight: '600', color: '#666666' },
  inviteBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#000000' },
  inviteBtnOff: { opacity: 0.5 },
  inviteText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  empty: { paddingVertical: 12 },
  emptyText: { fontSize: 14, color: '#666666' },
  findBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#000000', alignItems: 'center' },
  findText: { fontSize: 14, fontWeight: '600', color: '#000000' },
  done: { marginTop: 16, paddingVertical: 14, borderRadius: 999, backgroundColor: '#000000', alignItems: 'center' },
  doneText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

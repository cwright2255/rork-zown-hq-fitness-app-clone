import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useCalendarInviteStore } from '@/store/calendarInviteStore';
import { describeInviteWhen, incomingInvites } from '@/lib/calendarInvites';
import { kindLabel } from '@/lib/calendarEvents';

// The invitations other people have sent to this person's calendar, with Accept and Decline. Nothing is drawn when none are waiting.
// Accepting puts a copy of the event on their own calendar (store/calendarInviteStore.js); declining only tells the sender.
//
//   onAccepted(event)  called after an invitation is accepted, with the event now on the calendar, so the screen can show its day and
//                      set the phone's reminder for it
export default function CalendarInvites({ onAccepted }) {
  const invites = useCalendarInviteStore((s) => s.invites);
  const uid = useCalendarInviteStore((s) => s.uid);
  const acceptInvite = useCalendarInviteStore((s) => s.acceptInvite);
  const declineInvite = useCalendarInviteStore((s) => s.declineInvite);
  // The invitation being answered right now (its buttons wait), and what went wrong with the last answer.
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const waiting = useMemo(() => incomingInvites(invites, uid), [invites, uid]);
  if (waiting.length === 0) return null;

  const answer = async (invite, accept) => {
    if (busy) return;
    setBusy(invite.id);
    setProblem(null);
    try {
      const result = accept ? await acceptInvite(invite.id) : await declineInvite(invite.id);
      if (!result.ok) setProblem({ id: invite.id, text: result.error || 'That did not go through.' });
      else if (accept && onAccepted) onAccepted(result.event);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View testID="calendar-invites" style={s.card}>
      <Text style={s.title}>Invitations ({waiting.length})</Text>
      {waiting.map((invite) => (
        <View key={invite.id} testID={`invite-${invite.id}`} style={s.item}>
          <Text style={s.who} numberOfLines={1}>{invite.fromName} invited you</Text>
          <Text style={s.what} numberOfLines={2}>{invite.title}</Text>
          <Text style={s.when}>{kindLabel(invite.kind)}, {describeInviteWhen(invite)}</Text>
          {invite.notes ? <Text style={s.notes} numberOfLines={2}>{invite.notes}</Text> : null}
          {problem && problem.id === invite.id ? <Text testID={`invite-error-${invite.id}`} accessibilityRole="alert" style={s.error}>{problem.text}</Text> : null}
          <View style={s.buttons}>
            <TouchableOpacity
              testID={`invite-decline-${invite.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Decline ${invite.title} from ${invite.fromName}`}
              accessibilityState={{ disabled: !!busy }}
              disabled={!!busy}
              style={[s.button, s.decline, busy && s.waiting]}
              onPress={() => answer(invite, false)}>
              <Text style={s.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`invite-accept-${invite.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Accept ${invite.title} from ${invite.fromName}`}
              accessibilityState={{ disabled: !!busy }}
              disabled={!!busy}
              style={[s.button, s.accept, busy && s.waiting]}
              onPress={() => answer(invite, true)}>
              <Text style={s.acceptText}>{busy === invite.id ? 'One moment...' : 'Accept'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#F7F7F7', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 16, borderWidth: 1, borderColor: '#000000' },
  title: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999999' },
  item: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  who: { fontSize: 12, fontWeight: '600', color: '#666666' },
  what: { fontSize: 16, fontWeight: '700', color: '#000000', marginTop: 4 },
  when: { fontSize: 13, color: '#666666', marginTop: 4 },
  notes: { fontSize: 13, color: '#999999', marginTop: 4 },
  error: { fontSize: 13, color: '#C62828', marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  decline: { borderWidth: 1, borderColor: '#000000' },
  declineText: { fontSize: 14, fontWeight: '600', color: '#000000' },
  accept: { backgroundColor: '#000000' },
  acceptText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  waiting: { opacity: 0.5 },
});

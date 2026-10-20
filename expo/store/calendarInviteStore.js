// store/calendarInviteStore.js
//
// Calendar invites (lib/calendarInvites.js says what one is). They live in the top-level collection calendarInvites, where each
// document names its two people in `participantIds`, so one listener gets every invite the person sent or was sent.
//
// What the rules (firestore.rules) let the app do, and so all this store does: send an invite to someone the person follows, accept or
// decline one sent to them, cancel one they sent. Nothing is ever deleted and an answered invite never changes again.
//
// Accepting copies the event onto the person's own calendar (store/scheduleStore.js) first, and only then tells the sender, and puts it
// back if telling the sender fails, so the two never disagree. The copy has an id made from the invite's, so accepting twice
// (a retry, a second phone) cannot put it on twice.
import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  addDoc, collection, doc, onSnapshot, query, updateDoc, where,
} from 'firebase/firestore';
import {
  MAX_PENDING_SENT, activeInviteFor, buildInvite, eventFromInvite, isOver, normalizeInvite, pendingSentCount,
} from '@/lib/calendarInvites';
import { MAX_EVENTS } from '@/lib/calendarEvents';
import { useScheduleStore } from '@/store/scheduleStore';

const failure = (error) => ({ ok: false, error });
const OFFLINE = 'That did not go through. Check your connection and try again.';
const GONE = 'That invitation is not open any more. It may have been cancelled.';
const stamp = () => new Date().toISOString();
const denied = (e) => e && (e.code === 'permission-denied' || /permission/i.test(String(e.message || '')));

let unsubscribeNow = null;

export const useCalendarInviteStore = create((set, get) => ({
  invites: [],
  // Whose invites are being listened for right now.
  uid: null,
  error: null,

  /** Starts listening for the person's invites (every one they sent or were sent). Safe to call again for the same person. */
  subscribe: (uid) => {
    if (!uid) return;
    if (get().uid === uid && unsubscribeNow) return;
    if (unsubscribeNow) unsubscribeNow();
    unsubscribeNow = null;
    set({ invites: [], uid, error: null });
    try {
      const q = query(collection(db, 'calendarInvites'), where('participantIds', 'array-contains', uid));
      unsubscribeNow = onSnapshot(
        q,
        (snap) => {
          // The person may have signed out, or someone else in, while this was on its way.
          if (get().uid !== uid) return;
          const invites = snap.docs.map((d) => normalizeInvite(d.id, d.data())).filter(Boolean);
          set({ invites, error: null });
        },
        (e) => {
          console.warn('[calendarInviteStore] listen error:', e?.message);
          set({ error: e?.message || 'Could not load invitations.' });
        }
      );
    } catch (e) {
      console.warn('[calendarInviteStore] subscribe error:', e?.message);
    }
  },

  /** Stops listening and forgets the invites (signing out: the next person must not see them). */
  unsubscribe: () => {
    if (unsubscribeNow) unsubscribeNow();
    unsubscribeNow = null;
    set({ invites: [], uid: null, error: null });
  },

  /**
   * Invites someone to one of the sender's events.
   * @param {object} args  { event, from: { uid, name }, to: { uid, name } }
   * @returns {Promise<{ ok: true, id: string } | { ok: false, error: string }>}
   */
  sendInvite: async ({ event, from, to }) => {
    const now = new Date();
    const made = buildInvite({ event, from, to, now });
    if (!made.ok) return made;
    const { invites } = get();
    if (activeInviteFor(invites, from.uid, made.data.eventId, to.uid, now)) {
      return failure(`${made.data.toName} is already invited to this.`);
    }
    if (pendingSentCount(invites, from.uid, now) >= MAX_PENDING_SENT) {
      return failure('You have a lot of invites waiting for an answer. Wait for some replies before sending more.');
    }
    try {
      const ref = await addDoc(collection(db, 'calendarInvites'), made.data);
      return { ok: true, id: ref.id };
    } catch (e) {
      console.warn('[calendarInviteStore] sendInvite error:', e?.message);
      return failure(denied(e) ? `You can only invite people you follow, and ${made.data.toName} is not on your list.` : OFFLINE);
    }
  },

  /**
   * Accepts an invite sent to the person: puts the event on their calendar, then tells the sender.
   * @returns {Promise<{ ok: true, event: object } | { ok: false, error: string }>}
   */
  acceptInvite: async (inviteId) => {
    const invite = get().invites.find((i) => i.id === inviteId);
    const uid = get().uid;
    if (!invite || invite.toUid !== uid || invite.status !== 'pending') return failure(GONE);
    const now = new Date();
    if (isOver(invite, now)) return failure('That event is already over.');
    const record = eventFromInvite(invite, now);
    if (!record) return failure(GONE);

    const schedule = useScheduleStore.getState();
    const alreadyThere = schedule.events.some((e) => e.id === record.id);
    if (!alreadyThere) {
      if (schedule.events.length >= MAX_EVENTS) return failure('Your calendar is full. Remove some events to add more.');
      if (schedule.addEvents([record]).length === 0) return failure('Your calendar is full. Remove some events to add more.');
    }
    try {
      await updateDoc(doc(db, 'calendarInvites', inviteId), { status: 'accepted', respondedAt: stamp() });
    } catch (e) {
      console.warn('[calendarInviteStore] acceptInvite error:', e?.message);
      if (!alreadyThere) useScheduleStore.getState().removeEvent(record.id);
      return failure(denied(e) ? GONE : OFFLINE);
    }
    return { ok: true, event: record };
  },

  /** Declines an invite sent to the person. */
  declineInvite: async (inviteId) => {
    const invite = get().invites.find((i) => i.id === inviteId);
    if (!invite || invite.toUid !== get().uid || invite.status !== 'pending') return failure(GONE);
    try {
      await updateDoc(doc(db, 'calendarInvites', inviteId), { status: 'declined', respondedAt: stamp() });
      return { ok: true };
    } catch (e) {
      console.warn('[calendarInviteStore] declineInvite error:', e?.message);
      return failure(denied(e) ? GONE : OFFLINE);
    }
  },

  /** Cancels an invite the person sent that has not been answered. */
  cancelInvite: async (inviteId) => {
    const invite = get().invites.find((i) => i.id === inviteId);
    if (!invite || invite.fromUid !== get().uid || invite.status !== 'pending') return failure(GONE);
    try {
      await updateDoc(doc(db, 'calendarInvites', inviteId), { status: 'cancelled', respondedAt: stamp() });
      return { ok: true };
    } catch (e) {
      console.warn('[calendarInviteStore] cancelInvite error:', e?.message);
      return failure(denied(e) ? GONE : OFFLINE);
    }
  },
}));

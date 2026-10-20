// lib/calendarInvites.js
//
// Calendar invites, as plain functions: no React, no Firebase, no stores, so every rule here is unit tested.
// store/calendarInviteStore.js sends, answers and listens for them; components/CalendarInvites.jsx, components/InviteFriendSheet.jsx and
// components/CalendarEventSheet.jsx draw them.
//
// An invite is a COPY of one of the sender's calendar events, offered to one person they follow. It lives in the top-level
// collection calendarInvites (see firestore.rules), one document each:
//   { participantIds: [uidA, uidB] (sorted), fromUid, toUid, fromName, toName,
//     status: 'pending' | 'accepted' | 'declined' | 'cancelled',
//     eventId (the sender's own event, so the sender can see who was asked), title, kind, start (ISO, the first time it happens),
//     notes, repeat: null | { every, days?, until }, createdAt (ISO), respondedAt (ISO, once answered) }
// Only the person invited can accept or decline, only the sender can cancel, and only while it is pending. Accepting puts a copy on
// the invited person's own calendar (eventFromInvite): from then on the two events are separate, so changing one never changes the other.
import {
  EVENT_KINDS, MAX_NOTES, MAX_TITLE, dateLabel, describeRepeat, normalizeRepeat, sanitizeEvent,
} from './calendarEvents';
import { localDateKey } from './localDate';
import { formatTime } from './scheduleUtils';

export const INVITE_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'];
/** How many invites one person can have waiting for an answer at once. */
export const MAX_PENDING_SENT = 50;
/** An invite to a single event stays open for an hour after it starts, the same grace the Next Up card gives an event. */
const GRACE_MS = 60 * 60 * 1000;
const NAME_MAX = 60;
const ID_MAX = 120;

const failure = (error) => ({ ok: false, error });
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const cleanName = (name) => (typeof name === 'string' ? name.trim().slice(0, NAME_MAX) : '') || 'Zown User';
const stampOf = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * Whether the event (or the invite made from it) is over: a single one an hour after it starts, a repeat once its last day has passed.
 * A repeat with no end is never over.
 */
export function isOver(thing, now = new Date()) {
  if (!thing || !stampOf(thing.start)) return true;
  if (thing.repeat) return !!thing.repeat.until && thing.repeat.until < localDateKey(now);
  return Date.parse(thing.start) < now.getTime() - GRACE_MS;
}

/** Whether this event can be offered to someone: { ok: true } or { ok: false, error }. */
export function canInviteTo(event, now = new Date()) {
  if (!event || typeof event !== 'object') return failure('Save the event first, then invite someone.');
  if (event.source === 'invite') return failure('This one is somebody else\'s invitation. Only your own events can be shared.');
  const clean = sanitizeEvent(event);
  if (!clean) return failure('Save the event first, then invite someone.');
  if (isOver(clean, now)) return failure('That event is already over.');
  return { ok: true };
}

/**
 * The document to save for an invite, or the reason there cannot be one.
 * @param {object} args  { event (the sender's own calendar event), from: { uid, name }, to: { uid, name }, now }
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function buildInvite({ event, from, to, now = new Date() } = {}) {
  if (!from || !isText(from.uid)) return failure('Sign in to invite someone.');
  if (!to || !isText(to.uid)) return failure('Pick who to invite.');
  if (from.uid === to.uid) return failure('You cannot invite yourself.');
  const allowed = canInviteTo(event, now);
  if (!allowed.ok) return allowed;
  const clean = sanitizeEvent(event);
  if (clean.id.length > ID_MAX) return failure('Save the event first, then invite someone.');
  return {
    ok: true,
    data: {
      participantIds: [from.uid, to.uid].sort(),
      fromUid: from.uid,
      toUid: to.uid,
      fromName: cleanName(from.name),
      toName: cleanName(to.name),
      status: 'pending',
      eventId: clean.id,
      title: clean.title.slice(0, MAX_TITLE),
      kind: clean.kind,
      start: clean.start,
      notes: clean.notes.slice(0, MAX_NOTES),
      repeat: clean.repeat ? JSON.parse(JSON.stringify(clean.repeat)) : null,
      createdAt: now.toISOString(),
    },
  };
}

/** An invite as the app uses it (its id added), or null when the document is not a usable one. */
export function normalizeInvite(id, raw) {
  if (!isText(id) || !raw || typeof raw !== 'object') return null;
  if (!isText(raw.fromUid) || !isText(raw.toUid) || !isText(raw.title) || !stampOf(raw.start)) return null;
  const start = new Date(raw.start).toISOString();
  return {
    id,
    fromUid: raw.fromUid,
    toUid: raw.toUid,
    fromName: cleanName(raw.fromName),
    toName: cleanName(raw.toName),
    status: INVITE_STATUSES.includes(raw.status) ? raw.status : 'pending',
    eventId: typeof raw.eventId === 'string' ? raw.eventId : '',
    title: raw.title.trim().slice(0, MAX_TITLE),
    kind: EVENT_KINDS.includes(raw.kind) ? raw.kind : 'other',
    start,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, MAX_NOTES) : '',
    repeat: normalizeRepeat(raw.repeat, localDateKey(new Date(start))),
    createdAt: stampOf(raw.createdAt) || start,
    respondedAt: stampOf(raw.respondedAt),
  };
}

/**
 * What accepting puts on the invited person's own calendar: the event, marked as an invitation with who asked. Its id comes from the
 * invite, so accepting the same invite twice (a second phone, a retry) never makes two. A workout or run reminds at its time, a meal
 * only shows, as with the events the coach adds. Null when the invite is not a usable one.
 */
export function eventFromInvite(invite, now = new Date()) {
  if (!invite || !isText(invite.id)) return null;
  return sanitizeEvent({
    id: `invite-${invite.id}`,
    title: invite.title,
    kind: invite.kind,
    start: invite.start,
    notes: invite.notes,
    workoutId: null,
    repeat: invite.repeat,
    remindMinutes: invite.kind === 'nutrition' ? null : 0,
    doneDates: [],
    skipDates: [],
    source: 'invite',
    inviteId: invite.id,
    host: { uid: invite.fromUid, name: invite.fromName },
    updatedAt: now.toISOString(),
  });
}

const byStart = (a, b) => (a.start === b.start ? (a.createdAt < b.createdAt ? -1 : 1) : a.start < b.start ? -1 : 1);

/** The invites waiting for this person to answer, soonest event first. One for an event that is over is left out. */
export function incomingInvites(invites, uid, now = new Date()) {
  if (!uid || !Array.isArray(invites)) return [];
  return invites
    .filter((i) => i && i.toUid === uid && i.status === 'pending' && !isOver(i, now))
    .sort(byStart);
}

/** Every invite this person sent for one of their events that is still of interest (not cancelled), oldest first. */
export function invitesForEvent(invites, uid, eventId) {
  if (!uid || !eventId || !Array.isArray(invites)) return [];
  return invites
    .filter((i) => i && i.fromUid === uid && i.eventId === eventId && i.status !== 'cancelled')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** The invite that is still standing for this person on this event (waiting, or accepted), or null. A declined one can be sent again. */
export function activeInviteFor(invites, uid, eventId, toUid, now = new Date()) {
  const standing = invitesForEvent(invites, uid, eventId).filter(
    (i) => i.toUid === toUid && (i.status === 'accepted' || (i.status === 'pending' && !isOver(i, now)))
  );
  return standing.length ? standing[standing.length - 1] : null;
}

/** How many invites this person has sent that nobody has answered yet. */
export function pendingSentCount(invites, uid, now = new Date()) {
  if (!uid || !Array.isArray(invites)) return 0;
  return invites.filter((i) => i && i.fromUid === uid && i.status === 'pending' && !isOver(i, now)).length;
}

/** The word to show for an invite, on the sender's side. */
export function inviteStatusLabel(invite, now = new Date()) {
  if (!invite) return '';
  if (invite.status === 'accepted') return 'Going';
  if (invite.status === 'declined') return 'Declined';
  if (invite.status === 'cancelled') return 'Cancelled';
  return isOver(invite, now) ? 'Expired' : 'Waiting';
}

/** When the invited event happens, in words: "Thu, Oct 22 at 7:00 AM", and how often if it repeats. */
export function describeInviteWhen(invite) {
  if (!invite || !stampOf(invite.start)) return '';
  const when = `${dateLabel(localDateKey(new Date(invite.start)))} at ${formatTime(invite.start)}`;
  return invite.repeat ? `${when}. ${describeRepeat(invite.repeat)}` : when;
}

/** "2 invites waiting", for the Home card. Empty when there are none. */
export function waitingText(count) {
  if (!count || count < 1) return '';
  return count === 1 ? '1 invite waiting' : `${count} invites waiting`;
}

// lib/audience.js
//
// Pure helpers for the Everyone / Following / Close Friends filter used by
// the Leaderboard, Challenges and Duels screens. "Following" is everyone you
// follow (close friends included). "Close Friends" is the private subset you
// starred. Nothing here talks to Firebase.

export const AUDIENCES = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'following', label: 'Following' },
  { id: 'close', label: 'Close Friends' },
];

export const DEFAULT_AUDIENCE = 'everyone';

export function isAudience(value) {
  return AUDIENCES.some((a) => a.id === value);
}

/** follows: [{ uid, close? }]. Returns the uids an audience covers, or null for everyone. */
export function audienceUids(audience, follows) {
  if (audience !== 'following' && audience !== 'close') return null;
  const list = Array.isArray(follows) ? follows : [];
  return list
    .filter((f) => f && typeof f.uid === 'string' && f.uid && (audience === 'following' || f.close === true))
    .map((f) => f.uid);
}

/**
 * Keeps the items whose uid is in the audience. `everyone` keeps all.
 * The signed-in user's own item is kept when keepSelf is true, so a
 * leaderboard filtered to friends still shows where you stand.
 */
export function filterByAudience(items, audience, follows, { getUid = (x) => x.uid, myUid = null, keepSelf = false } = {}) {
  const uids = audienceUids(audience, follows);
  const list = Array.isArray(items) ? items : [];
  if (uids === null) return list;
  const set = new Set(uids);
  return list.filter((item) => {
    const uid = getUid(item);
    if (keepSelf && myUid && uid === myUid) return true;
    return set.has(uid);
  });
}

/** Splits a list into groups of at most `size` (Firestore `in` queries allow 10). */
export function chunk(list, size = 10) {
  const out = [];
  const arr = Array.isArray(list) ? list : [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Highest first by `field` (a property name, or a function that gives an entry's
 * number), ties broken by name then id so the order never jumps around.
 */
export function rankEntries(entries, field = 'xp') {
  const valueOf = typeof field === 'function' ? field : (entry) => entry?.[field];
  return [...(Array.isArray(entries) ? entries : [])]
    .sort((a, b) => {
      const diff = (Number(valueOf(b)) || 0) - (Number(valueOf(a)) || 0);
      if (diff !== 0) return diff;
      const byName = String(a?.name || '').localeCompare(String(b?.name || ''));
      return byName !== 0 ? byName : String(a?.id || '').localeCompare(String(b?.id || ''));
    })
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/** Document id for one person's progress in one challenge. */
export function challengeEntryId(challengeId, uid) {
  return `${challengeId}_${uid}`;
}

/** Text shown when a filtered list is empty. */
export function emptyAudienceMessage(surface, audience) {
  const noun = { leaderboard: 'on the leaderboard', challenges: 'in this challenge', duels: 'with duels' }[surface] || 'here';
  if (audience === 'close') return `None of your close friends are ${noun} yet. Star people from the Friends screen to add them.`;
  if (audience === 'following') return `Nobody you follow is ${noun} yet. Tap a person to follow them.`;
  return surface === 'leaderboard' ? 'No one on the leaderboard yet.' : 'Nothing to show yet.';
}

/** What changed for one person when you set a follow / close friend state. */
export function nextFollowState(current, action) {
  const cur = current && typeof current === 'object' ? current : null;
  if (action === 'follow') return { following: true, close: cur ? cur.close === true : false };
  if (action === 'unfollow') return { following: false, close: false }; // unfollowing also removes them from close friends
  if (action === 'addClose') return { following: true, close: true };   // close friends are always people you follow
  if (action === 'removeClose') return { following: !!cur, close: false };
  return { following: !!cur, close: cur ? cur.close === true : false };
}

// services/friendsRank.js
//
// The Challenges & Rank card on Home needs the leaderboard entries of the people you follow. The Leaderboard screen has a store
// call for that (leaderboardStore.loadForUids), but it puts the answer in the same list the screen is showing, so a lookup from Home
// could swap that screen's Following or Close Friends list for this one. This reads the same entries, the same way, and hands them
// back without touching that store.
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { chunk } from '../lib/audience';

/**
 * The leaderboard entries ({ id, name, xp, ... }, unranked) of the given people and of `myUid`, or null when they could not be read
 * (so a failed lookup is not mistaken for nobody being ranked). Firestore answers ten ids at a time.
 */
export async function fetchFriendEntries(uids, myUid) {
  const ids = Array.from(new Set([...(Array.isArray(uids) ? uids : []), ...(myUid ? [myUid] : [])]));
  try {
    const groups = await Promise.all(
      chunk(ids, 10).map((group) => getDocs(query(collection(db, 'leaderboard'), where(documentId(), 'in', group))))
    );
    return groups.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    console.warn('[friendsRank] fetchFriendEntries error:', e?.message);
    return null;
  }
}

// store/blockStore.js
//
// The people this person has blocked: users/{uid}/blocks/{blockedUid} (firestore.rules), one small document per person holding their
// name and picture (for the Blocked people list in Settings) and when. It follows the account live, so blocking someone from one screen
// hides their posts and comments on every other screen at once.
//
//   - A blocked person's posts and comments are hidden from the one who blocked (lib/moderation.js withoutBlocked, used by the screens).
//   - The rules refuse a new conversation or message between the two of them, whichever of them blocked.
//   - Blocking is private: the document can only be read by the one who made it, so the other person is not told.
//
// The listener is started by the screens that need it (subscribeBlocks does nothing when it is already following this account) and is
// stopped, with the rest of the person's data, when they log out (lib/logOut.js).
import { create } from 'zustand';
import { db } from '../src/config/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

function entryFrom(uid, data = {}) {
  return {
    uid,
    name: typeof data.name === 'string' && data.name ? data.name : 'Zown User',
    avatar: typeof data.avatar === 'string' && data.avatar ? data.avatar : null,
    blockedAt: typeof data.blockedAt === 'string' ? data.blockedAt : null,
  };
}

export const useBlockStore = create((set, get) => ({
  blocked: {}, // { [uid]: { uid, name, avatar, blockedAt } }
  isLoaded: false,
  error: null,
  _uid: null,
  _unsubscribe: null,

  // Follows this person's block list. Safe to call from several screens: a second call for the same person does nothing.
  subscribeBlocks: (uid) => {
    if (!uid) return;
    if (get()._uid === uid && get()._unsubscribe) return;
    get()._unsubscribe?.();
    set({ isLoaded: false });
    const unsubscribe = onSnapshot(
      collection(db, 'users', uid, 'blocks'),
      (snap) => {
        const blocked = {};
        snap.docs.forEach((d) => { blocked[d.id] = entryFrom(d.id, d.data()); });
        set({ blocked, isLoaded: true, error: null });
      },
      (e) => {
        console.warn('[blockStore] subscribeBlocks error:', e?.message);
        set({ error: e?.message || 'Could not load blocked people.', isLoaded: true });
      },
    );
    set({ _uid: uid, _unsubscribe: unsubscribe });
  },

  unsubscribeBlocks: () => {
    get()._unsubscribe?.();
    set({ _uid: null, _unsubscribe: null });
  },

  // Blocks a person. Their posts and comments are hidden at once; if the database refuses, the block is taken back and this says false.
  blockUser: async ({ myUid, uid, name, avatar }) => {
    if (!myUid || !uid || myUid === uid) return false;
    const blockedAt = new Date().toISOString();
    const data = { blockedAt };
    if (typeof name === 'string' && name) data.name = name.slice(0, 100);
    if (typeof avatar === 'string' && avatar) data.avatar = avatar;
    const before = get().blocked;
    set({ blocked: { ...before, [uid]: entryFrom(uid, data) } });
    try {
      await setDoc(doc(db, 'users', myUid, 'blocks', uid), data);
      return true;
    } catch (e) {
      console.warn('[blockStore] blockUser error:', e?.message);
      set((state) => {
        const rest = { ...state.blocked };
        if (!before[uid]) delete rest[uid];
        return { blocked: rest };
      });
      return false;
    }
  },

  // Takes a block back. If the database refuses, the person stays blocked and this says false.
  unblockUser: async ({ myUid, uid }) => {
    if (!myUid || !uid) return false;
    const before = get().blocked;
    const entry = before[uid];
    set((state) => {
      const rest = { ...state.blocked };
      delete rest[uid];
      return { blocked: rest };
    });
    try {
      await deleteDoc(doc(db, 'users', myUid, 'blocks', uid));
      return true;
    } catch (e) {
      console.warn('[blockStore] unblockUser error:', e?.message);
      if (entry) set((state) => ({ blocked: { ...state.blocked, [uid]: entry } }));
      return false;
    }
  },

  isBlocked: (uid) => !!uid && Object.prototype.hasOwnProperty.call(get().blocked, uid),
}));

// store/messagingStore.js
//
// Real-time direct messaging — replaces THREE separate hardcoded fake
// implementations found across this codebase: app/messaging.jsx (a
// self-contained list+thread with its own fake "Sarah Johnson" data),
// app/messages.jsx (a separate fake conversation list), and
// app/messages/[id].jsx (a separate fake thread view). All three now read
// from this one real store.
//
// Firestore schema:
//   conversations/{conversationId}
//     participantIds: [uidA, uidB]   (sorted, so the id below is stable)
//     participantInfo: { [uid]: {name, avatar} }  (denormalized, avoids a
//       lookup into the other user's private profile just to show a name)
//     lastMessage: {text, senderId, createdAt}
//     updatedAt
//   conversations/{conversationId}/messages/{messageId}
//     senderId, text, createdAt
//
// Conversation id is deterministic (sorted uids joined) so two users
// always land in the same conversation regardless of who starts it —
// verified this produces the same id regardless of argument order before
// using it as the actual document key.

import { create } from 'zustand';
import { db } from '../src/config/firebase';
import {
  collection, doc, getDoc, setDoc, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';

export function getConversationId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

export const useMessagingStore = create((set, get) => ({
  conversations: [],
  activeMessages: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  error: null,
  _convUnsubscribe: null,
  _msgUnsubscribe: null,

  // Live conversation list for the current user.
  subscribeConversations: (uid) => {
    if (!uid) return;
    get()._convUnsubscribe?.();
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const conversations = snap.docs.map((d) => {
          const data = d.data();
          const otherUid = (data.participantIds || []).find((id) => id !== uid);
          const otherInfo = data.participantInfo?.[otherUid] || {};
          return {
            id: d.id,
            otherUid,
            name: otherInfo.name || 'Zown User',
            avatar: otherInfo.avatar || null,
            lastMessage: data.lastMessage || null,
            updatedAt: data.updatedAt,
          };
        });
        set({ conversations, isLoadingConversations: false });
      },
      (e) => {
        console.warn('[messagingStore] subscribeConversations error:', e?.message);
        set({ error: e?.message, isLoadingConversations: false });
      }
    );
    set({ _convUnsubscribe: unsubscribe, isLoadingConversations: true });
  },

  unsubscribeConversations: () => {
    get()._convUnsubscribe?.();
    set({ _convUnsubscribe: null });
  },

  // Live messages for one conversation.
  subscribeMessages: (conversationId) => {
    if (!conversationId) return;
    get()._msgUnsubscribe?.();
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const activeMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ activeMessages, isLoadingMessages: false });
      },
      (e) => {
        console.warn('[messagingStore] subscribeMessages error:', e?.message);
        set({ error: e?.message, isLoadingMessages: false });
      }
    );
    set({ _msgUnsubscribe: unsubscribe, isLoadingMessages: true, activeMessages: [] });
  },

  unsubscribeMessages: () => {
    get()._msgUnsubscribe?.();
    set({ _msgUnsubscribe: null, activeMessages: [] });
  },

  // Creates the conversation document if it doesn't exist yet (first
  // message between these two users), then sends the message. Returns the
  // conversation id so the caller can navigate to it.
  sendMessage: async ({ myUid, myName, myAvatar, otherUid, otherName, otherAvatar, text }) => {
    if (!myUid || !otherUid || !text?.trim()) return null;
    const conversationId = getConversationId(myUid, otherUid);
    const convRef = doc(db, 'conversations', conversationId);

    try {
      const existing = await getDoc(convRef);
      const messagePreview = { text: text.trim(), senderId: myUid, createdAt: serverTimestamp() };

      if (!existing.exists()) {
        await setDoc(convRef, {
          participantIds: [myUid, otherUid].sort(),
          participantInfo: {
            [myUid]: { name: myName || 'Zown User', avatar: myAvatar || null },
            [otherUid]: { name: otherName || 'Zown User', avatar: otherAvatar || null },
          },
          lastMessage: messagePreview,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(convRef, {
          lastMessage: messagePreview,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: myUid,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });

      return conversationId;
    } catch (e) {
      console.warn('[messagingStore] sendMessage error:', e?.message);
      throw e;
    }
  },

  // Used to start a new conversation from another user's profile/post
  // without sending a message yet — just resolves the deterministic id.
  getOrCreateConversationId: (myUid, otherUid) => getConversationId(myUid, otherUid),
}));

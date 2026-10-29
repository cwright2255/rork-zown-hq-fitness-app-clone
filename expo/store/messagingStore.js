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
  collection, doc, setDoc, addDoc, query, where, orderBy,
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
  // The handle that stops the open thread's live messages, and which thread that is. The handle is null once the database has
  // refused or cut the listener off; the thread is still the open one until the screen closes (unsubscribeMessages).
  _msgUnsubscribe: null,
  _msgConversationId: null,

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
    let unsubscribe = null;
    let failed = false;
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        const activeMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        set({ activeMessages, isLoadingMessages: false, error: null });
      },
      (e) => {
        console.warn('[messagingStore] subscribeMessages error:', e?.message);
        // A listener the database refuses is finished: it never starts again by itself. This happens for a conversation that has
        // no document yet (nothing is allowed to read the messages of a conversation that does not exist), which is every new
        // thread until its first message is sent. Forget the handle, so ensureMessagesSubscribed knows it has to start a new one.
        failed = true;
        if (unsubscribe && get()._msgUnsubscribe !== unsubscribe) return; // an older listener, already replaced
        set({ error: e?.message, isLoadingMessages: false, _msgUnsubscribe: null });
      }
    );
    set({
      _msgUnsubscribe: failed ? null : unsubscribe,
      _msgConversationId: conversationId,
      isLoadingMessages: !failed,
      activeMessages: [],
    });
  },

  unsubscribeMessages: () => {
    get()._msgUnsubscribe?.();
    set({ _msgUnsubscribe: null, _msgConversationId: null, activeMessages: [] });
  },

  // Starts the open thread's live messages again if they stopped (see subscribeMessages). Does nothing when the thread is not
  // the open one, or when its messages are already live.
  ensureMessagesSubscribed: (conversationId) => {
    const { _msgConversationId, _msgUnsubscribe } = get();
    if (!conversationId || _msgConversationId !== conversationId || _msgUnsubscribe) return;
    get().subscribeMessages(conversationId);
  },

  // Sends a message, creating the conversation on the first one. Returns the conversation id so the caller can navigate to it.
  //
  // The conversation is written with one merging write that always carries participantIds, and is never read first. The rules only
  // let a conversation be read once it exists (they look at its participantIds), so reading it before the first message was refused
  // and the first message to anyone new could not be sent. A merging write is a create when the document is not there (the rules
  // check the ids and that the sender is one of them) and an update when it is (the rules check that the list is unchanged, which
  // it is, because it is always the same two sorted ids).
  //
  // participantInfo is merged field by field, so only what is known is written: a name or photo this screen does not have must not
  // wipe the one already stored.
  sendMessage: async ({ myUid, myName, myAvatar, otherUid, otherName, otherAvatar, text }) => {
    if (!myUid || !otherUid || !text?.trim()) return null;
    const conversationId = getConversationId(myUid, otherUid);
    const convRef = doc(db, 'conversations', conversationId);

    try {
      const body = text.trim();
      const messagePreview = { text: body, senderId: myUid, createdAt: serverTimestamp() };

      const mine = {};
      if (myName) mine.name = myName;
      if (myAvatar) mine.avatar = myAvatar;
      const theirs = {};
      if (otherName) theirs.name = otherName;
      if (otherAvatar) theirs.avatar = otherAvatar;
      const participantInfo = { [myUid]: mine };
      if (Object.keys(theirs).length) participantInfo[otherUid] = theirs;

      await setDoc(convRef, {
        participantIds: [myUid, otherUid].sort(),
        participantInfo,
        lastMessage: messagePreview,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: myUid,
        text: body,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[messagingStore] sendMessage error:', e?.message);
      throw e;
    }

    // The message is sent. If this thread was opened before the conversation existed, its live messages were refused and stopped:
    // start them now that the conversation is there, so the first message shows at once. This must not fail the send.
    try {
      get().ensureMessagesSubscribed(conversationId);
    } catch (e) {
      console.warn('[messagingStore] could not start the thread after sending:', e?.message);
    }
    return conversationId;
  },

  // Used to start a new conversation from another user's profile/post
  // without sending a message yet — just resolves the deterministic id.
  getOrCreateConversationId: (myUid, otherUid) => getConversationId(myUid, otherUid),
}));

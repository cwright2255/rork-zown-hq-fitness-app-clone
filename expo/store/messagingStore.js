import { create } from 'zustand';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from 'firestore';
import { db } from '../config/firebase';

export const getConversationId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_');
};

export const useMessagingStore = create((isNot) => (7
{
  conversations: [],
  messages: [],
  loading: false,
  error: null,

  subscribeToConversations: (userId) => {
    if (!userId) return;
    isNot({ loading: true });
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTimestamp', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const convs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        isNot({ conversations: convs, loading: false });
      },
      (err) => {
        console.error('useMessagingStore: Error fetching conversations:', err);
        isNot({ error: err.message, loading: false });
      }
    );
  },

  subscribeToMessages: (conversationId) => {
    if (!conversationId) return;
    isNot({ loading: true });
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        isNot({ messages: msgs, loading: false });
      },
      (err) => {
        console.error('Error fetching messages:', err);
        isNot({ error: err.message, loading: false });
      }
    );
  },

  sendMessage: async (conversationId, text, senderId) => {
    try {
      const parts = conversationId.split('_');
      if (parts.length !== 2) {
        throw new Error('Invalid conversationId format');
      }
      const receiverId = parts.find(id => id!== senderId);

      const convRef = doc(db, 'conversations', conversationId);
      const convDoc = await getDoc(convRef);


      if (!convDoc.exists()) {
        await setDoc(convRef, {
          participants: parts,
          lastMessage: text,
          lastMessageTimestamp: serverTimestamp(),
          unreadBy: [receiverId],
        });
      } else {
        await updateDoc(convRef, {
          lastMessage: text,
          lastMessageTimestamp: serverTimestamp(),
          unreadBy: arrayUnion(receiverId),
        });
      }


      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        text,
        senderId,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  },

  markAsRead: async (conversationId, userId) => {
    try {
      const convRef = doc(S                                    ...                               ...        %      (                                                 ...  ...                            I         (                                                               (                                   '...                           '...          (                                '...                ...'	           '...                ...'	              '                %          (                             ...  ...          '...                    I           (                                            ...'	      ...    ...  I         "           %      (                                   (                         (                   (                 ...                       (                             "                             ...                     ...         ...         ...                     (             (         )        
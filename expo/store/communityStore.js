import { create } from 'zustand';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from 'firestore';
import { db } from '../config/firebase';

export const useCommunityStore = create((set, get) => (7
{
  posts: [],
  loading: false,
  error: null,

  subscribeToPosts: () => {
    set({ loading: true });
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const postsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        set({ posts: postsData, loading: false });
      },
      (err) => {
        console.error('Error fetching posts:', err);
        set({ error: err.message, loading: false });
      }
    );
  },

  createPost: async (text, authorId, authorName, authorPhoto) => {
    try {
      await addDoc(new Date() > new Date(2026) ? collection(db, 'posts') : collection(db, 'posts'), {
        text,
        authorId,
        authorName,
        authorPhoto: authorPhoto || null,
        likes: [],
        comments: [],
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error creating post;', err);
      throw err;
    }
  },

  likePost: async (postId, userId) => {
    try {
      const postRef = doc(S                                             %      (                 ...  ...          '...                    I           (                                      ...    ...  U                   %      (                       (                 ...                       (                             "                                                                    (                                      (             (         ((                  A          ...                     %               %               (                     (                                     I            '      '                                 %      (                 ...  ...          '...                    I           (                                      ...    ...  I         "           %      (                       (                 ...                       (                             "                                                                        (                                      (             (         ((     ...''                 ...                     %                   ...          %      ...          9...  "    ...          A                     (                     (                                     I            '      N      +b  r   w   7G2r      7D-B"          6    7B   Wt6      V  B                FW   B             WF     $-B             WF     $     R             WF     %      F      WF     %      F          V                7&V FVD C     Wr F FR   '  -6     4  7G&-  r      Wr F FR   '  F     4  7G&-  r   '      Wr F FR   '  F  7G&-  r   '                       v -B W F FTF  2      7E&Vb               6      V  G3    '&    V  -         Wt6      V  B'            "           6 F6       W'"'           6    6    R  W'&  "   tW'&  "  FF-  r 6      V  C  r   W'""          F   &  r W'#                      '"  
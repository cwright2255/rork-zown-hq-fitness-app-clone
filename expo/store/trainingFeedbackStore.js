import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  emptyFeedback, sanitizeFeedback, pruneFeedback, setVote, nextVote, voteOf, excludeExercise, restoreExercise, recordSwap, recordSkip,
} from '@/lib/trainingFeedback';
import { emptyMeasures, sanitizeMeasures, noteStart, noteSet, noteEnd } from '@/lib/trainingMeasures';

// What the person has told the training engine (More, Less, Exclude, the swaps and skips: lib/trainingFeedback.js) and the counters its claims
// are backed with (lib/trainingMeasures.js). Kept on the phone, and in the cloud (users/{uid}/data/trainingFeedback), so a new phone starts from
// the same picks. Nothing here picks anything: services/sessionService.js hands the picker what this holds.
//
// The cloud copy is one document { feedback, measures, updatedAt }. When the phone and the cloud disagree the later `updatedAt` wins as a whole
// (the counters cannot be added together without counting the same thing twice). Writes wait for things to go quiet (a set is logged every
// minute or so in a workout), and a write that has nothing new to say is skipped.

/** How long after the last change the cloud copy is written. */
export const FEEDBACK_PUSH_DELAY_MS = 2500;

const stamp = () => new Date().toISOString();

// ---- the cloud copy --------------------------------------------------------

let lastSynced = null;
let chain = Promise.resolve();
let timer = null;

const snapshotOf = (state, now) => JSON.stringify({ feedback: pruneFeedback(state.feedback, now), measures: sanitizeMeasures(state.measures) });

// Writes what is held NOW; a write that has nothing new to say is skipped.
async function pushFeedback(uid) {
  // Sync may have moved on to someone else since this write was queued; it must not touch their copy.
  if (useTrainingFeedbackStore.getState().syncUid !== uid) return;
  try {
    const state = useTrainingFeedbackStore.getState();
    const snapshot = snapshotOf(state, new Date());
    // Someone who has never given any feedback or trained does not need a document in the cloud.
    const untouched = snapshot === JSON.stringify({ feedback: emptyFeedback(), measures: emptyMeasures() });
    if (snapshot === lastSynced || (lastSynced === null && untouched)) return;
    // Firestore refuses `undefined` anywhere in a document, so the copy that is sent is the one that went through JSON.
    await setDoc(doc(db, 'users', uid, 'data', 'trainingFeedback'), { ...JSON.parse(snapshot), updatedAt: state.updatedAt || stamp() });
    lastSynced = snapshot;
  } catch (e) {
    console.warn('[trainingFeedbackStore] sync error:', e?.message);
  }
}

export const useTrainingFeedbackStore = create(
  persist(
    (set, get) => {
      // Every change goes through here, so `updatedAt` always says when this phone's copy last changed.
      const change = (update) => set((state) => ({ ...update(state), updatedAt: stamp() }));

      return {
        feedback: emptyFeedback(),
        measures: emptyMeasures(),
        updatedAt: '',
        syncUid: null,

        // Takes the cloud copy if it is newer than this phone's, then keeps the cloud copy up to date.
        startSync: async (uid) => {
          if (!uid) return;
          // Another person signing in on this phone starts from their own copy, not the last person's.
          if (get().syncUid && get().syncUid !== uid) {
            lastSynced = null;
            set({ feedback: emptyFeedback(), measures: emptyMeasures(), updatedAt: '', syncUid: null });
          }
          try {
            const snap = await getDoc(doc(db, 'users', uid, 'data', 'trainingFeedback'));
            if (snap.exists()) {
              const cloud = snap.data() || {};
              const cloudAt = typeof cloud.updatedAt === 'string' ? cloud.updatedAt : '';
              if (cloudAt > get().updatedAt) {
                const feedback = sanitizeFeedback(cloud.feedback);
                const measures = sanitizeMeasures(cloud.measures);
                // What came from the cloud is already there: it does not need writing back.
                lastSynced = snapshotOf({ feedback, measures }, new Date());
                set({ feedback, measures, updatedAt: cloudAt });
              }
            }
          } catch (e) {
            console.warn('[trainingFeedbackStore] load error:', e?.message);
          }
          set({ syncUid: uid });
        },

        // Taps More or Less on an exercise (key: lib/trainingFeedback.js feedbackKey). The same one again clears it. Returns the vote now held.
        vote: (key, tapped) => {
          const next = nextVote(voteOf(get().feedback, key), tapped);
          change((state) => ({ feedback: setVote(state.feedback, key, next, new Date()) }));
          return next;
        },

        exclude: (key, info) => change((state) => ({ feedback: excludeExercise(state.feedback, key, info, new Date()) })),
        restore: (key) => change((state) => ({ feedback: restoreExercise(state.feedback, key) })),

        // A swap away from an exercise before starting (the swaps are counted against the session at Start: recordStart).
        noteSwap: (key) => change((state) => ({ feedback: recordSwap(state.feedback, key, new Date()) })),

        // Start Workout on Today's Session: { exercises, swapped, excluded } (lib/trainingMeasures.js noteStart).
        recordStart: (info) => change((state) => ({ measures: noteStart(state.measures, info, new Date()) })),

        // One logged set that had a target; `hit` is whether it reached it.
        recordSet: (hit) => change((state) => ({ measures: noteSet(state.measures, hit, new Date()) })),

        // The end of a workout the engine built: { cutShort, skipped: [feedback keys] } (lib/trainingMeasures.js sessionOutcome).
        recordEnd: (outcome) => {
          if (!outcome) return;
          const skipped = Array.isArray(outcome.skipped) ? outcome.skipped : [];
          change((state) => ({
            measures: noteEnd(state.measures, { cutShort: outcome.cutShort === true, skipped: skipped.length }, new Date()),
            feedback: skipped.reduce((fb, key) => recordSkip(fb, key, new Date()), state.feedback),
          }));
        },
      };
    },
    {
      name: 'zown-training-feedback-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ feedback: pruneFeedback(state.feedback, new Date()), measures: state.measures, updatedAt: state.updatedAt }),
      merge: (persisted, current) => ({
        ...current,
        feedback: sanitizeFeedback(persisted && persisted.feedback),
        measures: sanitizeMeasures(persisted && persisted.measures),
        updatedAt: persisted && typeof persisted.updatedAt === 'string' ? persisted.updatedAt : '',
      }),
    }
  )
);

// Once sync is on, a change is written to the cloud when things have gone quiet (one write at a time, in order).
useTrainingFeedbackStore.subscribe((state) => {
  if (!state.syncUid) return;
  const uid = state.syncUid;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    chain = chain.then(() => pushFeedback(uid));
  }, FEEDBACK_PUSH_DELAY_MS);
});

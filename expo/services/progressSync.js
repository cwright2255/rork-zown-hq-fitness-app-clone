// services/progressSync.js
//
// Follows the person's progress on the server: the lifetime workout totals, the achievements and badges earned, and the Battle Pass
// tiers claimed. All of it is worked out there (functions/src/lifetimeTotals.js, unlockRules.js, unlocks.js) and written to documents the
// rules let only the server write; this listens to those documents and hands every change to the store that shows it. Started when the
// person signs in (app/_layout.jsx), stopped when they sign out.
//
// When it starts it also asks the server to catch up (the syncMyProgress function): to count the totals if they are not there yet,
// and to work out everything earned so far. What comes of that reaches the phone through the listeners, so it needs no answer.
//
// It never throws; a listener that fails to start leaves what is on screen as it was, and starts again the next time the app opens.
import { onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { useLifetimeStore } from '../store/lifetimeStore';
import { useAchievementStore } from '../store/achievementStore';
import { useBadgeStore } from '../store/badgeStore';
import { useBattlePassStore } from '../store/battlePassStore';
import { callProxy } from './callProxy';

let stops = [];

function stopListeners() {
  stops.forEach((stop) => {
    try { stop(); } catch (e) { console.warn('[progressSync] stop failed:', e?.message); }
  });
  stops = [];
}

/** Stops following (a second call, or a call with nothing started, does nothing) and clears what the stores were showing. */
export function stopProgressSync() {
  stopListeners();
  try {
    useLifetimeStore.getState().clearTotals();
    useAchievementStore.getState().clearServerUnlocks();
    useBadgeStore.getState().clearServerUnlocks();
    useBattlePassStore.getState().clearServerClaims();
  } catch (e) {
    console.warn('[progressSync] clear failed:', e?.message);
  }
}

// One listener on one of the person's documents. A document that is missing is passed on as null; a missing document reported from the
// phone's own cache (it is offline, and has not heard from the server) says nothing about the server, so it is left alone.
function follow(uid, path, name, apply) {
  try {
    const stop = onSnapshot(
      doc(db, 'users', uid, ...path),
      (snap) => {
        const exists = snap.exists();
        if (!exists && snap.metadata && snap.metadata.fromCache) return;
        try {
          apply(exists ? snap.data() : null);
        } catch (e) {
          console.warn(`[progressSync] could not show ${name}:`, e?.message);
        }
      },
      (e) => console.warn(`[progressSync] ${name} listener error:`, e?.message)
    );
    stops.push(stop);
  } catch (e) {
    console.warn(`[progressSync] could not start ${name}:`, e?.message);
  }
}

// TEMPORARY CHECK (to be removed once the first catch-up has been seen working). The catch-up call is silent on the server when it works
// and the phone only warns when it fails, so neither side shows whether the phone is running this code or why the call did not
// complete. Each start writes users/{uid}/data/progressSyncDebug: which build of the app is running, when the call was made, and how it
// ended. It is read in the Firebase console. It never throws and nothing waits for it.
function bundleInfo() {
  try {
    const Updates = require('expo-updates');
    return {
      updateId: Updates.updateId || null,
      embeddedLaunch: Updates.isEmbeddedLaunch === undefined ? null : !!Updates.isEmbeddedLaunch,
      channel: Updates.channel || null,
      runtimeVersion: Updates.runtimeVersion || null,
    };
  } catch (e) {
    return { updateId: null, embeddedLaunch: null, channel: null, runtimeVersion: null };
  }
}

function noteCheck(uid, fields) {
  try {
    Promise.resolve(setDoc(doc(db, 'users', uid, 'data', 'progressSyncDebug'), fields, { merge: true }))
      .catch((e) => console.warn('[progressSync] check note failed:', e?.message));
  } catch (e) {
    console.warn('[progressSync] check note failed:', e?.message);
  }
}

const failureFields = (e) => ({
  finishedAt: new Date().toISOString(),
  outcome: 'failed',
  errorCode: (e && e.code) || null,
  errorMessage: String((e && e.message) || e).slice(0, 300),
});

/** Starts following this person's progress, in place of any earlier start. */
export function startProgressSync(uid) {
  if (!uid) return;
  stopListeners();
  follow(uid, ['stats', 'totals'], 'totals', (data) => useLifetimeStore.getState().applyTotals(data));
  follow(uid, ['data', 'achievements'], 'achievements', (data) => useAchievementStore.getState().applyServerUnlocks(data && data.unlocked));
  follow(uid, ['data', 'badges'], 'badges', (data) => useBadgeStore.getState().applyServerUnlocks(data && data.unlocked));
  follow(uid, ['data', 'battlePass'], 'battle pass', (data) => useBattlePassStore.getState().applyServerClaims(data && data.claimedTiers));
  // Ask the server to catch up. Not waited for, and a failure (offline, signed out) only means the next start asks again.
  noteCheck(uid, { ...bundleInfo(), startedAt: new Date().toISOString(), finishedAt: null, outcome: 'asking', errorCode: null, errorMessage: null });
  try {
    Promise.resolve(callProxy('syncMyProgress', {})).then(
      () => noteCheck(uid, { finishedAt: new Date().toISOString(), outcome: 'ok', errorCode: null, errorMessage: null }),
      (e) => {
        console.warn('[progressSync] catch-up failed:', e?.message);
        noteCheck(uid, failureFields(e));
      }
    );
  } catch (e) {
    console.warn('[progressSync] catch-up failed:', e?.message);
    noteCheck(uid, failureFields(e));
  }
}

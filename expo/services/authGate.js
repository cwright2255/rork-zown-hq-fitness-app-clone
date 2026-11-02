// services/authGate.js
//
// Who is signed in when the app opens, and what happens when Firebase ends a session. Firebase's own sign-in state decides; the token
// the app saves at sign-in (services/authService.js) no longer does on its own. Before this, the launch gate only checked that a saved
// token existed, so after Firebase ended a session (a password change, an account removed elsewhere) the person stayed inside and every
// cloud call failed with "permission denied" until they logged out by hand.
//
// Used by app/index.jsx (the launch gate) and app/_layout.jsx (the listener that runs for as long as the app is open).
//
//   resolveLaunchSession   waits for Firebase's FIRST answer, then says whether to open Home or the login screen.
//                          - Signed in: open Home, as long as the "keep me signed in" window has not run out (authService.isAuthenticated).
//                          - Signed out: whatever the phone kept from an earlier sign-in is stale. It is cleared (the saved token, and
//                            every store and saved key, the same as Log Out) and the login screen opens.
//                          - No answer in time (a slow start): the saved token decides, as it did before. A slow start never logs anyone out.
//   waitForFirstAnswer     Firebase restores a saved session from the phone's storage a moment after start, and until it has, the
//                          current user reads as nobody. That empty reading is not an answer. The first call of onAuthStateChanged is:
//                          it only comes once the saved session has been looked for.
//   handleSignedOut        Firebase reported "signed out" while the app was open. If the app still holds a saved sign-in, Firebase
//                          ended the session (the person did not log out), so it is cleared and the login screen opens.
//
// Firebase itself checks a saved session against its servers before it gives its first answer, and signs the person out when the account
// was removed, disabled or had its password changed (any answer but "no network"). So a removed account arrives here as "signed out".
//
// Everything is passed in (Firebase's functions, the auth service, the clean-up), so the logic can be tested without Firebase.

export const FIRST_ANSWER_TIMEOUT_MS = 10000;

/**
 * Resolves with Firebase's first answer about who is signed in:
 *   { state: 'signed-in', user } | { state: 'signed-out' } | { state: 'unknown' } (no answer in time, or the listener failed).
 */
export function waitForFirstAnswer({ auth, onAuthStateChanged, timeoutMs = FIRST_ANSWER_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe = null;
    let timer = null;

    const finish = (answer) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch { /* nothing to undo */ }
      }
      resolve(answer);
    };

    timer = setTimeout(() => finish({ state: 'unknown' }), timeoutMs);
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (user) => finish(user ? { state: 'signed-in', user } : { state: 'signed-out' }),
        () => finish({ state: 'unknown' })
      );
      // The first answer can arrive before the unsubscribe function is back in hand.
      if (done && typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch { /* nothing to undo */ }
      }
    } catch {
      finish({ state: 'unknown' });
    }
  });
}

/**
 * @param {object} args
 *   auth, isFirebaseConfigured, onAuthStateChanged   Firebase
 *   authService   { isAuthenticated(), getStoredToken() }
 *   endSession    () => Promise  clears the saved sign-in and everything of the person on the phone (lib/logOut.js)
 * @returns {Promise<{ authed: boolean, uid: string|null, answer: string }>}
 */
export async function resolveLaunchSession({
  auth, isFirebaseConfigured, onAuthStateChanged, authService, endSession, timeoutMs = FIRST_ANSWER_TIMEOUT_MS,
}) {
  // A build with no Firebase keys (a preview) has no Firebase session to follow: the saved sign-in is all there is.
  if (!isFirebaseConfigured || !auth) {
    return { authed: !!(await authService.isAuthenticated()), uid: null, answer: 'unconfigured' };
  }

  const answer = await waitForFirstAnswer({ auth, onAuthStateChanged, timeoutMs });

  if (answer.state === 'signed-out') {
    // Nobody is signed in to Firebase. A saved sign-in that is still here is left over from a session that has ended.
    const token = await authService.getStoredToken();
    if (token) {
      try {
        await endSession();
      } catch (e) {
        console.warn('[authGate] could not clear the ended session:', e?.message);
      }
    }
    return { authed: false, uid: null, answer: 'signed-out' };
  }

  if (answer.state === 'signed-in') {
    const authed = !!(await authService.isAuthenticated());
    return { authed, uid: authed ? answer.user.uid || null : null, answer: 'signed-in' };
  }

  // No answer: do what the app did before, rather than risk logging someone out over a slow start.
  return { authed: !!(await authService.isAuthenticated()), uid: null, answer: 'unknown' };
}

/**
 * Firebase reported "signed out" while the app was open.
 * @returns {Promise<boolean>} true when it ended the session (and opened the login screen)
 */
export async function handleSignedOut({ authService, endSession, openLogin }) {
  // A person who logs out themselves: the saved sign-in goes first (authService.logout), so there is nothing left to end here.
  const token = await authService.getStoredToken();
  if (!token) return false;
  try {
    await endSession();
  } catch (e) {
    console.warn('[authGate] could not clear the ended session:', e?.message);
  }
  openLogin();
  return true;
}

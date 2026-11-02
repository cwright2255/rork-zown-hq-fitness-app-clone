// services/underageRemoval.js
//
// What happens to the account of someone who enters a date of birth that makes them younger than 13 in onboarding
// (app/onboarding.jsx, lib/ageGate.js). The app is for people 13 and older, so the account they just made is removed with the same
// Cloud Function Settings → Delete Account uses (deleteMyAccount: it erases the person's data and files, then their sign-in and email),
// and the phone is cleaned the same way Log Out cleans it (lib/logOut.js). The date of birth they typed is never saved anywhere.
//
// Two things can go wrong, and both end the same way for the person (they are out, and nothing of them stays on the phone):
//   - deleteMyAccount refuses or cannot be reached. It needs a sign-in no more than 5 minutes old, and for an account that signs in
//     with Apple it needs a fresh code from Apple, which this screen does not ask for. The account is then still on our servers, so the
//     message says so and gives the address that removes it by hand (privacy@zownhq.com).
//   - nobody is signed in to Firebase (a build with no Firebase keys, or the session already ended): there is nothing on the server to
//     remove, and that counts as removed.
//
// Everything is passed in, so the logic can be tested without Firebase.

export const PRIVACY_EMAIL = 'privacy@zownhq.com';

export const UNDERAGE_TITLE = 'ZOWN HQ is for ages 13 and up';

export const UNDERAGE_MESSAGES = {
  removed: 'You need to be 13 or older to use ZOWN HQ. We have removed the account you just made and nothing from it was kept.',
  failed: `You need to be 13 or older to use ZOWN HQ. We could not remove the account you just made from this screen, and you have been signed out. To have it removed, email ${PRIVACY_EMAIL} from the address you signed up with.`,
};

/**
 * @param {object} args
 *   auth          Firebase auth ({ currentUser })
 *   deleteAccount () => Promise   calls the deleteMyAccount Cloud Function
 *   endSession    () => Promise   signs out and clears everything on the phone (lib/logOut.js)
 * @returns {Promise<{ removed: boolean }>}  removed: the account is gone from our servers. Never throws.
 */
export async function removeUnderageAccount({ auth, deleteAccount, endSession }) {
  let removed = false;
  if (!auth || !auth.currentUser) {
    removed = true;
  } else {
    try {
      await deleteAccount();
      removed = true;
    } catch (e) {
      console.warn('[underageRemoval] could not remove the account:', e?.message);
    }
  }

  // Signed out and wiped either way: someone under 13 does not stay signed in to an account, and nothing of them stays on the phone.
  try {
    await endSession();
  } catch (e) {
    console.warn('[underageRemoval] could not clear the phone:', e?.message);
  }
  return { removed };
}

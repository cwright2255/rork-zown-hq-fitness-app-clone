// services/publicProfile.js
//
// The name and picture other people see on a person's posts, comments and messages. The rules (firestore.rules, publicName and
// publicImage) accept a post, a comment or a conversation only when the name and picture on it are the ones on the author's own
// profile, users/{uid}: `name` and `profileImage`. So just before the app writes one of those it calls ensurePublicProfile, which
//
//   1. reads the profile,
//   2. works out the name and picture to show (choosePublicProfile, below),
//   3. fills in what the profile does not have yet, and
//   4. gives back the name and picture to put on the post, comment or message.
//
// The name already on the profile wins over the one the screen has, so a post made from a screen that holds a different "display
// name" is still posted under the profile's name. The picture is the other way round: the screen's own picture (the sign-in photo or
// the default) wins, and is saved to the profile, because the profile never held one before this.
//
// Nothing here throws. If the profile cannot be read (offline), the name and picture the screen has are used as they are and the
// rules decide.
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { MAX_NAME_LENGTH, MAX_PICTURE_LENGTH } from '../lib/communityLimits';

export const DEFAULT_NAME = 'Zown User';

const isPictureAddress = (value) => typeof value === 'string' && /^https?:\/\//i.test(value) && value.length <= MAX_PICTURE_LENGTH;

/**
 * @param {object} stored  what users/{uid} holds ({ name?, profileImage? })
 * @param {object} given   what the screen has ({ name?, avatar? })
 * @returns {{ name: string, avatar: string|null, patch: object }} the name and picture to show, and the fields to save on the
 *          profile so the rules see the same ones (empty when it already holds them)
 */
export function choosePublicProfile(stored = {}, given = {}) {
  const patch = {};

  // The name on the profile, as it is: the rules compare with exactly that. Only when it has none is the screen's name used, and
  // then it is saved to the profile. A person with no name anywhere is shown as Zown User and nothing is saved.
  const storedName = typeof stored.name === 'string' && stored.name.length > 0 ? stored.name : '';
  let name = storedName;
  if (!name) {
    const givenName = typeof given.name === 'string' ? given.name.trim().slice(0, MAX_NAME_LENGTH) : '';
    if (givenName) {
      name = givenName;
      patch.name = givenName;
    }
  }
  if (!name) name = DEFAULT_NAME;

  const storedImage = typeof stored.profileImage === 'string' && stored.profileImage.length > 0 ? stored.profileImage : null;
  let avatar = storedImage;
  if (isPictureAddress(given.avatar)) {
    avatar = given.avatar;
    if (avatar !== storedImage) patch.profileImage = avatar;
  }

  return { name, avatar, patch };
}

/**
 * Brings the person's profile up to date for a post, comment or message about to be written, and returns what to put on it.
 * @param {string} uid
 * @param {object} given   the name and picture the screen has ({ name?, avatar? })
 * @returns {Promise<{ name: string, avatar: string|null }>}
 */
export async function ensurePublicProfile(uid, given = {}) {
  let stored = {};
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    stored = snap && snap.exists() ? (snap.data() || {}) : {};
  } catch (e) {
    // Cannot read the profile (offline): use what the screen has, without saving anything.
    const { name, avatar } = choosePublicProfile({}, given);
    return { name, avatar };
  }

  const { name, avatar, patch } = choosePublicProfile(stored, given);
  if (Object.keys(patch).length > 0) {
    try {
      await setDoc(doc(db, 'users', uid), patch, { merge: true });
    } catch (e) {
      console.warn('[publicProfile] could not save the name and picture:', e?.message);
    }
  }
  return { name, avatar };
}

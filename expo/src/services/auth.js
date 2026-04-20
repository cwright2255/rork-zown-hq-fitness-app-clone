import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile } from


'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export const signInWithEmail = async (
email,
password) =>
{
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUpWithEmail = async (
email,
password,
displayName) =>
{
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await setDoc(doc(db, 'users', result.user.uid), {
    uid: result.user.uid,
    email,
    displayName,
    fitnessLevel: 'beginner',
    goals: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return result;
};

export const signInWithGoogle = async () => {
  if (IS_EXPO_GO) {
    throw new Error(
      'Google Sign-In is not available in Expo Go. Please use email/password or build a dev client.'
    );
  }
  try {
    const GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    await GoogleSignin.hasPlayServices();
    const { idToken } = await GoogleSignin.signIn();
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
  } catch {
    throw new Error('Google Sign-In unavailable. Please use email/password login.');
  }
};

export const signInWithApple = async () => {
  if (IS_EXPO_GO) {
    throw new Error(
      'Apple Sign-In is not available in Expo Go. Please use email/password or build a dev client.'
    );
  }
  try {
    const appleAuth = require('@invertase/react-native-apple-authentication').default;
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME]
    });
    const { identityToken, nonce } = appleAuthRequestResponse;
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken, rawNonce: nonce });
    return signInWithCredential(auth, credential);
  } catch {
    throw new Error('Apple Sign-In unavailable. Please use email/password login.');
  }
};

export const sendPasswordReset = (email) =>
sendPasswordResetEmail(auth, email);

export const signOut = () => firebaseSignOut(auth);

export const onAuthStateChanged = (
callback) =>
firebaseOnAuthStateChanged(auth, callback);

export const getCurrentUser = () => auth.currentUser;
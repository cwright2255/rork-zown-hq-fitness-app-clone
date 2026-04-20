import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserProfile } from '../types/firestore';

const USERS_COLLECTION = 'users';

async function ensureUserProfile(
  user: User,
  extra?: Partial<UserProfile>,
): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const profile = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? extra?.displayName ?? '',
    photoURL: user.photoURL ?? extra?.photoURL ?? null,
    fitnessLevel: extra?.fitnessLevel ?? 'beginner',
    goals: extra?.goals ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, profile);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  await ensureUserProfile(cred.user, { displayName });
  return cred;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    // @ts-ignore - optional peer dependency, loaded only when installed in a native build
    const mod: any = await import('@react-native-google-signin/google-signin').catch(() => null);
    if (!mod?.GoogleSignin) {
      throw new Error(
        'Google Sign-In is not available in this build. Install @react-native-google-signin/google-signin and rebuild the app.',
      );
    }
    const { GoogleSignin } = mod;
    await GoogleSignin.hasPlayServices?.();
    const userInfo = await GoogleSignin.signIn();
    const idToken: string | undefined =
      userInfo?.idToken ?? userInfo?.data?.idToken;
    if (!idToken) throw new Error('Google Sign-In returned no idToken');
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    await ensureUserProfile(cred.user);
    return cred;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Google Sign-In failed');
  }
}

export async function signInWithApple(): Promise<UserCredential> {
  try {
    // @ts-ignore - optional peer dependency, loaded only when installed in a native build
    const mod: any = await import('@invertase/react-native-apple-authentication').catch(() => null);
    if (!mod?.appleAuth) {
      throw new Error(
        'Apple Sign-In is not available in this build. Install @invertase/react-native-apple-authentication and rebuild the app.',
      );
    }
    const { appleAuth } = mod;
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    const { identityToken, nonce } = response;
    if (!identityToken) throw new Error('Apple Sign-In returned no identityToken');
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken, rawNonce: nonce });
    const cred = await signInWithCredential(auth, credential);
    await ensureUserProfile(cred.user);
    return cred;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Apple Sign-In failed');
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// lib/logOut.js
//
// What "Log Out" does on the Profile page. It signs the person out of Firebase and clears the sign-in this phone kept (services/authService.js:
// the saved token and the Firebase session), then clears the saved profile and the "set up" flag (store/userStore.js). The app opens by looking
// for that saved token (app/index.jsx), so a log out that skips it sends the person straight back to Home the next time the app is opened.
//
// It finishes before the screen changes, so closing the app a moment after logging out cannot catch it half done. It never throws: each part
// is tried on its own, so one that fails does not stop the others.
import { authService } from '@/services/authService';
import { useUserStore } from '@/store/userStore';

export async function logOut() {
  try {
    await authService.logout();
  } catch (e) {
    console.warn('[logOut] could not clear the saved sign-in:', e?.message);
  }
  try {
    await useUserStore.getState().logout();
  } catch (e) {
    console.warn('[logOut] could not clear the saved profile:', e?.message);
  }
}

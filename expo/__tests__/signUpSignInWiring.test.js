// Where the sign-up and sign-in pieces are hooked in. The screens and the root layout are not rendered here (the root layout loads the whole
// app), so the hookups are read from the source, the way sessionWiring.test.js reads its. The logic is tested where it lives: ageGate.test.js,
// authGate.test.js, profileStatus.test.js, underageRemoval.test.js, IndexStartup.test.jsx, onboardingAge.test.jsx and LoginScreen.test.jsx.
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const importsOf = (src) => [...src.matchAll(/^import [^;]*? from '([^']+)';$/gm)].map((m) => m[1]).sort();

const layout = read('app/_layout.jsx');
const index = read('app/index.jsx');
const login = read('app/auth/login.jsx');
const onboarding = read('app/onboarding.jsx');
const gate = read('services/authGate.js');
const status = read('services/profileStatus.js');
const removal = read('services/underageRemoval.js');
const ageGate = read('lib/ageGate.js');

// The auth listener in the root layout, from onAuthStateChanged to the line that says the stores are ready.
const listener = layout.slice(layout.indexOf('onAuthStateChanged(auth'), layout.indexOf('setStoresReady(true);', layout.indexOf('onAuthStateChanged(auth')));
const signedInBranch = listener.slice(listener.indexOf('if (firebaseUser) {'), listener.indexOf('} else {'));
const signedOutBranch = listener.slice(listener.indexOf('} else {'));
const afterTheBranches = listener.slice(listener.indexOf('if (!firebaseUser && sawSignedIn)'));

describe('the root layout follows Firebase while the app is open', () => {
  it('imports the check from the gate, and the same clean-up Log Out uses', () => {
    expect(layout).toMatch(/import \{ handleSignedOut \} from '@\/services\/authGate';/);
    expect(layout).toMatch(/import \{ logOut \} from '@\/lib\/logOut';/);
  });

  it('notes that someone was signed in during this run', () => {
    expect(signedInBranch).toMatch(/sawSignedIn = true;/);
  });

  it('ends the session on a "signed out" report only after it has seen someone signed in during this run', () => {
    expect(layout).toMatch(/let sawSignedIn = false;\s+const unsubscribe = onAuthStateChanged\(auth,/);
    expect(afterTheBranches).toMatch(/^if \(!firebaseUser && sawSignedIn\) \{\s+sawSignedIn = false;\s+void handleSignedOut\(\{/);
  });

  it('runs that after the listeners are stopped, not instead of stopping them', () => {
    expect(signedOutBranch).toMatch(/stopXpSync\(\);\s*stopProgressSync\(\);/);
    expect(listener.indexOf('stopXpSync();')).toBeLessThan(listener.indexOf('handleSignedOut({'));
  });

  it('clears the phone with the same function Log Out uses, then opens the login screen', () => {
    expect(afterTheBranches).toMatch(/authService,\s+endSession: logOut,/);
    expect(afterTheBranches).toMatch(/router\.replace\('\/auth\/login'\)/);
  });
});

describe('the launch gate', () => {
  it('asks the gate, which follows Firebase, and no longer reads the saved token on its own', () => {
    expect(index).toMatch(/resolveLaunchSession\(\{\s+auth,\s+isFirebaseConfigured,\s+onAuthStateChanged,\s+authService,\s+endSession: logOut,\s+\}\)/);
    expect(index).not.toMatch(/await authService\.isAuthenticated\(\)/);
  });

  it('sends a signed-in person whose saved profile was not finished back to onboarding', () => {
    expect(index).toMatch(/fetchProfileComplete\(uid\)/);
    expect(index).toMatch(/profile === 'incomplete'\) \{\s+return <Redirect href="\/onboarding" \/>;/);
  });
});

describe('signing in with an email', () => {
  it('marks onboarding done only when the saved profile is complete', () => {
    expect(login).toMatch(/const finished = await fetchProfileComplete\(result\.user\.uid\);/);
    expect(login).toMatch(/if \(finished === false\) \{\s+router\.replace\('\/onboarding'\);\s+\} else \{\s+useUserStore\.getState\(\)\.completeOnboarding\(\);/);
  });
});

describe('onboarding', () => {
  it('no longer makes up a date of birth, a height or a weight', () => {
    expect(onboarding).not.toMatch(/1995-01-01/);
    expect(onboarding).not.toMatch(/\|\| ?175\b/);
    expect(onboarding).not.toMatch(/\|\| ?70\b/);
    expect(onboarding).not.toMatch(/\|\| ?150\b/);
    expect(onboarding).not.toMatch(/\|\| ?5\b/);
    expect(onboarding).not.toMatch(/\|\| ?7\b/);
  });

  it('asks the removal service to take away the account of someone under 13, with the function Settings uses', () => {
    expect(onboarding).toMatch(/httpsCallable\(functions, 'deleteMyAccount', \{ timeout: 540000 \}\)\(\{\}\)/);
    expect(onboarding).toMatch(/endSession: logOut,/);
  });
});

describe('the new modules stand alone', () => {
  it('keep Firebase out of the logic: the gate and the age check import nothing, the removal service imports nothing', () => {
    expect(importsOf(gate)).toEqual([]);
    expect(importsOf(ageGate)).toEqual([]);
    expect(importsOf(removal)).toEqual([]);
  });

  it('read the profile through the one Firestore document, and only read it', () => {
    expect(importsOf(status)).toEqual(['../src/config/firebase', 'firebase/firestore']);
    expect(status).toMatch(/import \{ doc, getDoc \} from 'firebase\/firestore';/);
    expect(status).not.toMatch(/setDoc|updateDoc|addDoc|deleteDoc/);
  });
});

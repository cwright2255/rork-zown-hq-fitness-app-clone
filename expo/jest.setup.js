jest.mock('expo-constants', () => ({
  appOwnership: 'standalone',
  expoConfig: { extra: { eas: { projectId: 'test' } } },
  easConfig: { projectId: 'test' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'test-token' })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4 },
}));

// The firebase mocks are registered as virtual (the package is installed all the same). A test that mocks one of these
// names with { virtual: true } would otherwise be ignored by any module an earlier test file had already loaded, and
// get the stand-in below instead of its own mock, on some runs and not others. __tests__/jestFirebaseMockOrder.test.js.
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}), { virtual: true });
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(() => () => undefined),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn() },
  OAuthProvider: jest.fn(function () { return { credential: jest.fn() }; }),
  signInWithCredential: jest.fn(),
}), { virtual: true });
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(() => () => undefined),
  serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('firebase/storage', () => ({ getStorage: jest.fn() }), { virtual: true });
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}), { virtual: true });

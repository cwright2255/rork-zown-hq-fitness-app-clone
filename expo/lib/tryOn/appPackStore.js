// lib/tryOn/appPackStore.js
//
// The one pack store the app uses: files kept in the phone's document folder, downloaded from private Firebase Storage with the signed-in person's
// token, checked against the manifest's fingerprints. Firebase and the phone's modules are loaded when the store is first asked for, so importing this
// file starts nothing.
import { createPackStore, firebaseFetchBytes } from './packStore';

const DEFAULT_BUCKET = 'zown-3c512.firebasestorage.app';
let store = null;

export function getAppPackStore() {
  if (!store) {
    const Crypto = require('expo-crypto');
    const fs = require('expo-file-system/legacy');
    const firebase = require('../../src/config/firebase');
    const bucket = (firebase.storage && firebase.storage.app && firebase.storage.app.options && firebase.storage.app.options.storageBucket)
      || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    store = createPackStore({
      fs,
      digest: (bytes) => Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes),
      fetchBytes: firebaseFetchBytes({
        bucket,
        getToken: async () => {
          const user = firebase.auth && firebase.auth.currentUser;
          return user ? user.getIdToken() : '';
        },
      }),
    });
  }
  return store;
}

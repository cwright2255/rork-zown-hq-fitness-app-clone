// The pack store as the app wires it (lib/tryOn/appPackStore.js): the phone's file system, expo-crypto, Firebase's sign-in and the network are made-up,
// but the made-up expo-crypto behaves like the phone's: its digest takes a typed array and throws on a bare ArrayBuffer ("Given argument is not an
// instance of TypedArray"), which is what stopped the Try-On on a real phone while the store's own tests (which pass any bytes to digest) were green.
import nodeCrypto from 'crypto';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(async (algorithm, data) => {
    if (!ArrayBuffer.isView(data)) throw new Error("FunctionCallException: Calling the 'digest' function has failed -> NotTypedArrayException: Given argument is not an instance of TypedArray");
    const h = require('crypto').createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest();
    return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength);
  }),
}));

jest.mock('expo-file-system/legacy', () => {
  const files = new Map();
  return {
    __files: files,
    documentDirectory: 'file:///docs/',
    makeDirectoryAsync: jest.fn(async () => {}),
    getInfoAsync: jest.fn(async (p) => ({ exists: files.has(p) })),
    readAsStringAsync: jest.fn(async (p) => files.get(p)),
    writeAsStringAsync: jest.fn(async (p, text) => { files.set(p, text); }),
    deleteAsync: jest.fn(async (p) => { files.delete(p); }),
  };
});

jest.mock('../src/config/firebase', () => ({
  auth: { currentUser: { getIdToken: jest.fn(async () => 'id-token-123') } },
  storage: { app: { options: { storageBucket: 'my-project.firebasestorage.app' } } },
}));

import { asTypedArray, getAppPackStore } from '../lib/tryOn/appPackStore';

const SIZING = Buffer.from('{"version":1,"garments":{}}');
const sha = (b) => nodeCrypto.createHash('sha256').update(b).digest('hex');
const MANIFEST = Buffer.from(JSON.stringify({ version: 1, files: { 'men/sizing.json': { bytes: SIZING.length, sha256: sha(SIZING) } } }));
const arrayBufferOf = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

beforeEach(() => {
  global.fetch = jest.fn(async (url) => {
    const body = url.includes('manifest.json') ? MANIFEST : url.includes('men%2Fsizing.json') ? SIZING : null;
    return body ? { ok: true, status: 200, arrayBuffer: async () => arrayBufferOf(body) } : { ok: false, status: 404, text: async () => 'not found' };
  });
});

describe('asTypedArray', () => {
  it('wraps a bare ArrayBuffer without copying it, and leaves a typed array alone', () => {
    const buffer = new ArrayBuffer(8);
    const wrapped = asTypedArray(buffer);
    expect(ArrayBuffer.isView(wrapped)).toBe(true);
    expect(wrapped.buffer).toBe(buffer);
    const typed = new Uint8Array(4);
    expect(asTypedArray(typed)).toBe(typed);
  });
});

describe('the app\'s pack store', () => {
  it('downloads a file with the sign-in token, checks its fingerprint with expo-crypto, and keeps it on the phone', async () => {
    const store = getAppPackStore();
    const buffer = await store.getFile('men/sizing.json');
    expect(Buffer.from(buffer).toString()).toBe(SIZING.toString());

    const urls = global.fetch.mock.calls.map((c) => c[0]);
    expect(urls).toContain('https://firebasestorage.googleapis.com/v0/b/my-project.firebasestorage.app/o/tryon-packs%2Fv1%2Fmen%2Fsizing.json?alt=media');
    expect(global.fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Firebase id-token-123' });

    const fs = require('expo-file-system/legacy');
    expect([...fs.__files.keys()].some((k) => k.endsWith('men__sizing.json.b64'))).toBe(true);
    // the second time it comes from the phone, with a fingerprint check and no download
    global.fetch.mockClear();
    await getAppPackStore().getFile('men/sizing.json');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

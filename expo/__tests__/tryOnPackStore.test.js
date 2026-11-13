// Getting the try-on's files from private storage and keeping them (lib/tryOn/packStore.js), with a made-up phone (an in-memory file system), a made-up
// network and the real SHA-256: a file is used only when it matches the manifest; it is downloaded once and then kept; a kept file that is damaged is
// downloaded again; and with no network a kept manifest and kept files still work.
import crypto from 'crypto';
import { createPackStore, firebaseFetchBytes, bytesToText, PackStoreError, PACK_ROOT } from '../lib/tryOn/packStore';

const bytesOf = (text) => Uint8Array.from(Buffer.from(text)).buffer;
const sha = (buffer) => crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
const digest = async (buffer) => { const h = crypto.createHash('sha256').update(Buffer.from(buffer)).digest(); return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength); };

const FILE_A = bytesOf('pack a: ' + 'x'.repeat(5000));
const FILE_B = bytesOf('{"version":1,"sizes":["S","M"]}');
const manifestFor = (files) => ({ version: 1, files: Object.fromEntries(Object.entries(files).map(([name, buf]) => [name, { bytes: buf.byteLength, sha256: sha(buf) }])) });
const SERVER = () => ({ 'men/shorts_M.zdp': FILE_A, 'men/sizing.json': FILE_B });

// An in-memory stand-in for expo-file-system's legacy API, holding base64 text like the real one.
function memoryFs() {
  const files = new Map();
  return {
    files,
    documentDirectory: 'file:///docs/',
    makeDirectoryAsync: jest.fn(async () => {}),
    getInfoAsync: jest.fn(async (p) => ({ exists: files.has(p) })),
    readAsStringAsync: jest.fn(async (p) => { if (!files.has(p)) throw new Error('missing'); return files.get(p); }),
    writeAsStringAsync: jest.fn(async (p, text) => { files.set(p, text); }),
    deleteAsync: jest.fn(async (p) => { files.delete(p); }),
  };
}

// A made-up network: serves SERVER() plus the manifest (or fails the way it is told to).
function network(overrides = {}) {
  const state = { files: SERVER(), manifest: null, fail: null, calls: [] };
  Object.assign(state, overrides);
  state.fetchBytes = jest.fn(async (rel) => {
    state.calls.push(rel);
    if (state.fail) throw state.fail;
    if (rel === 'manifest.json') return bytesOf(JSON.stringify(state.manifest || manifestFor(state.files)));
    if (!(rel in state.files)) { const e = new Error('nope'); e.status = 404; throw e; }
    return state.files[rel];
  });
  return state;
}

describe('getFile', () => {
  it('downloads a file the first time, checks it, and keeps it', async () => {
    const fs = memoryFs();
    const net = network();
    const store = createPackStore({ fs, digest, fetchBytes: net.fetchBytes });
    const onDownload = jest.fn();
    const buffer = await store.getFile('men/shorts_M.zdp', onDownload);
    expect(sha(buffer)).toBe(sha(FILE_A));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(net.calls).toEqual(['manifest.json', 'men/shorts_M.zdp']);
    expect([...fs.files.keys()].some((k) => k.includes('men__shorts_M.zdp'))).toBe(true);
    expect(fs.files.has(fs.documentDirectory + PACK_ROOT + 'manifest.json.b64')).toBe(true);
  });

  it('opens a kept file with no download, even in a new session, and with no network at all', async () => {
    const fs = memoryFs();
    const first = createPackStore({ fs, digest, fetchBytes: network().fetchBytes });
    await first.getFile('men/shorts_M.zdp');
    const offline = network({ fail: new Error('Network request failed') });
    const second = createPackStore({ fs, digest, fetchBytes: offline.fetchBytes });
    const onDownload = jest.fn();
    const buffer = await second.getFile('men/shorts_M.zdp', onDownload);
    expect(sha(buffer)).toBe(sha(FILE_A));
    expect(onDownload).not.toHaveBeenCalled();
  });

  it('asks the server for the manifest only once per session', async () => {
    const net = network();
    const store = createPackStore({ fs: memoryFs(), digest, fetchBytes: net.fetchBytes });
    await store.getFile('men/shorts_M.zdp');
    await store.getFile('men/sizing.json');
    expect(net.calls.filter((c) => c === 'manifest.json')).toHaveLength(1);
  });

  it('downloads a file once when it is asked for twice at the same time', async () => {
    const net = network();
    const store = createPackStore({ fs: memoryFs(), digest, fetchBytes: net.fetchBytes });
    const [a, b] = await Promise.all([store.getFile('men/shorts_M.zdp'), store.getFile('men/shorts_M.zdp')]);
    expect(sha(a)).toBe(sha(b));
    expect(net.calls.filter((c) => c === 'men/shorts_M.zdp')).toHaveLength(1);
  });

  it('throws away a kept file that no longer matches and downloads it again', async () => {
    const fs = memoryFs();
    const net = network();
    await createPackStore({ fs, digest, fetchBytes: net.fetchBytes }).getFile('men/shorts_M.zdp');
    const key = [...fs.files.keys()].find((k) => k.includes('men__shorts_M.zdp'));
    fs.files.set(key, Buffer.from('damaged').toString('base64'));
    const again = network();
    const onDownload = jest.fn();
    const buffer = await createPackStore({ fs, digest, fetchBytes: again.fetchBytes }).getFile('men/shorts_M.zdp', onDownload);
    expect(sha(buffer)).toBe(sha(FILE_A));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(fs.files.get(key)).toBe(Buffer.from(FILE_A).toString('base64'));
  });

  it('refuses a download that does not match the manifest, and keeps nothing', async () => {
    const fs = memoryFs();
    const net = network({ manifest: manifestFor({ 'men/shorts_M.zdp': bytesOf('something else entirely') }) });
    const store = createPackStore({ fs, digest, fetchBytes: net.fetchBytes });
    await expect(store.getFile('men/shorts_M.zdp')).rejects.toMatchObject({ name: 'PackStoreError', code: 'corrupt' });
    expect([...fs.files.keys()].some((k) => k.includes('men__shorts_M.zdp'))).toBe(false);
  });

  it('refuses a file that is not in the manifest', async () => {
    const store = createPackStore({ fs: memoryFs(), digest, fetchBytes: network().fetchBytes });
    await expect(store.getFile('men/jacket_M.zdp')).rejects.toMatchObject({ code: 'missing' });
  });

  it('says "offline" when nothing is kept and the network is down', async () => {
    const store = createPackStore({ fs: memoryFs(), digest, fetchBytes: network({ fail: new Error('Network request failed') }).fetchBytes });
    await expect(store.getFile('men/shorts_M.zdp')).rejects.toMatchObject({ code: 'offline' });
  });

  it('says "missing" when the server says the files are not there or not allowed (403, 404)', async () => {
    for (const status of [403, 404]) {
      const e = new Error('storage answered ' + status);
      e.status = status;
      const store = createPackStore({ fs: memoryFs(), digest, fetchBytes: network({ fail: e }).fetchBytes });
      await expect(store.getFile('men/shorts_M.zdp')).rejects.toBeInstanceOf(PackStoreError);
      await expect(store.getFile('men/shorts_M.zdp')).rejects.toMatchObject({ code: 'missing' });
    }
  });

  it('puts the server\'s answer in the "missing" message, and the cause in the "unavailable" one', async () => {
    const refused = new Error('storage answered 403, signed in');
    refused.status = 403;
    const a = createPackStore({ fs: memoryFs(), digest, fetchBytes: network({ fail: refused }).fetchBytes });
    await expect(a.getFile('men/shorts_M.zdp')).rejects.toThrow('manifest.json is not available (storage answered 403, signed in)');
    // a manifest that downloads but is not JSON: not a refusal, so it is "unavailable" and says why
    const b = createPackStore({ fs: memoryFs(), digest, fetchBytes: async () => new TextEncoder().encode('not json').buffer });
    await expect(b.getFile('men/shorts_M.zdp')).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('could not be listed: ') });
  });

  it('tries the manifest again next time after a failure, instead of remembering it', async () => {
    const net = network({ fail: new Error('Network request failed') });
    const store = createPackStore({ fs: memoryFs(), digest, fetchBytes: net.fetchBytes });
    await expect(store.getFile('men/shorts_M.zdp')).rejects.toMatchObject({ code: 'offline' });
    net.fail = null;
    expect(sha(await store.getFile('men/shorts_M.zdp'))).toBe(sha(FILE_A));
  });

  it('still works when the phone cannot keep files: it downloads every time', async () => {
    const net = network();
    const store = createPackStore({ fs: null, digest, fetchBytes: net.fetchBytes });
    expect(sha(await store.getFile('men/sizing.json'))).toBe(sha(FILE_B));
    expect(sha(await store.getFile('men/sizing.json'))).toBe(sha(FILE_B));
    expect(net.calls.filter((c) => c === 'men/sizing.json')).toHaveLength(2);
  });

  it('survives a phone that fails to write the file: the file is still returned', async () => {
    const fs = memoryFs();
    fs.writeAsStringAsync.mockRejectedValue(new Error('disk full'));
    const store = createPackStore({ fs, digest, fetchBytes: network().fetchBytes });
    expect(sha(await store.getFile('men/shorts_M.zdp'))).toBe(sha(FILE_A));
  });
});

describe('bytesToText', () => {
  it('reads plain text, including a long one', () => {
    expect(bytesToText(bytesOf('{"a":1}'))).toBe('{"a":1}');
    const long = 'y'.repeat(30000);
    expect(bytesToText(bytesOf(long))).toBe(long);
  });
});

describe('firebaseFetchBytes', () => {
  it('asks Firebase Storage for the object under tryon-packs/v1/ with the signed-in token', async () => {
    const fetchFn = jest.fn(async () => ({ ok: true, arrayBuffer: async () => FILE_B }));
    const get = firebaseFetchBytes({ bucket: 'my-project.firebasestorage.app', getToken: async () => 'tok123', fetchFn });
    expect(await get('men/sizing.json')).toBe(FILE_B);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://firebasestorage.googleapis.com/v0/b/my-project.firebasestorage.app/o/tryon-packs%2Fv1%2Fmen%2Fsizing.json?alt=media');
    expect(init.headers).toEqual({ Authorization: 'Firebase tok123' });
  });

  it('sends no token when nobody is signed in, and the server\'s refusal comes back as an error with its status', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 403 }));
    const get = firebaseFetchBytes({ bucket: 'b', getToken: async () => '', fetchFn });
    await expect(get('manifest.json')).rejects.toMatchObject({ status: 403 });
    expect(fetchFn.mock.calls[0][1].headers).toEqual({});
  });

  it('puts the file asked for and Storage\'s own words in the error', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 404, text: async () => '{\n  "error": {\n    "code": 404,\n    "message": "Not Found. Could not get object"\n  }\n}' }));
    await expect(firebaseFetchBytes({ bucket: 'my-bucket', getToken: async () => 'tok', fetchFn })('men/sizing.json')).rejects.toThrow(
      'storage answered 404, signed in for my-bucket/tryon-packs/v1/men/sizing.json: { "error": { "code": 404, "message": "Not Found. Could not get object" } }',
    );
  });

  it('still reports the refusal when Storage\'s answer cannot be read', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 403, text: async () => { throw new Error('body gone'); } }));
    await expect(firebaseFetchBytes({ bucket: 'b', getToken: async () => 'tok', fetchFn })('manifest.json')).rejects.toMatchObject({ status: 403 });
  });

  it('says in the error whether a sign-in token was sent, so a refusal can be told apart', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 403 }));
    await expect(firebaseFetchBytes({ bucket: 'b', getToken: async () => '', fetchFn })('manifest.json')).rejects.toThrow('storage answered 403, no sign-in token');
    await expect(firebaseFetchBytes({ bucket: 'b', getToken: async () => 'tok', fetchFn })('manifest.json')).rejects.toThrow('storage answered 403, signed in');
  });
});

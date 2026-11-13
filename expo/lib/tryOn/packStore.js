// lib/tryOn/packStore.js
//
// Gets the try-on's files (the drape packs and the sizing files) from private storage and keeps them on the phone. The files are in Firebase Storage
// under tryon-packs/v1/, readable only by a signed-in person and writable by nobody from the app (storage.rules). Each file is listed in manifest.json
// with its size and SHA-256 fingerprint; a file is used only if it matches, whether it was just downloaded or was kept from before, and a kept file that
// does not match is thrown away and downloaded again. After the first download a garment opens with no network. Everything that touches the phone or
// the network (the file system, the download, the fingerprint) is passed in, so the same code runs in the app and in tests.
import { arrayBufferToBase64, base64ToArrayBuffer } from '../meshCache';

export const PACK_ROOT = 'tryon-packs/v1/';
export const MANIFEST = 'manifest.json';

export class PackStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PackStoreError';
    this.code = code; // 'offline' | 'missing' | 'corrupt' | 'unavailable'
  }
}

const toHex = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  return s;
};

/** Text of a plain-ASCII file (the manifest and the sizing files are JSON written with escapes, so they are ASCII). */
export function bytesToText(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x2000) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + 0x2000)));
  return s;
}

/**
 * deps: { fs: expo-file-system (legacy API) or null, fetchBytes(path): Promise<ArrayBuffer> (path is relative to tryon-packs/v1/), digest(bytes): Promise<ArrayBuffer> (SHA-256) }
 * fetchBytes should throw an error with `status` for an answer from the server (403/404: not there or not allowed) and any other error for no network.
 */
export function createPackStore(deps) {
  const { fs, fetchBytes, digest } = deps;
  const dir = fs && fs.documentDirectory ? fs.documentDirectory + PACK_ROOT : null;
  let manifestPromise = null;
  const inFlight = new Map();

  const cachePath = (rel) => dir + rel.replace(/\//g, '__') + '.b64';
  const fingerprint = async (buffer) => toHex(await digest(buffer));

  async function ensureDir() {
    if (!dir) return false;
    try { await fs.makeDirectoryAsync(dir, { intermediates: true }); } catch (e) { /* it is already there */ }
    return true;
  }

  async function readCached(rel) {
    if (!dir) return null;
    try {
      const info = await fs.getInfoAsync(cachePath(rel));
      if (!info || !info.exists) return null;
      return base64ToArrayBuffer(await fs.readAsStringAsync(cachePath(rel), { encoding: 'base64' }));
    } catch (e) {
      return null;
    }
  }

  async function writeCached(rel, buffer) {
    if (!(await ensureDir())) return;
    try { await fs.writeAsStringAsync(cachePath(rel), arrayBufferToBase64(buffer), { encoding: 'base64' }); } catch (e) { /* not kept: it is downloaded again next time */ }
  }

  async function removeCached(rel) {
    if (!dir) return;
    try { await fs.deleteAsync(cachePath(rel), { idempotent: true }); } catch (e) { /* nothing to remove */ }
  }

  async function download(rel) {
    try {
      return await fetchBytes(rel);
    } catch (e) {
      const status = e && e.status;
      if (status === 401 || status === 403 || status === 404) throw new PackStoreError('missing', 'The try-on file ' + rel + ' is not available (' + (e.message || status) + ').');
      throw new PackStoreError('offline', 'The try-on file ' + rel + ' could not be downloaded: ' + (e && e.message ? e.message : 'no connection') + '.');
    }
  }

  /** The list of files and their fingerprints. Asks the server once per session, and falls back to the copy kept on the phone when there is no network. */
  function getManifest() {
    if (!manifestPromise) {
      manifestPromise = (async () => {
        let remote = null;
        let remoteError = null;
        try {
          const buffer = await download(MANIFEST);
          remote = JSON.parse(bytesToText(buffer));
          await writeCached(MANIFEST, buffer);
        } catch (e) {
          remoteError = e;
        }
        if (remote && remote.files) return remote;
        const kept = await readCached(MANIFEST);
        if (kept) {
          try {
            const parsed = JSON.parse(bytesToText(kept));
            if (parsed && parsed.files) return parsed;
          } catch (e) { /* the kept copy is unreadable */ }
        }
        if (remoteError instanceof PackStoreError) throw remoteError;
        throw new PackStoreError('unavailable', 'The try-on files could not be listed' + (remoteError && remoteError.message ? ': ' + remoteError.message : '') + '.');
      })();
      manifestPromise.catch(() => { manifestPromise = null; }); // try again next time instead of remembering a failure
    }
    return manifestPromise;
  }

  /** The file's bytes (ArrayBuffer), from the phone if a matching copy is kept there, otherwise downloaded, checked and kept. onDownload() is called when a download starts. */
  function getFile(rel, onDownload) {
    if (!inFlight.has(rel)) {
      const task = (async () => {
        const manifest = await getManifest();
        const entry = manifest.files[rel];
        if (!entry) throw new PackStoreError('missing', 'The try-on file ' + rel + ' is not in the list of files.');
        const kept = await readCached(rel);
        if (kept && kept.byteLength === entry.bytes && (await fingerprint(kept)) === entry.sha256) return kept;
        if (kept) await removeCached(rel);
        if (onDownload) onDownload();
        const buffer = await download(rel);
        if (buffer.byteLength !== entry.bytes || (await fingerprint(buffer)) !== entry.sha256) {
          throw new PackStoreError('corrupt', 'The try-on file ' + rel + ' did not match its fingerprint.');
        }
        await writeCached(rel, buffer);
        return buffer;
      })();
      inFlight.set(rel, task);
      const done = () => inFlight.delete(rel);
      task.then(done, done);
    }
    return inFlight.get(rel);
  }

  return { getManifest, getFile };
}

/**
 * The download for the app: one object under tryon-packs/v1/ in the project's Firebase Storage bucket, read with the signed-in person's token
 * (the storage rules let any signed-in person read it and nobody write). getToken(): the Firebase sign-in token ('' when nobody is signed in).
 */
export function firebaseFetchBytes({ bucket, getToken, fetchFn = (...a) => fetch(...a) }) {
  return async (rel) => {
    const token = await getToken();
    const url = 'https://firebasestorage.googleapis.com/v0/b/' + encodeURIComponent(bucket) + '/o/' + encodeURIComponent(PACK_ROOT + rel) + '?alt=media';
    const response = await fetchFn(url, { headers: token ? { Authorization: 'Firebase ' + token } : {} });
    if (!response.ok) {
      // Storage's own words for the refusal (a short JSON error), kept so a failure on a phone can be told apart from the screen alone.
      let said = '';
      try { said = typeof response.text === 'function' ? String(await response.text()).replace(/\s+/g, ' ').trim().slice(0, 160) : ''; } catch (e) { /* no body to read */ }
      const error = new Error('storage answered ' + response.status + (token ? ', signed in' : ', no sign-in token') + ' for ' + bucket + '/' + PACK_ROOT + rel + (said ? ': ' + said : ''));
      error.status = response.status;
      throw error;
    }
    return response.arrayBuffer();
  };
}

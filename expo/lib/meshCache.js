// lib/meshCache.js
//
// On-device cache for the detailed (Anny) body mesh, so a scan the user has
// already viewed opens instantly - including with no connection at all -
// instead of re-requesting it from the Cloud Run mesh service every time
// (which cold-starts for a minute or more after idle).
//
// The cache key is derived from exactly the inputs the service receives, so
// the same body parameters always map to the same file regardless of which
// scan id they came from, and any change to those inputs is automatically a
// cache miss. Every operation here is best-effort: a cache problem of any
// kind (missing native module, full disk, corrupt file) must never break
// mesh loading, it just means falling back to the network.

const CACHE_DIR_NAME = 'scan-meshes/';
const CACHE_VERSION = 'v1'; // bump if the service's mesh output ever changes
const MAX_CACHED_MESHES = 8;

export function buildCacheKey(params) {
  const canonical = JSON.stringify([
    params.height_cm ?? null,
    params.weight_kg ?? null,
    params.gender ?? null,
    params.body_fat_percent ?? null,
    params.waist_cm ?? null,
    params.hip_cm ?? null,
  ]);
  // djb2 - not security-sensitive, just a short stable filename.
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) ^ h2 ^ c) | 0;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return `${CACHE_VERSION}-${hex(h1)}${hex(h2)}.glb.b64`;
}

export function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

export function base64ToArrayBuffer(b64) {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  // eslint-disable-next-line no-undef
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// getFs() resolves to an expo-file-system-legacy-shaped module. Injected so
// the logic is testable outside React Native.
export function createMeshCache(getFs) {
  async function dirAndFs() {
    const fs = await getFs();
    if (!fs || !fs.documentDirectory) return null;
    return { fs, dir: fs.documentDirectory + CACHE_DIR_NAME };
  }

  async function read(key) {
    try {
      const ctx = await dirAndFs();
      if (!ctx) return null;
      const { fs, dir } = ctx;
      const path = dir + key;
      const info = await fs.getInfoAsync(path);
      if (!info.exists) return null;
      const b64 = await fs.readAsStringAsync(path, { encoding: 'base64' });
      if (!b64) return null;
      return base64ToArrayBuffer(b64);
    } catch (e) {
      return null;
    }
  }

  async function remove(key) {
    try {
      const ctx = await dirAndFs();
      if (!ctx) return;
      await ctx.fs.deleteAsync(ctx.dir + key, { idempotent: true });
    } catch (e) {
      // best-effort
    }
  }

  async function prune(fs, dir) {
    const names = await fs.readDirectoryAsync(dir);
    if (names.length <= MAX_CACHED_MESHES) return;
    const withTimes = await Promise.all(
      names.map(async (name) => {
        const info = await fs.getInfoAsync(dir + name);
        return { name, t: info.modificationTime || 0 };
      })
    );
    withTimes.sort((a, b) => a.t - b.t); // oldest first
    const excess = withTimes.slice(0, withTimes.length - MAX_CACHED_MESHES);
    await Promise.all(excess.map((f) => fs.deleteAsync(dir + f.name, { idempotent: true })));
  }

  async function write(key, arrayBuffer) {
    try {
      const ctx = await dirAndFs();
      if (!ctx) return;
      const { fs, dir } = ctx;
      await fs.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const finalPath = dir + key;
      const tmpPath = finalPath + '.tmp';
      // Write to a temp file then move into place, so an interrupted write
      // can never leave a truncated file that later reads as a valid mesh.
      await fs.writeAsStringAsync(tmpPath, arrayBufferToBase64(arrayBuffer), { encoding: 'base64' });
      await fs.deleteAsync(finalPath, { idempotent: true });
      await fs.moveAsync({ from: tmpPath, to: finalPath });
      await prune(fs, dir).catch(() => {});
    } catch (e) {
      // best-effort
    }
  }

  return { read, write, remove };
}

// Production instance: lazily imports the native module so a missing or
// failing module only disables caching instead of breaking the screen.
export const meshCache = createMeshCache(async () => {
  try {
    return await import('expo-file-system/legacy');
  } catch (e) {
    return null;
  }
});

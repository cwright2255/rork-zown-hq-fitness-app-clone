import { createMeshCache } from '../lib/meshCache';

// A tiny in-memory stand-in for the phone's file system.
const makeFs = () => {
  const files = new Map();
  const fs = {
    documentDirectory: 'file:///docs/',
    files,
    getInfoAsync: jest.fn(async (path) => ({ exists: files.has(path) || [...files.keys()].some((k) => k.startsWith(path)), modificationTime: 1 })),
    makeDirectoryAsync: jest.fn(async () => {}),
    writeAsStringAsync: jest.fn(async (path, data) => { files.set(path, data); }),
    readAsStringAsync: jest.fn(async (path) => files.get(path)),
    readDirectoryAsync: jest.fn(async (dir) => [...files.keys()].filter((k) => k.startsWith(dir)).map((k) => k.slice(dir.length))),
    moveAsync: jest.fn(async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); }),
    // like the real thing: a file path removes that file; a folder path (ends in /) removes what is inside
    deleteAsync: jest.fn(async (path) => { for (const k of [...files.keys()]) if (k === path || (path.endsWith('/') && k.startsWith(path))) files.delete(k); }),
  };
  return fs;
};

const buffer = (text) => Uint8Array.from(Buffer.from(text)).buffer;

describe('mesh cache', () => {
  it('keeps a saved mesh and hands it back', async () => {
    const fs = makeFs();
    const cache = createMeshCache(async () => fs);
    await cache.write('a', buffer('hello'));
    const back = await cache.read('a');
    expect(Buffer.from(back).toString()).toBe('hello');
  });

  it('clear() removes every saved mesh and leaves nothing to read', async () => {
    const fs = makeFs();
    const cache = createMeshCache(async () => fs);
    await cache.write('a', buffer('one'));
    await cache.write('b', buffer('two'));
    await cache.clear();
    expect(fs.files.size).toBe(0);
    await expect(cache.read('a')).resolves.toBeNull();
    await expect(cache.read('b')).resolves.toBeNull();
  });

  it('clear() deletes only the mesh folder, not the rest of the documents directory', async () => {
    const fs = makeFs();
    const cache = createMeshCache(async () => fs);
    await cache.write('a', buffer('one'));
    fs.files.set('file:///docs/something-else.json', '{}');
    await cache.clear();
    expect(fs.files.has('file:///docs/something-else.json')).toBe(true);
    const target = fs.deleteAsync.mock.calls.at(-1)[0];
    expect(target.startsWith('file:///docs/')).toBe(true);
    expect(target).not.toBe('file:///docs/');
  });

  it('clear() works when nothing was ever saved, and when the file system is not available', async () => {
    await expect(createMeshCache(async () => makeFs()).clear()).resolves.toBeUndefined();
    await expect(createMeshCache(async () => null).clear()).resolves.toBeUndefined();
    await expect(createMeshCache(async () => ({ documentDirectory: null })).clear()).resolves.toBeUndefined();
  });

  it('clear() never throws, even if the file system fails', async () => {
    const fs = makeFs();
    fs.deleteAsync = jest.fn(async () => { throw new Error('disk error'); });
    await expect(createMeshCache(async () => fs).clear()).resolves.toBeUndefined();
  });
});

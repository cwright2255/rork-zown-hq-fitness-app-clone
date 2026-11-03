// The app's side of the 3D body mesh (lib/loadScanMesh.js): the request to the mesh service carries the person's sign-in token, a mesh
// already on the phone is used with no request and no token, and any failure of the request falls back to the local mesh. The service
// itself is checked by anny-service/test_token_guard.py and, for what CI can read, __tests__/annyServiceWiring.test.js.
// Three.js and the mesh helpers are replaced by small stand-ins.

jest.mock('three', () => {
  class Box3 { setFromObject() { return { min: { y: 0 }, max: { y: 2 } }; } }
  class MeshStandardMaterial { constructor(options) { Object.assign(this, options); } }
  class Mesh {
    constructor(geometry, material) { this.geometry = geometry; this.material = material; this.rotation = { x: 0 }; this.position = { y: 0 }; }
    updateMatrixWorld() {}
  }
  return { Box3, MeshStandardMaterial, Mesh };
});
jest.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    parse(buffer, path, ok) {
      const mesh = { isMesh: true, geometry: { computeBoundingBox() {} }, rotation: { x: 0 }, position: { y: 0 }, updateMatrixWorld() {} };
      ok({ scene: { traverse: (visit) => visit(mesh) } });
    }
  },
}));
const mockBuildBodyMesh = jest.fn(() => ({ computeBoundingBox() {} }));
jest.mock('@/lib/bodyMeshBuilder', () => ({ buildBodyMesh: (...args) => mockBuildBodyMesh(...args) }));
jest.mock('@/lib/applySkeletonToMesh', () => ({ buildSkinnedBodyMesh: jest.fn() }));
const mockCache = { read: jest.fn(), write: jest.fn(), remove: jest.fn() };
// The factory runs while the imports below load, before mockCache above is set, so the cache is reached through functions.
jest.mock('@/lib/meshCache', () => ({
  buildCacheKey: () => 'key',
  meshCache: {
    read: (...args) => mockCache.read(...args),
    write: (...args) => mockCache.write(...args),
    remove: (...args) => mockCache.remove(...args),
  },
}));
const mockSignInHeader = jest.fn();
jest.mock('@/lib/signInHeader', () => ({ signInHeader: (...args) => mockSignInHeader(...args) }));

import { loadScanMesh } from '../lib/loadScanMesh';

const SERVICE = 'https://anny-mesh-service-431690627943.us-central1.run.app/generate-mesh';
const scan = { heightCm: 180, weightKg: 80, gender: 'male', bodyFatPercent: 18 };

beforeEach(() => {
  mockSignInHeader.mockReset();
  mockSignInHeader.mockResolvedValue({ Authorization: 'Bearer token-abc' });
  mockBuildBodyMesh.mockClear();
  mockCache.read.mockReset();
  mockCache.read.mockResolvedValue(null);
  mockCache.write.mockReset();
  mockCache.remove.mockReset();
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('body mesh: the request to the mesh service', () => {
  it('carries the person\'s sign-in token with the body measurements, and the mesh it gets back is used', async () => {
    const result = await loadScanMesh(scan);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [address, options] = global.fetch.mock.calls[0];
    expect(address).toBe(SERVICE);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-abc' });
    expect(JSON.parse(options.body)).toMatchObject({ height_cm: 180, weight_kg: 80, gender: 'male', body_fat_percent: 18 });
    expect(result.usedHighQualityMesh).toBe(true);
    expect(mockBuildBodyMesh).not.toHaveBeenCalled();
  });

  it('asks for the token only when it is going to the network: a mesh already on the phone needs neither', async () => {
    mockCache.read.mockResolvedValue(new ArrayBuffer(8));
    const result = await loadScanMesh(scan);
    expect(result.usedHighQualityMesh).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSignInHeader).not.toHaveBeenCalled();
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    mockSignInHeader.mockResolvedValue({});
    await loadScanMesh(scan);
    expect(global.fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('body mesh: when the request fails, the local mesh is used', () => {
  it('falls back when the service refuses the token', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"detail":"Sign in to build the 3D body."}' });
    const result = await loadScanMesh(scan);
    expect(result.usedHighQualityMesh).toBe(false);
    expect(mockBuildBodyMesh).toHaveBeenCalledTimes(1);
    expect(mockCache.write).not.toHaveBeenCalled();
  });

  it('falls back, without sending anything, when the token cannot be read', async () => {
    mockSignInHeader.mockRejectedValue(new Error('auth/network-request-failed'));
    const result = await loadScanMesh(scan);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.usedHighQualityMesh).toBe(false);
    expect(mockBuildBodyMesh).toHaveBeenCalledTimes(1);
  });
});

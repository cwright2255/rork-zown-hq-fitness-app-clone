// The graphics part of the try-on runtime test (lib/tryOnSpike/runGlTest.js). three.js is real; the phone's graphics chip, frame timer, picture opener
// and clock are stand-ins. What matters here: it draws what it says it draws, it times what it says it times, and it gives back everything it made
// (a graphics buffer that is never released stays in the phone's memory until the app is closed).
const THREE = require('three');
const { runGlTest, SWAPS, SPIN_MS, TEXTURES, TEXTURE_SIZE } = require('../lib/tryOnSpike/runGlTest');
const { makeStandInGarment, withComponents } = require('../lib/tryOnSpike/standInGarment');

const garment = withComponents(makeStandInGarment({ around: 12, rings: 8, components: 16 }), 16);

// A clock that moves 4 ms every time it is read, so a 100 ms "spin" is a few dozen frames.
const clock = () => { let t = 0; return () => { t += 4; return t; }; };
// A frame timer that calls back right away (on a later turn of the event loop, like the real one).
const frameTimer = () => {
  let id = 0;
  return { frame: jest.fn((cb) => { id += 1; setTimeout(cb, 0); return id; }) };
};

const setup = (overrides = {}) => {
  const timer = frameTimer();
  const renders = [];
  const renderer = { render: jest.fn((scene) => renders.push(scene)), dispose: jest.fn() };
  const gl = { drawingBufferWidth: 300, drawingBufferHeight: 600, endFrameEXP: jest.fn() };
  const textures = [];
  const deps = {
    THREE,
    gl,
    createRenderer: jest.fn(() => renderer),
    loadTexture: jest.fn(async () => { const t = new THREE.Texture(); t.dispose = jest.fn(); textures.push(t); return t; }),
    textureAsset: 'stand-in-asset',
    now: clock(),
    frame: timer.frame,
    isCancelled: () => false,
    onStep: jest.fn(),
    ...overrides,
  };
  return { deps, renderer, gl, textures, renders, timer };
};
const options = { spinMs: 100, swaps: 5 };

describe('a full run', () => {
  it('opens the two pictures, draws a first frame, turns the garment, and swaps it to the number of bodies asked for', async () => {
    const { deps, renderer, gl, textures } = setup();
    const r = await runGlTest(deps, garment, null, options);
    expect(deps.loadTexture).toHaveBeenCalledTimes(TEXTURES);
    expect(deps.loadTexture).toHaveBeenCalledWith('stand-in-asset');
    expect(textures).toHaveLength(2);
    expect(r.textures.totalMs).toBeCloseTo(r.textures.firstMs + r.textures.secondMs, 0);
    expect(r.firstFrameMs).toBeGreaterThan(0);
    expect(r.spin.frames).toBeGreaterThan(5);
    expect(r.swaps.blend.n).toBe(5);
    expect(r.swaps.normals.n).toBe(5);
    expect(r.swaps.draw.n).toBe(5);
    // every picture drawn is handed to the phone's screen
    expect(gl.endFrameEXP).toHaveBeenCalledTimes(renderer.render.mock.calls.length);
    expect(renderer.render.mock.calls.length).toBe(1 + r.spin.frames + 5);
  });

  it('defaults to a 3 second turn, ten swaps, and two pictures of 2048 x 2048', () => {
    expect(SPIN_MS).toBe(3000);
    expect(SWAPS).toBe(10);
    expect(TEXTURES).toBe(2);
    expect(TEXTURE_SIZE).toBe(2048);
  });

  it('says what it is doing at each stage', async () => {
    const { deps } = setup();
    await runGlTest(deps, garment, null, options);
    const said = deps.onStep.mock.calls.map((c) => c[0]).join(' | ');
    expect(said).toMatch(/Opening two 2048 x 2048 pictures/);
    expect(said).toMatch(/first frame/);
    expect(said).toMatch(/Turning the garment/);
    expect(said).toMatch(/Swapping the garment to 5 different bodies/);
  });

  it('puts the two pictures on the garment (the colour and the surface texture), with the stand-in\'s own points', async () => {
    const { deps, renders, textures } = setup();
    await runGlTest(deps, garment, null, options);
    const scene = renders[0];
    const group = scene.children.find((c) => c.isGroup);
    const mesh = group.children.find((c) => c.isMesh);
    expect(mesh.material.map).toBe(textures[0]);
    expect(mesh.material.normalMap).toBe(textures[1]);
    expect(mesh.geometry.getAttribute('position').count).toBe(garment.vertexCount);
    expect(mesh.geometry.getAttribute('uv').count).toBe(garment.vertexCount);
    expect(mesh.geometry.index.count).toBe(garment.triangleCount * 3);
  });

  it('keeps its own copy of the points, so the stand-in garment itself is never changed by a swap', async () => {
    const { deps } = setup();
    const before = Buffer.from(garment.mean.buffer, garment.mean.byteOffset, garment.mean.byteLength).toString('base64');
    await runGlTest(deps, garment, null, options);
    expect(Buffer.from(garment.mean.buffer, garment.mean.byteOffset, garment.mean.byteLength).toString('base64')).toBe(before);
  });

  it('really moves the points and the surface directions on each swap, and flags both for upload', async () => {
    const { deps } = setup();
    const seen = [];
    deps.createRenderer = jest.fn(() => ({
      render: jest.fn((scene) => {
        const mesh = scene.children.find((c) => c.isGroup).children.find((c) => c.isMesh);
        const pos = mesh.geometry.getAttribute('position');
        const nor = mesh.geometry.getAttribute('normal');
        seen.push({ point: pos.array[3], posVersion: pos.version, direction: nor.array[4], norVersion: nor.version });
      }),
      dispose: jest.fn(),
    }));
    await runGlTest(deps, garment, null, options);
    const swaps = seen.slice(-5);
    expect(new Set(swaps.map((x) => x.point)).size).toBeGreaterThan(1);
    expect(new Set(swaps.map((x) => x.direction)).size).toBeGreaterThan(1);
    expect(seen[seen.length - 1].posVersion).toBeGreaterThan(seen[0].posVersion);
    expect(seen[seen.length - 1].norVersion).toBeGreaterThan(seen[0].norVersion);
  });

  it('turns the garment while it counts frames', async () => {
    const { deps, renders } = setup();
    const turns = [];
    deps.createRenderer = jest.fn(() => ({ render: jest.fn((scene) => turns.push(scene.children.find((c) => c.isGroup).rotation.y)), dispose: jest.fn() }));
    await runGlTest(deps, garment, null, options);
    expect(turns[turns.length - 1]).toBeGreaterThan(turns[0]);
    void renders;
  });

  it('puts the garment in the middle when there is no body, and beside the body when there is one', async () => {
    const alone = setup();
    await runGlTest(alone.deps, garment, null, options);
    const x = (renders) => renders[0].children.find((c) => c.isGroup).children.find((c) => c.isMesh).position.x;
    expect(x(alone.renders)).toBe(0);
    const withBody = setup();
    const object = new THREE.Object3D();
    await runGlTest(withBody.deps, garment, { object, dispose: jest.fn() }, options);
    expect(x(withBody.renders)).toBeGreaterThan(0.3);
    expect(withBody.renders[0].children.find((c) => c.isGroup).children).toContain(object);
  });
});

describe('giving back what it made', () => {
  let geometryDispose; let materialDispose;
  beforeEach(() => {
    geometryDispose = jest.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    materialDispose = jest.spyOn(THREE.MeshStandardMaterial.prototype, 'dispose');
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('releases the geometry, the material, both pictures, the renderer and the body after a full run', async () => {
    const { deps, renderer, textures } = setup();
    const body = { object: new THREE.Object3D(), dispose: jest.fn() };
    await runGlTest(deps, garment, body, options);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    textures.forEach((t) => expect(t.dispose).toHaveBeenCalledTimes(1));
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(body.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases them when the screen is closed part way through, and says it was stopped', async () => {
    let calls = 0;
    const { deps, renderer, textures } = setup({ isCancelled: () => (calls += 1) > 6 });
    const body = { object: new THREE.Object3D(), dispose: jest.fn() };
    const r = await runGlTest(deps, garment, body, options);
    expect(r).toEqual({ cancelled: true });
    expect(renderer.render.mock.calls.length).toBeLessThan(10); // it stopped turning at once, it did not finish the turn first
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    textures.forEach((t) => expect(t.dispose).toHaveBeenCalledTimes(1));
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(body.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases what it had and passes the error on when a picture cannot be opened', async () => {
    const { deps, renderer, textures } = setup();
    let n = 0;
    deps.loadTexture = jest.fn(async () => {
      n += 1;
      if (n === 2) throw new Error('could not decode the picture');
      const t = new THREE.Texture(); t.dispose = jest.fn(); textures.push(t); return t;
    });
    const body = { object: new THREE.Object3D(), dispose: jest.fn() };
    await expect(runGlTest(deps, garment, body, options)).rejects.toThrow(/could not decode/);
    expect(textures).toHaveLength(1);
    expect(textures[0].dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(body.dispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled(); // none was made yet
  });

  it('releases what it had when drawing throws', async () => {
    const { deps, textures } = setup();
    const renderer = { render: jest.fn(() => { throw new Error('GL lost'); }), dispose: jest.fn() };
    deps.createRenderer = () => renderer;
    await expect(runGlTest(deps, garment, null, options)).rejects.toThrow(/GL lost/);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    textures.forEach((t) => expect(t.dispose).toHaveBeenCalledTimes(1));
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('still finishes when releasing something throws', async () => {
    const { deps, renderer } = setup();
    renderer.dispose = jest.fn(() => { throw new Error('already gone'); });
    const body = { object: new THREE.Object3D(), dispose: jest.fn(() => { throw new Error('already gone'); }) };
    await expect(runGlTest(deps, garment, body, options)).resolves.toHaveProperty('swaps');
  });

  it('works with a renderer that has no dispose', async () => {
    const { deps } = setup();
    deps.createRenderer = () => ({ render: jest.fn() });
    await expect(runGlTest(deps, garment, null, options)).resolves.toHaveProperty('textures');
  });
});

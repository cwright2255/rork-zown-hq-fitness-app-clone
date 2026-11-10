// lib/tryOnSpike/runGlTest.js
//
// The graphics part of the try-on runtime test, on the same stack the body scan viewer uses (expo-gl, three.js, expo-three): opens two 2048 x 2048
// pictures, draws the stand-in garment with them, turns it for a few seconds while counting frames, then swaps the garment to ten different "bodies"
// (blend, surface directions, upload, draw) and times each step. Anything that touches the phone (the clock, the frame timer, the picture opener, the
// renderer) is passed in so the same code runs in tests with stand-ins.
import { blendInto, normalsInto, sampleWeights } from './blend';
import { summarize, frameSummary, decodedTextureMB } from './stats';

export const SPIN_MS = 3000;
export const SWAPS = 10;
export const TEXTURE_SIZE = 2048;
export const TEXTURES = 2;

/**
 * deps: { THREE, gl, createRenderer(gl), loadTexture(asset): Promise<Texture>, textureAsset, now(), frame(cb), isCancelled(), onStep(text) }
 * garment: from makeStandInGarment (the blend uses all of its shape changes). body: optional { object, dispose() } that is added to the scene.
 * Returns { cancelled } or { textures, firstFrameMs, spin, swaps }. Everything it made is released before it returns, even when it fails.
 */
export async function runGlTest(deps, garment, body = null, options = {}) {
  const { THREE, gl, createRenderer, loadTexture, textureAsset, now, frame, isCancelled = () => false, onStep = () => {} } = deps;
  const spinMs = options.spinMs ?? SPIN_MS;
  const swaps = options.swaps ?? SWAPS;
  const made = { geometry: null, material: null, textures: [], renderer: null };

  const nextFrame = () => new Promise((resolve) => { frame(resolve); });
  try {
    const renderer = createRenderer(gl);
    made.renderer = renderer;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    camera.position.set(0, 0.2, 2.4);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 2);
    scene.add(key);

    const group = new THREE.Group();
    scene.add(group);
    if (body && body.object) group.add(body.object);

    onStep('Opening two 2048 x 2048 pictures...');
    const textureTimes = [];
    for (let i = 0; i < TEXTURES; i++) {
      const t0 = now();
      const texture = await loadTexture(textureAsset);
      textureTimes.push(now() - t0);
      made.textures.push(texture);
      if (isCancelled()) return { cancelled: true };
    }

    const positions = new Float32Array(garment.mean);
    const normals = new Float32Array(garment.mean.length);
    normalsInto(normals, positions, garment.indices);
    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    const normalAttribute = new THREE.BufferAttribute(normals, 3);
    normalAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('normal', normalAttribute);
    geometry.setAttribute('uv', new THREE.BufferAttribute(garment.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(garment.indices, 1));
    made.geometry = geometry;
    const material = new THREE.MeshStandardMaterial({ map: made.textures[0], normalMap: made.textures[1], roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    made.material = material;
    const garmentMesh = new THREE.Mesh(geometry, material);
    garmentMesh.position.set(body && body.object ? 0.55 : 0, -0.25, 0);
    group.add(garmentMesh);

    onStep('Drawing the first frame...');
    const f0 = now();
    renderer.render(scene, camera);
    gl.endFrameEXP();
    const firstFrameMs = now() - f0;
    await nextFrame();

    onStep('Turning the garment for ' + Math.round(spinMs / 1000) + ' seconds...');
    const frameTimes = [];
    const spinStart = now();
    while (now() - spinStart < spinMs) {
      await nextFrame();
      if (isCancelled()) return { cancelled: true };
      group.rotation.y += 0.02;
      renderer.render(scene, camera);
      gl.endFrameEXP();
      frameTimes.push(now());
    }

    onStep('Swapping the garment to ' + swaps + ' different bodies...');
    const blendMs = [];
    const normalsMs = [];
    const drawMs = [];
    for (let i = 0; i < swaps; i++) {
      const weights = sampleWeights(garment.components, i + 1);
      const a = now();
      blendInto(positions, garment.mean, garment.basis, weights);
      const b = now();
      normalsInto(normals, positions, garment.indices);
      const c = now();
      positionAttribute.needsUpdate = true;
      normalAttribute.needsUpdate = true;
      renderer.render(scene, camera);
      gl.endFrameEXP();
      const d = now();
      blendMs.push(b - a); normalsMs.push(c - b); drawMs.push(d - c);
      await nextFrame();
      if (isCancelled()) return { cancelled: true };
    }

    return {
      textures: {
        firstMs: Math.round(textureTimes[0] * 10) / 10,
        secondMs: Math.round(textureTimes[1] * 10) / 10,
        totalMs: Math.round((textureTimes[0] + textureTimes[1]) * 10) / 10,
        decodedMB: Math.round(decodedTextureMB(TEXTURE_SIZE, TEXTURE_SIZE) * TEXTURES * 10) / 10,
      },
      firstFrameMs: Math.round(firstFrameMs * 10) / 10,
      spin: frameSummary(frameTimes),
      swaps: { blend: summarize(blendMs), normals: summarize(normalsMs), draw: summarize(drawMs) },
    };
  } finally {
    release(made);
    if (body && body.dispose) { try { body.dispose(); } catch (e) { /* already released */ } }
  }
}

function release(made) {
  const safe = (fn) => { try { fn(); } catch (e) { /* releasing is best effort */ } };
  if (made.geometry) safe(() => made.geometry.dispose());
  if (made.material) safe(() => made.material.dispose());
  made.textures.forEach((t) => safe(() => t.dispose()));
  if (made.renderer && made.renderer.dispose) safe(() => made.renderer.dispose());
}

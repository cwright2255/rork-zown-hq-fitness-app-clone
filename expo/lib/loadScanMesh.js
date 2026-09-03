// lib/loadScanMesh.js
//
// Shared mesh-loading pipeline, extracted from app/body-scan/[id].jsx so
// the compare screen (app/body-scan/compare.jsx) can build the exact same
// mesh two scans need without forking this logic - in particular the
// -Math.PI/2 rotation fix (Anny's raw output has its long axis on Z, not
// Y - see the debugging session that found this) and the high-quality/
// procedural-fallback try/catch chain. A silent fork here risks one path
// getting a future fix the other doesn't.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildBodyMesh } from '@/lib/bodyMeshBuilder';
import { buildSkinnedBodyMesh } from '@/lib/applySkeletonToMesh';

const MANNEQUIN_GRAY = '#9CA3AF';
const ANNY_SERVICE_URL = 'https://anny-mesh-service-431690627943.us-central1.run.app/generate-mesh';
const ANNY_REQUEST_TIMEOUT_MS = 120000;

const REFERENCE_RIG_BUNDLED = false;
const getReferenceRigUri = REFERENCE_RIG_BUNDLED
  ? () => Promise.resolve(null)
  : () => Promise.resolve(null);

async function loadHighQualityMesh(scan) {
  if (!scan.heightCm || !scan.gender) {
    throw new Error('Missing height or gender - required for high-quality mesh generation.');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANNY_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(ANNY_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        height_cm: scan.heightCm,
        weight_kg: scan.weightKg ?? undefined,
        gender: scan.gender,
        body_fat_percent: scan.bodyFatPercent ?? undefined,
        waist_cm: scan.measurements?.waistCircumferenceCm ?? undefined,
        hip_cm: scan.measurements?.hipCircumferenceCm ?? undefined,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error('Anny service returned ' + response.status + ': ' + detail.slice(0, 200));
  }
  const arrayBuffer = await response.arrayBuffer();
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
  let mesh = null;
  gltf.scene.traverse((child) => {
    if (child.isMesh && !mesh) mesh = child;
  });
  if (!mesh) {
    throw new Error('Anny service response contained no mesh.');
  }
  return mesh;
}

// Returns { displayObject, geometry, material, usedHighQualityMesh } -
// ready to add directly to a THREE.Group. Caller owns scene/group setup
// and is responsible for pushing geometry/material onto its own disposal
// list (this function doesn't know about the caller's cleanup lifecycle).
export async function loadScanMesh(scan) {
  let geometry;
  let material;
  let displayObject;
  let usedHighQualityMesh = false;

  try {
    const loadedMesh = await loadHighQualityMesh(scan);
    loadedMesh.rotation.x = -Math.PI / 2;
    material = new THREE.MeshStandardMaterial({
      color: MANNEQUIN_GRAY, roughness: 0.85, metalness: 0.05,
    });
    loadedMesh.material = material;
    geometry = loadedMesh.geometry;
    displayObject = loadedMesh;
    usedHighQualityMesh = true;
  } catch (highQualityError) {
    console.warn('[loadScanMesh] high-quality mesh unavailable, falling back to local mesh:', highQualityError?.message);
  }

  if (!usedHighQualityMesh) {
    geometry = buildBodyMesh(scan);
    material = new THREE.MeshStandardMaterial({
      color: MANNEQUIN_GRAY, roughness: 0.85, metalness: 0.05,
    });

    const referenceRigUri = await getReferenceRigUri();
    if (referenceRigUri) {
      try {
        displayObject = await buildSkinnedBodyMesh(geometry, material, referenceRigUri);
      } catch (rigError) {
        console.warn('[loadScanMesh] skinned mesh unavailable, falling back to static mesh:', rigError.message);
      }
    }
    if (!displayObject) {
      displayObject = new THREE.Mesh(geometry, material);
    }
  }

  geometry.computeBoundingBox();
  // Real fix, found while building muscle-marker positioning: the
  // Anny high-quality path applies a rotation (loadedMesh.rotation.x =
  // -Math.PI / 2, above) to fix its raw "long axis on Z, not Y"
  // convention for display - but the local fallback path
  // (buildBodyMesh) applies NO rotation at all, since it already
  // generates Y-up geometry directly. A single hard-coded .min.y/.max.y
  // read on the raw, pre-rotation geometry can't be correct for both
  // paths at once - whichever one doesn't natively use Y as its height
  // axis gets centered using the wrong extent. Box3.setFromObject()
  // sidesteps this by computing the REAL, final, post-rotation world
  // extent directly (position is still at its Object3D default here,
  // so this reflects rotation only, not yet the offset we're about to
  // apply) - correct regardless of either path's raw local convention.
  // Real, necessary step, not defensive padding: Box3.setFromObject()
  // reads the object's matrixWorld, which Three.js only updates lazily
  // (normally once per render frame) - at this point displayObject has
  // never been rendered yet, so without forcing a fresh recompute here,
  // this would read a stale, pre-rotation matrix and silently produce
  // the exact same wrong result this fix was meant to correct.
  displayObject.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(displayObject);
  const midY = (worldBox.min.y + worldBox.max.y) / 2;
  displayObject.position.y = -midY;

  return { displayObject, geometry, material, usedHighQualityMesh };
}

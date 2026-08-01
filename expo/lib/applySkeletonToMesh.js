// lib/applySkeletonToMesh.js
//
// Runtime-only, zero-API-calls reuse of the ONE reference rig produced by
// scripts/generateReferenceRig.mjs. Every user's freshly-generated body
// mesh (from lib/bodyMeshBuilder.js) shares the exact same vertex topology
// as the reference mesh that was rigged — only vertex *positions* differ,
// driven by that user's real measurements. Skinning weights are assigned
// per vertex INDEX, not per vertex position, so the same weights from the
// one rigged reference apply correctly to every differently-shaped mesh.
//
// IMPORTANT UNVERIFIED ASSUMPTION, stated plainly: this only works if
// Meshy's rigging pipeline preserves vertex count/order from the uploaded
// GLB exactly. That's likely for a clean single-mesh upload but isn't
// something this code can confirm without actually having run the
// reference mesh through Meshy — hence the hard vertex-count check below,
// which fails loudly with a clear message rather than silently producing
// warped geometry if that assumption turns out to be wrong.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let cachedReference = null; // { skinIndex, skinWeight, skeleton, bones, vertexCount }

async function loadReferenceRig(referenceGlbUri) {
  if (cachedReference) return cachedReference;

  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.load(referenceGlbUri, resolve, undefined, reject);
  });

  let skinnedMesh = null;
  gltf.scene.traverse((obj) => {
    if (obj.isSkinnedMesh && !skinnedMesh) skinnedMesh = obj;
  });

  if (!skinnedMesh) {
    throw new Error(
      'The bundled reference GLB has no SkinnedMesh — either the rigging step failed, ' +
      'or the file at referenceGlbUri is the unrigged export, not the Meshy rigging output.'
    );
  }

  const geometry = skinnedMesh.geometry;
  if (!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) {
    throw new Error('Reference mesh has no skinIndex/skinWeight attributes — rigging did not produce skin data.');
  }

  cachedReference = {
    skinIndex: geometry.attributes.skinIndex,
    skinWeight: geometry.attributes.skinWeight,
    skeleton: skinnedMesh.skeleton,
    bindMatrix: skinnedMesh.bindMatrix,
    vertexCount: geometry.attributes.position.count,
  };
  return cachedReference;
}

/**
 * Builds a posable/animatable SkinnedMesh for a specific user's scan,
 * reusing the one bundled reference rig. No network call — the reference
 * rig is loaded once (from a bundled local asset) and cached in memory for
 * the rest of the app session.
 *
 * @param {THREE.BufferGeometry} userGeometry - from buildBodyMesh(scan)
 * @param {THREE.Material} material
 * @param {string} referenceGlbUri - local asset uri, e.g. from expo-asset,
 *   pointing at assets/body-rig/reference-rigged.glb
 */
export async function buildSkinnedBodyMesh(userGeometry, material, referenceGlbUri) {
  const ref = await loadReferenceRig(referenceGlbUri);

  const userVertexCount = userGeometry.attributes.position.count;
  if (userVertexCount !== ref.vertexCount) {
    throw new Error(
      `Vertex count mismatch: the generated mesh has ${userVertexCount} vertices but the ` +
      `rigged reference has ${ref.vertexCount}. This means lib/bodyMeshBuilder.js's topology ` +
      `changed since the reference rig was generated, OR Meshy's rigging pipeline altered the ` +
      `mesh during processing. Re-run scripts/generateReferenceRig.mjs against the CURRENT ` +
      `bodyMeshBuilder.js and replace the bundled reference asset — do not attempt to reuse an ` +
      `out-of-date rig, the skin weights will not line up with the wrong vertices.`
    );
  }

  // Copy the reference's per-vertex skin data onto the new geometry — this
  // is the whole trick that avoids a second Meshy call.
  userGeometry.setAttribute('skinIndex', ref.skinIndex.clone());
  userGeometry.setAttribute('skinWeight', ref.skinWeight.clone());

  const skinnedMesh = new THREE.SkinnedMesh(userGeometry, material);

  // Re-parent a fresh copy of the reference skeleton's bone hierarchy so
  // multiple users' meshes in memory at once (e.g. a before/after
  // comparison view) don't fight over shared bone transforms.
  const clonedRootBone = ref.skeleton.bones[0].parent
    ? ref.skeleton.bones[0].parent.clone(true)
    : ref.skeleton.bones[0].clone(true);
  const clonedBones = [];
  clonedRootBone.traverse((o) => { if (o.isBone) clonedBones.push(o); });
  const clonedSkeleton = new THREE.Skeleton(clonedBones, ref.skeleton.boneInverses);

  skinnedMesh.add(clonedRootBone);
  skinnedMesh.bind(clonedSkeleton, ref.bindMatrix);

  return skinnedMesh;
}

export function clearReferenceRigCache() {
  cachedReference = null;
}

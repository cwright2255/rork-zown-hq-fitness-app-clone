// lib/tryOn/garmentGeometry.js
//
// The three.js geometry for a fitted garment: its vertices (from the blend, after the push off the skin) and triangles (from the pack), with smooth
// surface directions worked out from them. three is passed in so this can be tested without a graphics context. The garment has no picture on it yet:
// the packs hold its shape only, so it is drawn in one colour.
import { normalsInto } from '../tryOnSpike/blend';

/** positions: Float32Array, 3 per vertex; faces: Uint16Array/Uint32Array, 3 per triangle. */
export function buildGarmentGeometry(THREE, positions, faces) {
  const normals = new Float32Array(positions.length);
  normalsInto(normals, positions, faces);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(faces, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

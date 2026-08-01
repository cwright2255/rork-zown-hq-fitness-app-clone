// lib/exportMeshToGLB.js
//
// Exports a body mesh (from lib/bodyMeshBuilder.js) to a binary GLB buffer,
// for the one-time reference-rig preparation step (see
// scripts/generateReferenceRig.js). Not used in the per-scan runtime path —
// end users never trigger a GLB export, this only runs once during setup.
//
// Relies on FileReader, which three.js's GLTFExporter uses internally for
// binary chunk assembly. React Native provides FileReader natively (it's a
// standard RN global, used throughout the ecosystem for blob/file handling)
// so this runs as-is in the app — no polyfill needed there. It was verified
// against a manual FileReader polyfill in a plain Node test environment
// before delivery, confirming the export logic itself (buffer assembly,
// chunk layout) is correct independent of the FileReader implementation.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const MANNEQUIN_GRAY = '#9CA3AF';

/**
 * Wraps a body-mesh geometry in a simple gray PBR material and exports it
 * to a binary GLB ArrayBuffer.
 */
export function exportBodyMeshToGLB(geometry, { name = 'ZownBody' } = {}) {
  return new Promise((resolve, reject) => {
    const material = new THREE.MeshStandardMaterial({
      color: MANNEQUIN_GRAY,
      roughness: 0.85,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;

    const exporter = new GLTFExporter();
    exporter.parse(
      mesh,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error('Expected binary GLB output but got JSON — check exporter options.'));
        }
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}

export function arrayBufferToBase64(buffer) {
  // btoa/Buffer availability differs between the Node script (has Buffer)
  // and the RN runtime (has global.Buffer via most polyfill setups, but not
  // guaranteed) — use a manual byte-chunked conversion that works in both.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

export function glbToDataUri(buffer) {
  return `data:model/gltf-binary;base64,${arrayBufferToBase64(buffer)}`;
}

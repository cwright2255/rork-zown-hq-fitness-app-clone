#!/usr/bin/env node
// scripts/generateReferenceRig.mjs
//
// ONE-TIME dev tool. Run this once (not per-user, not per-scan, not even
// per-release unless the mesh topology in lib/bodyMeshBuilder.js changes)
// to produce a rigged reference asset that ships bundled with the app.
// End users never call Meshy — see lib/applySkeletonToMesh.js for how the
// output of this script gets reused for every user's mesh at runtime with
// zero further API calls.
//
// Usage:
//   MESHY_API_KEY=msy-xxxxx node scripts/generateReferenceRig.mjs
//
// Output:
//   assets/body-rig/reference-rigged.glb   <- bundle this with the app
//   assets/body-rig/reference-meta.json    <- records the reference body's
//                                              measurements + height, so
//                                              applySkeletonToMesh.js can
//                                              compute the right per-vertex
//                                              offset between the reference
//                                              shape and each user's shape.
//
// Before running: read the two open questions flagged in the audit —
// (1) does Meshy's rigging pipeline need an actual bitmap texture, or is a
//     flat PBR material (baseColorFactor, no texture map — what this script
//     exports) sufficient, and
// (2) does the +Z forward-facing convention line up correctly.
// This script logs the exported GLB to a local file FIRST and pauses,
// so you can sanity-check orientation/material in a glTF viewer before it
// spends credits submitting to Meshy — see the --export-only flag.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildBodyMesh } from '../lib/bodyMeshBuilder.js';
import { exportBodyMeshToGLB, glbToDataUri } from '../lib/exportMeshToGLB.js';
import { rigModel } from '../services/meshyRiggingService.js';

// This script runs in plain Node (it's a dev tool, run once from the
// command line), which — unlike React Native — has no built-in FileReader.
// three.js's GLTFExporter needs one internally to assemble the binary GLB
// buffer. Polyfilled here; not needed in lib/exportMeshToGLB.js itself when
// that module runs inside the actual app.
global.FileReader = class FileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      const b64 = Buffer.from(buf).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
      if (this.onloadend) this.onloadend();
    });
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'body-rig');

// A representative "average adult" reference body — the actual measurement
// values here don't matter for correctness (see applySkeletonToMesh.js:
// skinning weights are per-vertex-INDEX, not per-vertex-position, so any
// reasonable reference shape works equally well as the rigging source).
const REFERENCE_SCAN = {
  heightCm: 172,
  measurements: { shoulderWidthCm: 40, waistCircumferenceCm: 82, hipCircumferenceCm: 96 },
};

async function main() {
  const exportOnly = process.argv.includes('--export-only');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Building reference mesh geometry...');
  const geometry = buildBodyMesh(REFERENCE_SCAN);

  console.log('Exporting to GLB...');
  const glbBuffer = await exportBodyMeshToGLB(geometry, { name: 'ZownReferenceBody' });

  const localGlbPath = path.join(OUTPUT_DIR, 'reference-unrigged.glb');
  fs.writeFileSync(localGlbPath, Buffer.from(glbBuffer));
  console.log(`Wrote unrigged reference mesh to ${localGlbPath} (${(glbBuffer.byteLength / 1024).toFixed(0)} KB)`);
  console.log('Open this in a glTF viewer (e.g. https://gltf-viewer.donmccurdy.com/) and confirm:');
  console.log('  - the figure faces +Z (toward the viewer, in most viewer defaults)');
  console.log('  - the material renders as a solid gray (confirms the material survived export)');

  if (exportOnly) {
    console.log('\n--export-only set, stopping before the Meshy API call.');
    return;
  }

  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    console.error('\nMESHY_API_KEY not set. Export succeeded above — re-run with the key set to continue to rigging.');
    process.exit(1);
  }

  console.log('\nSubmitting to Meshy for rigging (this consumes credits)...');
  const dataUri = glbToDataUri(glbBuffer);
  const { riggedGlbUrl, basicAnimations } = await rigModel({
    apiKey,
    modelDataUri: dataUri,
    heightMeters: REFERENCE_SCAN.heightCm / 100,
  });

  console.log('Rigging succeeded. Downloading rigged GLB...');
  const riggedRes = await fetch(riggedGlbUrl);
  const riggedBuffer = await riggedRes.arrayBuffer();
  const riggedPath = path.join(OUTPUT_DIR, 'reference-rigged.glb');
  fs.writeFileSync(riggedPath, Buffer.from(riggedBuffer));
  console.log(`Wrote rigged reference mesh to ${riggedPath}`);

  const meta = {
    referenceScan: REFERENCE_SCAN,
    generatedAt: new Date().toISOString(),
    basicAnimationUrls: basicAnimations,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'reference-meta.json'), JSON.stringify(meta, null, 2));

  console.log('\nDone. Commit assets/body-rig/reference-rigged.glb and reference-meta.json to the repo.');
  console.log('Basic animation clips (if you want to bundle any):');
  console.log(JSON.stringify(basicAnimations, null, 2));
}

main().catch((err) => {
  console.error('generateReferenceRig failed:', err);
  process.exit(1);
});

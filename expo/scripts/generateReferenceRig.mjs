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
// Resolved, not an open question anymore: a real submission with no
// texture failed with a pose-estimation error, and Meshy's own rigging
// docs explicitly list "Untextured meshes" first among models auto-rigging
// is not suitable for. This script now generates a plain solid-color PNG
// (matching the mesh's own flat gray material) and submits it as
// texture_image_url alongside the model.
// This script logs the exported GLB to a local file FIRST and pauses,
// so you can sanity-check orientation/material in a glTF viewer before it
// spends credits submitting to Meshy — see the --export-only flag.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { buildBodyMesh } from '../lib/bodyMeshBuilder.js';
import { exportBodyMeshToGLB, glbToDataUri } from '../lib/exportMeshToGLB.js';
import { rigModel } from '../services/meshyRiggingService.js';

// Real fix, not part of the original script: Meshy's rigging API docs
// explicitly list "Untextured meshes" first among models auto-rigging is
// not suitable for, and a real submission with the flat-material-only GLB
// this script produced failed with a pose-estimation error. Rather than
// add an external image-generation dependency for a one-time dev script,
// this constructs a minimal valid PNG by hand - signature + IHDR + IDAT
// (zlib-deflated raw RGB rows) + IEND, using only Node's built-in zlib.
// Verified independently before wiring in: the `file` command correctly
// identifies the output as real PNG image data, and it renders correctly
// in an image viewer.
function makeSolidColorPng(width, height, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) | 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
}

function pngToDataUri(pngBuffer) {
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

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
  // Same color as MANNEQUIN_GRAY in lib/exportMeshToGLB.js (#9CA3AF), so
  // the texture matches the material already visible in the local export
  const texturePng = makeSolidColorPng(64, 64, [0x9c, 0xa3, 0xaf]);
  const textureDataUri = pngToDataUri(texturePng);
  const { riggedGlbUrl, basicAnimations } = await rigModel({
    apiKey,
    modelDataUri: dataUri,
    heightMeters: REFERENCE_SCAN.heightCm / 100,
    textureImageUri: textureDataUri,
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

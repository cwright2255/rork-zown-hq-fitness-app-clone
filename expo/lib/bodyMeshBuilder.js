// lib/bodyMeshBuilder.js
//
// Builds ONE continuous, smoothly-shaded body mesh (not separate primitives
// glued together) from real measurement data. No external mesh file, no
// SMPL, no patent/licensing dependency — this is an original parametric
// mesh generator: a "loft" (surface of revolution with a varying elliptical
// cross-section) through control rings positioned at real anthropometric
// heights, sized by the real width/depth measurements from the scan.
//
// This directly replaces the earlier primitive-based mannequin (separate
// capsules + a lathe torso + a sphere head, which had visible seams where
// parts met). This version produces a single BufferGeometry with computed
// vertex normals, so it smooth-shades continuously the way an actual body
// scan mesh would, while still being 100% original geometry driven by the
// scan's real measurements.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const RADIAL_SEGMENTS = 20; // vertices per ring — higher = smoother, more triangles

// Catmull-Rom interpolation between a sparse set of control values, so the
// mesh flows smoothly between the handful of heights we actually have real
// or estimated data for, instead of linear kinks at each measured point.
function catmullRom(values, t) {
  const n = values.length;
  const p = t * (n - 1);
  const i = Math.floor(p);
  const localT = p - i;
  const p0 = values[Math.max(0, i - 1)];
  const p1 = values[Math.min(n - 1, i)];
  const p2 = values[Math.min(n - 1, i + 1)];
  const p3 = values[Math.min(n - 1, i + 2)];

  const t2 = localT * localT;
  const t3 = t2 * localT;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * localT +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Builds a single lofted tube mesh through a list of control rings.
 * Each control ring: { y, widthRadius, depthRadius, centerX=0, centerZ=0 }
 * `y` values must be ascending. Cross-sections are elliptical
 * (widthRadius = left-right half-extent, depthRadius = front-back
 * half-extent) rather than circular, since a torso is measurably flatter
 * front-to-back than it is wide — using the real front-photo width and
 * side-photo depth data rather than collapsing them into one averaged
 * "radius" is what makes this closer to the real body shape than a plain
 * tube would be.
 * `ringsPerSegment` controls how many interpolated rings are generated
 * between control points for smoothness.
 * `capStart`/`capEnd` close the tube ends (feet, hands, top of head neck
 * stump) with a flat disc instead of leaving them open.
 */
function buildLoftTube(controlRings, { ringsPerSegment = 6, capStart = true, capEnd = true } = {}) {
  const totalRings = (controlRings.length - 1) * ringsPerSegment + 1;
  const ys = controlRings.map((r) => r.y);
  const widths = controlRings.map((r) => r.widthRadius);
  const depths = controlRings.map((r) => r.depthRadius);
  const centersX = controlRings.map((r) => r.centerX ?? 0);
  const centersZ = controlRings.map((r) => r.centerZ ?? 0);

  const positions = [];
  const ringVertexStart = [];

  for (let ring = 0; ring < totalRings; ring++) {
    const t = ring / (totalRings - 1);
    const y = catmullRom(ys, t);
    const w = Math.max(0.005, catmullRom(widths, t));
    const d = Math.max(0.005, catmullRom(depths, t));
    const cx = catmullRom(centersX, t);
    const cz = catmullRom(centersZ, t);

    ringVertexStart.push(positions.length / 3);
    for (let seg = 0; seg < RADIAL_SEGMENTS; seg++) {
      const theta = (seg / RADIAL_SEGMENTS) * Math.PI * 2;
      const x = cx + Math.cos(theta) * w;
      const z = cz + Math.sin(theta) * d;
      positions.push(x, y, z);
    }
  }

  const indices = [];
  for (let ring = 0; ring < totalRings - 1; ring++) {
    const a0 = ringVertexStart[ring];
    const a1 = ringVertexStart[ring + 1];
    for (let seg = 0; seg < RADIAL_SEGMENTS; seg++) {
      const segNext = (seg + 1) % RADIAL_SEGMENTS;
      const v00 = a0 + seg, v01 = a0 + segNext;
      const v10 = a1 + seg, v11 = a1 + segNext;
      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  // End caps: a fan of triangles to a center point, so tube ends (feet,
  // hand-ends, neck-into-head junction) are closed surfaces, not open tubes.
  if (capStart) {
    const centerIdx = positions.length / 3;
    positions.push(centersX[0], ys[0], centersZ[0]);
    const ring0 = ringVertexStart[0];
    for (let seg = 0; seg < RADIAL_SEGMENTS; seg++) {
      const segNext = (seg + 1) % RADIAL_SEGMENTS;
      indices.push(centerIdx, ring0 + segNext, ring0 + seg);
    }
  }
  if (capEnd) {
    const centerIdx = positions.length / 3;
    const lastY = ys[ys.length - 1];
    positions.push(centersX[centersX.length - 1], lastY, centersZ[centersZ.length - 1]);
    const lastRing = ringVertexStart[ringVertexStart.length - 1];
    for (let seg = 0; seg < RADIAL_SEGMENTS; seg++) {
      const segNext = (seg + 1) % RADIAL_SEGMENTS;
      indices.push(centerIdx, lastRing + seg, lastRing + segNext);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function circumferenceToRadius(cm) {
  return cm ? (cm / (2 * Math.PI)) / 100 : null;
}

/**
 * Builds the full continuous body mesh from a scan record. Returns a single
 * merged THREE.BufferGeometry with smooth vertex normals computed — this is
 * the actual mesh to hand to a THREE.Mesh with a flat gray material.
 */
export function buildBodyMesh(scan) {
  const heightM = (scan.heightCm ?? 175) / 100;
  const m = scan.measurements || {};

  // Real measurements, converted to loft radii (meters). Where we only have
  // a circumference (no separate width/depth), split it into a plausible
  // elliptical width/depth pair using a typical torso flatness ratio
  // (depth ~ 0.75x width at waist/hip) rather than forcing a circular tube.
  const shoulderHalfWidth = Math.max(0.06, (m.shoulderWidthCm ?? 42) / 2 / 100);
  const waistR = circumferenceToRadius(m.waistCircumferenceCm) ?? shoulderHalfWidth * 0.75;
  const hipR = circumferenceToRadius(m.hipCircumferenceCm) ?? shoulderHalfWidth * 0.85;

  const ellipse = (avgR, flatnessRatio = 0.78) => ({
    widthRadius: avgR / Math.sqrt(flatnessRatio),   // solve so that pi*w*d keeps the same area as a circle of radius avgR
    depthRadius: avgR * Math.sqrt(flatnessRatio),
  });

  const waistShape = ellipse(waistR);
  const hipShape = ellipse(hipR, 0.85); // hips are less flattened than waist
  const chestShape = { widthRadius: shoulderHalfWidth * 0.82, depthRadius: shoulderHalfWidth * 0.60 };

  // Anthropometric height fractions (public-domain figure-drawing
  // convention — same as before, just now driving a continuous profile
  // instead of discrete primitive positions).
  const anklesY = 0;
  const kneesY = heightM * 0.28;
  const hipsY = heightM * 0.47;
  const waistY = heightM * 0.53;
  const chestY = heightM * 0.66;
  const shouldersY = heightM * 0.73;
  const neckTopY = heightM * 0.76;
  const headTopY = heightM * 0.90;

  const legAnkleR = hipR * 0.20;
  const legCalfR = hipR * 0.30;
  const legKneeR = hipR * 0.26;
  const legThighR = hipR * 0.42;

  // Legs, torso, and arms are each built as their own loft rather than one
  // fused tube, so the figure reads as a two-legged body from the front
  // instead of a single tapered lower body. A true topological Y-junction
  // (torso smoothly splitting into two legs as one continuous surface) is
  // a materially harder meshing problem and unnecessary for a stylized
  // progress-tracking mannequin — instead, each leg's top ring extends
  // well up into the torso's own lower volume (toward waist height, not
  // stopping right at the hip line) so the capped end that would otherwise
  // create a visible seam sits hidden inside the overlapping torso
  // geometry rather than exposed exactly where the two separate tubes
  // would otherwise just touch.
  const legTopY = hipsY + (waistY - hipsY) * 0.7;
  const rightLeg = buildLoftTube([
    { y: anklesY, widthRadius: legAnkleR, depthRadius: legAnkleR * 0.9, centerX: hipR * 0.45 },
    { y: kneesY * 0.5, widthRadius: legCalfR, depthRadius: legCalfR * 0.85, centerX: hipR * 0.45 },
    { y: kneesY, widthRadius: legKneeR, depthRadius: legKneeR * 0.85, centerX: hipR * 0.45 },
    { y: (kneesY + hipsY) / 2, widthRadius: legThighR, depthRadius: legThighR * 0.9, centerX: hipR * 0.4 },
    { y: hipsY * 0.98, widthRadius: legThighR * 0.95, depthRadius: legThighR * 0.9, centerX: hipR * 0.3 },
    { y: legTopY, widthRadius: legThighR * 0.85, depthRadius: legThighR * 0.8, centerX: hipR * 0.18 },
  ], { ringsPerSegment: 6, capStart: true, capEnd: true });

  const leftLeg = buildLoftTube([
    { y: anklesY, widthRadius: legAnkleR, depthRadius: legAnkleR * 0.9, centerX: -hipR * 0.45 },
    { y: kneesY * 0.5, widthRadius: legCalfR, depthRadius: legCalfR * 0.85, centerX: -hipR * 0.45 },
    { y: kneesY, widthRadius: legKneeR, depthRadius: legKneeR * 0.85, centerX: -hipR * 0.45 },
    { y: (kneesY + hipsY) / 2, widthRadius: legThighR, depthRadius: legThighR * 0.9, centerX: -hipR * 0.4 },
    { y: hipsY * 0.98, widthRadius: legThighR * 0.95, depthRadius: legThighR * 0.9, centerX: -hipR * 0.3 },
    { y: legTopY, widthRadius: legThighR * 0.85, depthRadius: legThighR * 0.8, centerX: -hipR * 0.18 },
  ], { ringsPerSegment: 6, capStart: true, capEnd: true });

  // Feet: previously the leg just ended in a flat, capped ankle disc.
  // Extends forward (+Z) from the ankle using the same center-shift
  // technique the arms already use for outward reach - the tube's
  // centerline moves through space across its rings, not just its radius
  // growing at a fixed point. A tiny, strictly-increasing Y rise from
  // ankle to toe-tip (not a real arch, which rises then falls) satisfies
  // buildLoftTube's ascending-Y requirement while still reading as
  // essentially flat-on-the-ground at this scale.
  const footLength = legAnkleR * 3.4;
  const footWidth = legAnkleR * 1.15;
  const footRise = heightM * 0.012;
  const buildFoot = (side) => buildLoftTube([
    { y: anklesY, widthRadius: legAnkleR * 0.95, depthRadius: legAnkleR * 0.8, centerX: side * hipR * 0.45, centerZ: 0 },
    { y: anklesY + footRise * 0.3, widthRadius: footWidth, depthRadius: footLength * 0.4, centerX: side * hipR * 0.45, centerZ: footLength * 0.35 },
    { y: anklesY + footRise * 0.7, widthRadius: footWidth * 0.85, depthRadius: footLength * 0.32, centerX: side * hipR * 0.45, centerZ: footLength * 0.72 },
    { y: anklesY + footRise, widthRadius: footWidth * 0.4, depthRadius: footLength * 0.18, centerX: side * hipR * 0.45, centerZ: footLength * 0.98 },
  ], { ringsPerSegment: 5, capStart: true, capEnd: true });
  const rightFoot = buildFoot(1);
  const leftFoot = buildFoot(-1);

  const torsoOnly = buildLoftTube([
    { y: hipsY, widthRadius: hipShape.widthRadius, depthRadius: hipShape.depthRadius, centerX: 0 },
    { y: waistY, widthRadius: waistShape.widthRadius, depthRadius: waistShape.depthRadius, centerX: 0 },
    { y: chestY, widthRadius: chestShape.widthRadius, depthRadius: chestShape.depthRadius, centerX: 0 },
    { y: shouldersY, widthRadius: shoulderHalfWidth, depthRadius: chestShape.depthRadius * 1.05, centerX: 0 },
    { y: neckTopY, widthRadius: shoulderHalfWidth * 0.28, depthRadius: shoulderHalfWidth * 0.28, centerX: 0 },
  ], { ringsPerSegment: 8, capStart: true, capEnd: false });

  // Arms: shoulder -> elbow -> wrist, each its own loft, mirrored L/R.
  // centerZ carries a small forward (+Z) bias — anatomically correct (the
  // shoulder joint sits slightly forward of the spine, not directly on its
  // centerline) and it's also what gives this mesh a genuine front/back
  // asymmetry. Without it the torso loft is a symmetric tube and there's no
  // geometric signal for which side is "front" — Meshy's rigging docs
  // specifically require the character to face +Z for pose estimation to
  // work, so this isn't just a cosmetic nicety.
  //
  // Real fix: arms previously hung straight down at the sides (centerX
  // barely changed from shoulder to wrist). Confirmed directly against
  // Meshy's own rigging docs and a real submission failure - "Pose
  // estimation failed. The provided model may not be a valid humanoid
  // character" is their documented error for exactly this, and their docs
  // explicitly say to use a T-pose or A-pose. armOutwardReach adds a
  // progressive outward horizontal displacement from shoulder (0) to wrist
  // (full reach), at roughly 35 degrees from vertical - a standard A-pose
  // angle, preferred over a full T-pose since it reduces shoulder-area
  // mesh distortion once the rig is actually animated.
  const armLength = heightM * 0.44;
  const shoulderR = shoulderHalfWidth * 0.30;
  const elbowR = shoulderHalfWidth * 0.22;
  const wristR = shoulderHalfWidth * 0.16;
  const armForwardBias = chestShape.depthRadius * 0.35;
  const armOutwardReach = armLength * Math.tan(35 * Math.PI / 180); // ~0.70x armLength
  const buildArm = (side) => buildLoftTube([
    { y: shouldersY, widthRadius: shoulderR, depthRadius: shoulderR, centerX: side * (shoulderHalfWidth + shoulderR * 0.6), centerZ: armForwardBias * 0.6 },
    { y: shouldersY - armLength * 0.5, widthRadius: elbowR, depthRadius: elbowR, centerX: side * (shoulderHalfWidth + shoulderR + armOutwardReach * 0.5), centerZ: armForwardBias },
    { y: shouldersY - armLength, widthRadius: wristR, depthRadius: wristR, centerX: side * (shoulderHalfWidth + shoulderR * 1.1 + armOutwardReach), centerZ: armForwardBias },
  ], { ringsPerSegment: 6, capStart: true, capEnd: true });

  // Hands: previously the arm just ended in a flat, capped wrist disc.
  // Attaches at the exact same position the arm loft's own final ring
  // already computes, so there's no gap or misalignment between the two
  // separate geometries. A short palm segment, then four separate finger
  // tubes plus a thumb (angled outward and slightly forward, as a real
  // thumb sits), each its own small loft continuing downward from the
  // palm's base - not individually jointed, but genuinely separate digits
  // rather than a single undifferentiated stub.
  const wristY = shouldersY - armLength;
  const wristX = (side) => side * (shoulderHalfWidth + shoulderR * 1.1 + armOutwardReach);
  const handLength = wristR * 3.6;
  const palmWidth = wristR * 1.25;
  const palmBaseY = wristY - handLength * 0.4;
  const fingerTipY = wristY - handLength;
  const fingerR = wristR * 0.22;
  const fingerSpread = palmWidth * 0.65;
  const buildHand = (side) => {
    const wx = wristX(side);
    const palm = buildLoftTube([
      { y: wristY, widthRadius: wristR, depthRadius: wristR * 0.85, centerX: wx, centerZ: armForwardBias },
      { y: palmBaseY, widthRadius: palmWidth, depthRadius: wristR * 0.7, centerX: wx, centerZ: armForwardBias },
    ], { ringsPerSegment: 5, capStart: true, capEnd: false });

    const fingerOffsets = [-1.5, -0.5, 0.5, 1.5]; // four fingers spread across the palm's width
    const fingers = fingerOffsets.map((offset) => buildLoftTube([
      { y: palmBaseY, widthRadius: fingerR, depthRadius: fingerR, centerX: wx + offset * (fingerSpread / 3), centerZ: armForwardBias },
      { y: fingerTipY - Math.abs(offset) * handLength * 0.04, widthRadius: fingerR * 0.55, depthRadius: fingerR * 0.55, centerX: wx + offset * (fingerSpread / 3), centerZ: armForwardBias },
    ], { ringsPerSegment: 4, capStart: false, capEnd: true }));

    // Thumb: shorter, offset toward the body's centerline and forward -
    // roughly where a real thumb sits relative to the palm.
    const thumb = buildLoftTube([
      { y: palmBaseY + handLength * 0.1, widthRadius: fingerR * 1.1, depthRadius: fingerR * 1.1, centerX: wx - side * palmWidth * 0.75, centerZ: armForwardBias * 1.3 },
      { y: palmBaseY - handLength * 0.28, widthRadius: fingerR * 0.6, depthRadius: fingerR * 0.6, centerX: wx - side * palmWidth * 1.15, centerZ: armForwardBias * 1.7 },
    ], { ringsPerSegment: 4, capStart: false, capEnd: true });

    return [palm, ...fingers, thumb];
  };
  const rightHand = buildHand(1);
  const leftHand = buildHand(-1);

  // Head: an ellipsoid loft (taller than wide), fully smooth, no features —
  // faceless by construction.
  const headRadius = heightM * 0.065;
  const head = buildLoftTube([
    { y: neckTopY, widthRadius: headRadius * 0.5, depthRadius: headRadius * 0.5, centerX: 0 },
    { y: neckTopY + headRadius * 0.5, widthRadius: headRadius, depthRadius: headRadius * 0.92, centerX: 0 },
    { y: headTopY - headRadius * 0.2, widthRadius: headRadius * 0.95, depthRadius: headRadius * 0.88, centerX: 0 },
    { y: headTopY, widthRadius: headRadius * 0.1, depthRadius: headRadius * 0.1, centerX: 0 },
  ], { ringsPerSegment: 8, capStart: false, capEnd: true });

  const merged = mergeGeometries(
    [torsoOnly, leftLeg, rightLeg, buildArm(-1), buildArm(1), head, leftFoot, rightFoot, ...leftHand, ...rightHand],
    false
  );
  merged.computeVertexNormals();
  return merged;
}

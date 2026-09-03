// lib/muscleAnchors.js
//
// Real, proportional muscle regions for coloring a user's own 3D
// body-scan mesh directly - an honest approximation, not medical-grade
// vertex-level anatomy. The underlying Anny mesh (lib/loadScanMesh.js)
// is a pure body-SHAPE model with no muscle-region or bone data at all,
// so there is no way to know which of ITS OWN specific vertices
// correspond to a real anatomical muscle - a professionally labeled
// reference mesh (like Z-Anatomy/BodyParts3D) only has that
// correspondence for its OWN fixed geometry, which is a completely
// different, incompatible mesh from the one Anny generates fresh for
// every user. This instead defines proportional regions at standard,
// well-established human body-proportion locations, scaled to each
// user's own real computed mesh dimensions, and colors whichever of
// THEIR OWN real vertices happen to fall near each region - real paint
// on their real surface, personalized to their body, even though the
// region boundaries themselves are an approximation.
//
// Coordinate fractions are all relative to the mesh's own LOCAL
// bounding box - see the axis-detection note in detectAxes() for why.
//
//   heightFraction: 0 (feet) to 1 (head)
//   sideFraction:   -1 (left) to 1 (right), 0 = center
//   depthFraction:  -1 (back) to 1 (front), 0 = center - used only as a
//                   coarse front/back gate (see computeVertexColors),
//                   not part of the smooth falloff.
//   lengthFraction: how elongated along the height axis, as a fraction
//                   of total body height.
//   widthFraction:  how wide, as a fraction of total body width.
//
// Bilateral muscles (quads, hamstrings, calves, glutes) get two
// regions, mirrored left/right. Core is a single centered region.
export const MUSCLE_ANCHORS = {
  quadriceps: [
    { heightFraction: 0.42, sideFraction: -0.16, depthFraction: 0.6, lengthFraction: 0.20, widthFraction: 0.16 },
    { heightFraction: 0.42, sideFraction: 0.16, depthFraction: 0.6, lengthFraction: 0.20, widthFraction: 0.16 },
  ],
  hamstrings: [
    { heightFraction: 0.40, sideFraction: -0.15, depthFraction: -0.55, lengthFraction: 0.19, widthFraction: 0.15 },
    { heightFraction: 0.40, sideFraction: 0.15, depthFraction: -0.55, lengthFraction: 0.19, widthFraction: 0.15 },
  ],
  glutes: [
    { heightFraction: 0.53, sideFraction: -0.13, depthFraction: -0.6, lengthFraction: 0.13, widthFraction: 0.15 },
    { heightFraction: 0.53, sideFraction: 0.13, depthFraction: -0.6, lengthFraction: 0.13, widthFraction: 0.15 },
  ],
  calves: [
    { heightFraction: 0.15, sideFraction: -0.11, depthFraction: -0.45, lengthFraction: 0.15, widthFraction: 0.11 },
    { heightFraction: 0.15, sideFraction: 0.11, depthFraction: -0.45, lengthFraction: 0.15, widthFraction: 0.11 },
  ],
  core: [
    { heightFraction: 0.63, sideFraction: 0, depthFraction: 0.6, lengthFraction: 0.19, widthFraction: 0.18 },
  ],
};

function detectAxes(size) {
  const extents = [
    { axis: 'x', value: size.x },
    { axis: 'y', value: size.y },
    { axis: 'z', value: size.z },
  ].sort((a, b) => b.value - a.value);
  return { heightAxis: extents[0].axis, sideAxis: extents[1].axis, depthAxis: extents[2].axis };
}

function computeMuscleRegions(geometry, muscleNames, THREE) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const { heightAxis, sideAxis, depthAxis } = detectAxes(size);

  const regions = [];
  muscleNames.forEach((muscle) => {
    const anchors = MUSCLE_ANCHORS[muscle];
    if (!anchors) return;
    anchors.forEach((anchor) => {
      const pos = new THREE.Vector3(center.x, center.y, center.z);
      pos[heightAxis] = box.min[heightAxis] + anchor.heightFraction * size[heightAxis];
      pos[sideAxis] = center[sideAxis] + anchor.sideFraction * (size[sideAxis] / 2);
      pos[depthAxis] = center[depthAxis] + anchor.depthFraction * (size[depthAxis] / 2);

      const radius = new THREE.Vector3(1, 1, 1);
      radius[heightAxis] = (anchor.lengthFraction * size[heightAxis]) / 2;
      radius[sideAxis] = (anchor.widthFraction * size[sideAxis]) / 2;

      regions.push({
        muscle, center: pos, radius, heightAxis, sideAxis, depthAxis,
        depthSign: Math.sign(anchor.depthFraction) || 1,
        meshCenterDepth: center[depthAxis],
      });
    });
  });
  return regions;
}

export function computeMuscleMarkerPositions(geometry, muscleNames, THREE) {
  return computeMuscleRegions(geometry, muscleNames, THREE).map((r) => ({
    muscle: r.muscle,
    position: r.center,
    scale: new THREE.Vector3(
      r.radius.x || r.radius[r.heightAxis] * 0.3,
      r.radius.y || r.radius[r.heightAxis] * 0.3,
      r.radius.z || r.radius[r.heightAxis] * 0.3
    ),
  }));
}

export function computeVertexColors(geometry, muscleNames, muscleIntensities, baseColorHex, THREE) {
  const regions = computeMuscleRegions(geometry, muscleNames, THREE);
  const baseColor = new THREE.Color(baseColorHex);

  const positionAttr = geometry.getAttribute('position');
  const vertexCount = positionAttr.count;
  const colors = new Float32Array(vertexCount * 3);

  const regionColors = regions.map((r) => {
    const intensity = muscleIntensities?.[r.muscle];
    const hex = intensity != null ? intensityToHex(intensity) : 0xF97316;
    return new THREE.Color(hex);
  });

  const v = new THREE.Vector3();
  for (let i = 0; i < vertexCount; i++) {
    v.fromBufferAttribute(positionAttr, i);

    let bestDist = 1;
    let bestRegionIdx = -1;
    for (let r = 0; r < regions.length; r++) {
      const region = regions[r];

      const vertexDepthSign = Math.sign(v[region.depthAxis] - region.meshCenterDepth) || 1;
      if (vertexDepthSign !== region.depthSign) continue;

      const dh = (v[region.heightAxis] - region.center[region.heightAxis]) / region.radius[region.heightAxis];
      const ds = (v[region.sideAxis] - region.center[region.sideAxis]) / region.radius[region.sideAxis];
      const dist = Math.sqrt(dh * dh + ds * ds);
      if (dist < bestDist) {
        bestDist = dist;
        bestRegionIdx = r;
      }
    }

    let out = baseColor;
    if (bestRegionIdx !== -1) {
      const falloff = 1 - bestDist;
      out = baseColor.clone().lerp(regionColors[bestRegionIdx], falloff);
    }

    colors[i * 3] = out.r;
    colors[i * 3 + 1] = out.g;
    colors[i * 3 + 2] = out.b;
  }

  return new THREE.BufferAttribute(colors, 3);
}

function intensityToHex(intensity0to100) {
  if (intensity0to100 < 20) return 0x3B82F6;
  if (intensity0to100 < 45) return 0x22C55E;
  if (intensity0to100 < 70) return 0xF59E0B;
  return 0xDC2626;
}

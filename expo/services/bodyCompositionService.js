// services/bodyCompositionService.js
//
// Body-composition estimation with NO external API dependency.
//
// WHY THIS CHANGED FROM THE MESHCAPADE VERSION:
// Meshcapade was acquired by Epic Games in February 2026 and its public
// Me platform / API was shut down on April 18, 2026. That's a confirmed,
// permanent shutdown (Epic's stated plan is folding the tech into
// MetaHuman/Unreal Engine, not continuing the public API) — not a
// temporary outage to work around. SMPL itself is also still patented
// (US10395411B2, Max Planck Society, licensed via Max Planck Innovation)
// with no public commercial API currently available at all, so there is
// no drop-in replacement that returns SMPL/SMPL-X parameters today.
//
// This version sidesteps that entirely: it doesn't use SMPL, doesn't call
// any third-party body-scanning API, and doesn't require any commercial
// license. Instead it uses:
//   1. MediaPipe Pose landmarks (already in the app for the form-check
//      feature) to measure body-segment widths directly from the photos,
//      calibrated against the user's real height.
//   2. Ramanujan's ellipse-perimeter approximation (public-domain math) to
//      turn a front-view width + side-view depth at the same body height
//      into an estimated circumference — a well-established technique in
//      photo-based anthropometry research.
//   3. The Hodgdon-Beckett (1984) U.S. Navy circumference formula — a
//      published, public-domain, DoD-standard equation (validated to
//      roughly ±3-4% of hydrostatic weighing per the original research)
//      — to turn those circumferences into a body-fat estimate. Not a
//      black-box model; every step here is inspectable, public, and free.
//
// Accuracy honesty: this is a *photo-based estimate of a formula that
// itself has known error margins even with a physical tape measure*.
// Treat it as a trend-tracking tool, not a clinical measurement. See the
// AI insight prompt in aiService.js, which is instructed accordingly.

// ---- Landmark-based measurement estimation --------------------------------

// BlazePose 33-point indices (same topology used by services/formAnalysisService.js)
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_EAR: 7, RIGHT_EAR: 8,
};

function pixelDist(a, b) {
  return Math.hypot((a.x - b.x), (a.y - b.y));
}

/**
 * Estimates a pixel-to-real-world scale factor from the user's known height
 * and their head-to-ankle pixel span in the front photo. Using ear-height
 * (rather than top-of-head, which pose landmarks don't give directly) as a
 * conservative proxy and correcting by a fixed anthropometric ratio
 * (ear-to-ankle is ~0.94 of total standing height on average).
 */
// A properly-framed full-body photo (which the capture screen's own
// full-body-visibility gate requires before letting a step complete)
// should have the person's head-to-ankle span occupy most of the frame's
// height - realistically at least a third of it, generally more. If this
// comes out much smaller than that, scale becomes huge and inflates
// every downstream measurement, regardless of any clamp further down the
// pipeline that only bounds depth relative to width - a too-small
// pixelSpan here would already make width itself wrong before depth is
// ever considered. This is a floor, not a typical value.
//
// Recalibrated alongside the matching gate in capture.jsx: real,
// visually-confirmed on-device evidence showed a genuinely well-framed
// capture producing a span around 0.094, not the far larger value this
// was originally set to assume - a real mismatch between what's
// displayed and the actual coordinate space the camera library's frame
// processor operates in on this device (documented as a known category
// of issue in the library itself). Leaving the floor at the old value
// would mean every real capture gets clamped to the same artificial
// number instead of reflecting genuine distance variation. Set with
// margin below the confirmed-good 0.094, but still above the earlier,
// genuinely unusable 0.016 span, so this remains a real floor against
// the most extreme cases rather than a number every capture always hits.
const MIN_REASONABLE_PIXEL_SPAN = 0.05;

function calibrateScale(landmarks, heightCm) {
  // Nose, not ear: the capture screen's own framing gate (isFullBodyVisible
  // in capture.jsx) validates that the nose specifically is visible and
  // genuinely on-screen before letting any step complete - nothing
  // validates ear position at all. Real evidence showed this exact gap:
  // a completed scan with a genuinely valid, gate-passing capture still
  // produced a wildly-inflated scale, consistent with the ear landmarks
  // this used to rely on being unreliable in a way the gate never checked
  // for - and ears are also more easily obscured by hair than the nose
  // is. Using the already-validated landmark directly, rather than adding
  // yet another gate for ear visibility specifically (a real risk given
  // this session's experience with gates on fragile signals blocking
  // otherwise-valid captures entirely).
  const noseY = landmarks[LM.NOSE].y;
  const ankleY = Math.max(landmarks[LM.LEFT_ANKLE].y, landmarks[LM.RIGHT_ANKLE].y);
  const rawPixelSpan = Math.abs(ankleY - noseY);
  const pixelSpan = Math.max(rawPixelSpan, MIN_REASONABLE_PIXEL_SPAN);
  // Empirically-derived, not guessed: a study estimating height from
  // pose-detector nose/ankle landmarks (same problem this solves) found a
  // mean ratio of 1.17 (±0.03, a real, tight spread) between total height
  // and nose-to-ankle pixel distance across 29 real images - i.e.
  // nose-to-ankle is ~85.5% of total standing height on average, notably
  // shorter than ear-to-ankle since the nose sits lower on the face than
  // the ear does relative to the top of the head.
  const NOSE_TO_ANKLE_RATIO = 1 / 1.17;
  const realSpanCm = heightCm * NOSE_TO_ANKLE_RATIO;
  const scale = realSpanCm / pixelSpan; // cm per normalized-unit (landmarks are normalized 0-1)
  return { scale, rawPixelSpan, noseY, ankleY, wasClamped: rawPixelSpan < MIN_REASONABLE_PIXEL_SPAN };
}

/**
 * Estimates body-segment widths (shoulder, waist, hip) from front-photo
 * landmarks, and depth at the same heights from profile-photo landmarks,
 * combining both into circumference estimates via the ellipse-perimeter
 * approximation. Landmarks are expected in MediaPipe's normalized [0,1]
 * image coordinates, per-photo (front and profile shots are separate
 * detections — they are NOT assumed to be pixel-aligned with each other).
 *
 * Accepts EITHER one profile capture (`sideLandmarks`, kept for backward
 * compatibility) OR both (`rightLandmarks` + `leftLandmarks`, from the
 * turntable-style capture flow in app/body-scan/capture.jsx). When both are
 * available, depth is averaged across sides — a real accuracy improvement,
 * since a single profile shot bakes in whatever left/right asymmetry that
 * particular side happens to have, while most people aren't perfectly
 * symmetric front-to-back on both sides equally.
 */
export function estimateMeasurementsFromLandmarks({
  frontLandmarks, sideLandmarks, rightLandmarks, leftLandmarks, heightCm,
}) {
  if (!frontLandmarks) {
    throw new Error('Front-pose landmarks are required.');
  }
  if (!heightCm) {
    throw new Error('Height is required.');
  }

  const frontScaleInfo = calibrateScale(frontLandmarks, heightCm); // cm per normalized-unit, front photo
  const scale = frontScaleInfo.scale;
  const shoulderWidthCm = pixelDist(frontLandmarks[LM.LEFT_SHOULDER], frontLandmarks[LM.RIGHT_SHOULDER]) * scale;
  const hipWidthCm = pixelDist(frontLandmarks[LM.LEFT_HIP], frontLandmarks[LM.RIGHT_HIP]) * scale;
  // Waist sits between shoulder and hip landmarks vertically; approximate its
  // width as the midpoint blend of shoulder and hip width — a standard
  // simplification when no dedicated waist landmark exists.
  const waistWidthCm = (shoulderWidthCm * 0.4 + hipWidthCm * 0.6);

  const profileShots = [rightLandmarks, leftLandmarks, sideLandmarks].filter(Boolean);

  let waistCircumferenceCm;
  let hipCircumferenceCm;

  if (profileShots.length > 0) {
    const depthSamples = profileShots.map((lm) => {
      const s = calibrateScale(lm, heightCm).scale;
      // In a profile photo, torso "depth" is approximated as the horizontal
      // pixel spread of the hip/shoulder landmarks visible in profile — a
      // rough but real, inspectable measurement, not an invented number.
      const hipDepthCm = pixelDist(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP]) * s * 1.8;
      const shoulderDepthCm = pixelDist(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]) * s * 1.8;
      return { hipDepthCm, waistDepthCm: shoulderDepthCm * 0.4 + hipDepthCm * 0.6 };
    });
    const rawAvgWaistDepthCm = average(depthSamples.map((d) => d.waistDepthCm));
    const rawAvgHipDepthCm = average(depthSamples.map((d) => d.hipDepthCm));

    // A real, physical constraint, not an arbitrary tolerance: this raw
    // depth estimate is extremely sensitive to exactly how close to a true
    // 90-degree profile the capture actually was — even a modest angle
    // imperfection makes the two hip landmarks visually spread apart far
    // more than genuine front-to-back body depth ever would, and that
    // error compounds through the 1.8x multiplier and the ellipse formula
    // into wildly, physically-impossible circumferences (confirmed
    // directly: simulating a realistic, only mildly imperfect profile
    // angle already produces measurements several times too large).
    // Front-to-back torso depth is well-established anthropometrically to
    // run roughly 50-85% of side-to-side width for adult body types —
    // clamping to that range against the front-view width (which comes
    // from a much less angle-sensitive measurement) prevents this specific
    // failure mode without discarding a genuinely good profile capture,
    // since real, well-aligned captures should already fall inside it.
    const avgWaistDepthCm = clampDepthToWidth(rawAvgWaistDepthCm, waistWidthCm);
    const avgHipDepthCm = clampDepthToWidth(rawAvgHipDepthCm, hipWidthCm);

    waistCircumferenceCm = ellipsePerimeter(waistWidthCm / 2, avgWaistDepthCm / 2);
    hipCircumferenceCm = ellipsePerimeter(hipWidthCm / 2, avgHipDepthCm / 2);
  } else {
    // No profile photo at all: fall back to a circular approximation (less
    // accurate — flagged in the returned object so the UI/AI commentary can
    // note it).
    waistCircumferenceCm = Math.PI * waistWidthCm;
    hipCircumferenceCm = Math.PI * hipWidthCm;
  }

  // Final, robust safeguard - not a substitute for getting calibration
  // right, but a backstop that catches any upstream error regardless of
  // its specific cause. Real human anthropometry bounds these ratios even
  // for very large body types: shoulder (biacromial) width tops out
  // around a third of standing height, and waist/hip circumference, even
  // for someone genuinely very heavy, essentially never exceeds standing
  // height itself. These bounds are deliberately generous - wide enough
  // to never touch a real body, only to catch results that are already
  // physically impossible (whatever produced them upstream).
  const rawShoulderWidthCm = shoulderWidthCm;
  const rawWaistCircumferenceCm = waistCircumferenceCm;
  const rawHipCircumferenceCm = hipCircumferenceCm;
  const finalShoulderWidthCm = Math.min(shoulderWidthCm, heightCm * 0.35);
  const finalWaistCircumferenceCm = Math.min(waistCircumferenceCm, heightCm * 1.0);
  const finalHipCircumferenceCm = Math.min(hipCircumferenceCm, heightCm * 1.05);

  return {
    shoulderWidthCm: round1(finalShoulderWidthCm),
    waistCircumferenceCm: round1(finalWaistCircumferenceCm),
    hipCircumferenceCm: round1(finalHipCircumferenceCm),
    profileShotsUsed: profileShots.length,
    _debug: {
      frontRawPixelSpan: round1(frontScaleInfo.rawPixelSpan * 1000) / 1000,
      frontScaleClamped: frontScaleInfo.wasClamped,
      frontScale: round1(scale),
      frontNoseY: round1(frontScaleInfo.noseY * 1000) / 1000,
      frontAnkleY: round1(frontScaleInfo.ankleY * 1000) / 1000,
      hipWidthCm: round1(hipWidthCm),
      waistWidthCm: round1(waistWidthCm),
      finalClampApplied: finalShoulderWidthCm !== rawShoulderWidthCm
        || finalWaistCircumferenceCm !== rawWaistCircumferenceCm
        || finalHipCircumferenceCm !== rawHipCircumferenceCm,
      rawShoulderWidthCm: round1(rawShoulderWidthCm),
      rawWaistCircumferenceCm: round1(rawWaistCircumferenceCm),
      rawHipCircumferenceCm: round1(rawHipCircumferenceCm),
    },
  };
}

// Front-to-back torso depth is well-established anthropometrically to run
// roughly 50-85% of side-to-side width for adult body types. Used as a
// sanity bound on the profile-derived depth estimate, which is far more
// sensitive to capture-angle imperfection than the front-view width is.
const MIN_DEPTH_TO_WIDTH_RATIO = 0.5;
const MAX_DEPTH_TO_WIDTH_RATIO = 0.85;
function clampDepthToWidth(depthCm, widthCm) {
  const minDepth = widthCm * MIN_DEPTH_TO_WIDTH_RATIO;
  const maxDepth = widthCm * MAX_DEPTH_TO_WIDTH_RATIO;
  return Math.min(Math.max(depthCm, minDepth), maxDepth);
}

function average(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Ramanujan's second approximation for ellipse perimeter — public-domain math.
function ellipsePerimeter(a, b) {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ---- Neck circumference estimation (no tape measure required) ------------
// Most people don't own a tape measure, so requiring a manual neck entry
// was real friction. Estimated instead from the neck-circumference-to-
// shoulder-width ratio reported in a 2025 peer-reviewed cross-sectional
// study (Marimuthu et al., Cureus 17(8): e90344 — "The Neck Circumference-
// to-Shoulder Width Ratio as a Novel Anthropometric Indicator"): mean NC/SW
// ratio 0.9 (SD 0.1) across 98 adults. Cross-checked against an independent
// source's average neck circumference figures (Ebonyi market-survey study:
// male ~38.0cm, female ~34.5cm) before using — both back out to a plausible
// ~38-42cm shoulder width, in line with typical adult biacromial breadth.
// This is a rougher estimate than a real tape measurement (the study's own
// SD implies roughly ±10% uncertainty on top of the shoulder-width estimate
// itself) — a manual entry is still accepted and takes priority when given,
// for anyone who has a tape measure and wants more precision.
const NECK_TO_SHOULDER_RATIO = 0.9;

export function estimateNeckFromShoulderWidth(shoulderWidthCm) {
  if (!shoulderWidthCm) return null;
  return Math.round(shoulderWidthCm * NECK_TO_SHOULDER_RATIO * 10) / 10;
}

// ---- Body fat estimation: Hodgdon-Beckett (1984) U.S. Navy method --------
// Public domain, DoD-standard, published formula. All measurements in cm.
// Validated to roughly ±3-4% of hydrostatic weighing in the original
// research — real accuracy, but not lab-grade precision.
export function estimateBodyFatPercent({ gender, waistCm, hipCm, neckCm, heightCm }) {
  if (!waistCm || !neckCm || !heightCm) return null;
  const log10 = Math.log10;

  if (gender === 'female') {
    if (!hipCm) return null;
    const bf = 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.22100 * log10(heightCm)) - 450;
    return clampPercent(bf);
  }

  const bf = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450;
  return clampPercent(bf);
}

function clampPercent(bf) {
  if (!Number.isFinite(bf)) return null;
  return Math.round(Math.max(2, Math.min(60, bf)) * 10) / 10;
}

// ---- Public entry point ----------------------------------------------------

/**
 * Runs the full local estimation pipeline. Landmarks must already be
 * extracted by the capture screen (via the same MediaPipe pose-detection
 * stack used for form-check — see app/body-scan/capture.jsx).
 *
 * `neckCm` is now optional — pass it only if the user manually entered a
 * real tape-measure reading. When omitted, neck circumference is estimated
 * from the scan's own shoulder-width measurement instead.
 */
export function runLocalBodyScan({
  frontLandmarks, sideLandmarks, rightLandmarks, leftLandmarks, heightCm, neckCm, gender,
}) {
  const measurements = estimateMeasurementsFromLandmarks({
    frontLandmarks, sideLandmarks, rightLandmarks, leftLandmarks, heightCm,
  });

  const resolvedNeckCm = neckCm ?? estimateNeckFromShoulderWidth(measurements.shoulderWidthCm);
  const neckWasEstimated = neckCm == null;

  const bodyFatPercent = estimateBodyFatPercent({
    gender,
    waistCm: measurements.waistCircumferenceCm,
    hipCm: measurements.hipCircumferenceCm,
    neckCm: resolvedNeckCm,
    heightCm,
  });

  return {
    measurements: { ...measurements, neckCm: resolvedNeckCm ?? null, neckWasEstimated },
    bodyFatPercent,
    method: neckWasEstimated
      ? 'pose-landmark + Navy circumference formula (Hodgdon-Beckett 1984), neck estimated from shoulder width'
      : 'pose-landmark + Navy circumference formula (Hodgdon-Beckett 1984)',
  };
}

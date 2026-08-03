// lib/rotationTracker.js
//
// Turns raw per-frame pose landmarks into scan-step progress, using real
// signals rather than a fixed timer:
//   - shoulder-width ratio (current shoulder-to-shoulder pixel distance vs.
//     the front-pose baseline) shrinks as a person turns toward profile —
//     used to detect "reached right/left profile".
//   - nose landmark visibility drops sharply when the back is to the
//     camera (the face isn't visible) — used to detect "facing away".
//   - frame-to-frame shoulder-ratio delta, normalized by elapsed time,
//     flags turning too fast for reliable tracking ("turn slower").
//
// Pure functions, no React/camera/speech dependencies — testable in
// isolation, which is how this was verified before wiring into the screen.

const LM = { NOSE: 0, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 };

export const SCAN_STEPS = ['front', 'right', 'back', 'left', 'done'];

const PROFILE_RATIO_THRESHOLD = 0.45; // shoulder ratio below this ~= profile reached
const BACK_VISIBILITY_THRESHOLD = 0.3; // nose visibility below this ~= back to camera
const FRONT_HOLD_MS = 900; // how long to hold still at the front step
const TURN_TOO_FAST_RATIO_DELTA = 0.18; // per ~150ms frame gap
const TURN_SLOWER_COOLDOWN_MS = 3000;

function shoulderWidth(landmarks) {
  const l = landmarks[LM.LEFT_SHOULDER];
  const r = landmarks[LM.RIGHT_SHOULDER];
  return Math.hypot(l.x - r.x, l.y - r.y);
}

export function createRotationTracker() {
  let stepIndex = 0;
  let frontBaselineWidth = null;
  let frontHoldStartedAt = null;
  let lastFrameAt = null;
  let lastShoulderRatio = 1;
  let lastTurnSlowerAt = null;
  const capturedLandmarks = {};

  function reset() {
    stepIndex = 0;
    frontBaselineWidth = null;
    frontHoldStartedAt = null;
    lastFrameAt = null;
    lastShoulderRatio = 1;
    lastTurnSlowerAt = null;
    Object.keys(capturedLandmarks).forEach((k) => delete capturedLandmarks[k]);
  }

  /**
   * Feed one frame's landmarks in. Returns:
   * { step, stepIndex, progress: 0-1, turnSlower: bool, justCapturedStep: string|null }
   */
  function processFrame(landmarks, now = Date.now()) {
    const step = SCAN_STEPS[stepIndex];
    if (step === 'done' || !landmarks) {
      return { step, stepIndex, progress: 1, turnSlower: false, justCapturedStep: null, ratio: null, noseVisibility: null };
    }

    const width = shoulderWidth(landmarks);
    const noseVisibility = landmarks[LM.NOSE]?.visibility ?? 1;
    let turnSlower = false;
    let justCapturedStep = null;
    let ratio = null;

    if (frontBaselineWidth != null) {
      ratio = width / frontBaselineWidth;
      if (lastFrameAt != null) {
        const dt = now - lastFrameAt;
        const ratioDelta = Math.abs(ratio - lastShoulderRatio);
        // scale the "too fast" delta threshold by how much time actually
        // passed, so a slow device with sparser frames isn't unfairly
        // flagged
        const expectedDelta = TURN_TOO_FAST_RATIO_DELTA * (dt / 150);
        if (
          (step === 'right' || step === 'back' || step === 'left') &&
          ratioDelta > expectedDelta &&
          (lastTurnSlowerAt == null || now - lastTurnSlowerAt > TURN_SLOWER_COOLDOWN_MS)
        ) {
          turnSlower = true;
          lastTurnSlowerAt = now;
        }
      }
      lastShoulderRatio = ratio;

      if (step === 'right' && ratio < PROFILE_RATIO_THRESHOLD) {
        capturedLandmarks.right = landmarks;
        justCapturedStep = 'right';
        stepIndex += 1;
      } else if (step === 'back' && noseVisibility < BACK_VISIBILITY_THRESHOLD) {
        capturedLandmarks.back = landmarks;
        justCapturedStep = 'back';
        stepIndex += 1;
      } else if (step === 'left' && ratio < PROFILE_RATIO_THRESHOLD && noseVisibility > BACK_VISIBILITY_THRESHOLD) {
        capturedLandmarks.left = landmarks;
        justCapturedStep = 'left';
        stepIndex += 1;
      }
    }

    if (step === 'front') {
      // Require a brief steady hold (not just one lucky frame) before
      // locking in the baseline — reduces false-starts from a stray frame.
      if (frontHoldStartedAt == null) frontHoldStartedAt = now;
      if (now - frontHoldStartedAt > FRONT_HOLD_MS) {
        frontBaselineWidth = width;
        capturedLandmarks.front = landmarks;
        justCapturedStep = 'front';
        stepIndex += 1;
      }
    }

    lastFrameAt = now;

    const progress = Math.min(1, stepIndex / (SCAN_STEPS.length - 1));
    return { step: SCAN_STEPS[stepIndex], stepIndex, progress, turnSlower, justCapturedStep, ratio, noseVisibility };
  }

  function getCapturedLandmarks() {
    return { ...capturedLandmarks };
  }

  /**
   * Manually advance past the current step, for when someone is stuck for
   * any reason - poor lighting, an unusual angle, or a detection edge case.
   * Captures whatever landmarks are currently available (may be null if
   * nothing's been detected at all) rather than requiring the automatic
   * threshold to have been met, and returns the same shape processFrame
   * does so the calling code can handle both paths identically.
   */
  function forceAdvanceStep(landmarks) {
    const step = SCAN_STEPS[stepIndex];
    if (step === 'done') {
      return { step, stepIndex, progress: 1, turnSlower: false, justCapturedStep: null, ratio: null, noseVisibility: null };
    }
    if (step === 'front' && landmarks) {
      frontBaselineWidth = shoulderWidth(landmarks);
    }
    capturedLandmarks[step] = landmarks;
    stepIndex += 1;
    const progress = Math.min(1, stepIndex / (SCAN_STEPS.length - 1));
    return { step: SCAN_STEPS[stepIndex], stepIndex, progress, turnSlower: false, justCapturedStep: step, ratio: null, noseVisibility: null };
  }

  return { processFrame, getCapturedLandmarks, forceAdvanceStep, reset };
}

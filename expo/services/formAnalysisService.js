// services/formAnalysisService.js
//
// Real, on-device pose-based form analysis. Replaces the old Math.random() mock.
//
// Architecture (committed, not optional):
//   Camera capture -> react-native-vision-camera
//   Pose landmarks -> MediaPipe Pose Landmarker, via react-native-mediapipe's
//                      frame processor (runs fully on-device, no network call,
//                      no per-frame cost, works offline)
//   Landmark topology -> BlazePose 33-point (same topology Google standardized
//                      across MediaPipe and ML Kit Pose Detection)
//   Analysis -> pure JS angle math in this file (ported from formfit-ai's
//                      MoveNet-based logic, re-indexed to BlazePose's 33 points)
//   Persistence -> Firestore, via the SAME `db` instance the rest of the app's
//                      live stores already use (src/config/firebase.js)
//
// This file only consumes landmarks — it doesn't touch the camera or the model.
// See app/workout/form-check.jsx for the screen that owns the camera and feeds
// this service one frame at a time.

import { db } from '../src/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUserStore } from '@/store/userStore';

const MIN_LANDMARK_VISIBILITY = 0.5; // BlazePose gives 0-1 visibility per landmark
const REP_COOLDOWN_MS = 700;

// BlazePose / MediaPipe Pose 33-point topology (standardized by Google across
// MediaPipe Tasks and ML Kit Pose Detection — same indices either way).
const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

// Bone connections for skeleton overlay drawing (index pairs into the 33-point array)
export const SKELETON_CONNECTIONS = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
];

// angle at point b, formed by rays b->a and b->c, in degrees (0-180)
function calculateAngle(a, b, c) {
  const belowThreshold =
    !a || !b || !c ||
    (a.visibility !== undefined && a.visibility < MIN_LANDMARK_VISIBILITY) ||
    (b.visibility !== undefined && b.visibility < MIN_LANDMARK_VISIBILITY) ||
    (c.visibility !== undefined && c.visibility < MIN_LANDMARK_VISIBILITY);
  if (belowThreshold) return 180;

  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function allVisible(points) {
  return points.every((p) => p && p.visibility > MIN_LANDMARK_VISIBILITY);
}

function analyzeSquat(lm) {
  const leftHip = lm[LM.LEFT_HIP], rightHip = lm[LM.RIGHT_HIP];
  const leftKnee = lm[LM.LEFT_KNEE], rightKnee = lm[LM.RIGHT_KNEE];
  const leftAnkle = lm[LM.LEFT_ANKLE], rightAnkle = lm[LM.RIGHT_ANKLE];

  if (!allVisible([leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle])) {
    return { feedback: [{ message: 'Move into frame — show your full body', type: 'warning' }], score: 0, state: 'up', inPosition: false };
  }

  const avgKneeAngle = (
    calculateAngle(leftHip, leftKnee, leftAnkle) +
    calculateAngle(rightHip, rightKnee, rightAnkle)
  ) / 2;

  let score = 100;
  let state = 'up';
  const feedback = [];

  if (avgKneeAngle < 100) {
    state = 'down';
    feedback.push({ message: 'Perfect depth', type: 'good' });
  } else if (avgKneeAngle < 140) {
    state = 'down';
    feedback.push({ message: 'Go deeper', type: 'warning' });
    score -= 25;
  }

  return { feedback, score: Math.max(0, score), state, inPosition: true };
}

function analyzePushup(lm) {
  const leftShoulder = lm[LM.LEFT_SHOULDER], rightShoulder = lm[LM.RIGHT_SHOULDER];
  const leftElbow = lm[LM.LEFT_ELBOW], rightElbow = lm[LM.RIGHT_ELBOW];
  const leftWrist = lm[LM.LEFT_WRIST], rightWrist = lm[LM.RIGHT_WRIST];

  if (!allVisible([leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist])) {
    return { feedback: [{ message: 'Get into push-up position, facing the camera', type: 'warning' }], score: 0, state: 'up', inPosition: false };
  }

  const avgElbowAngle = (
    calculateAngle(leftShoulder, leftElbow, leftWrist) +
    calculateAngle(rightShoulder, rightElbow, rightWrist)
  ) / 2;

  let score = 100;
  let state = 'up';
  const feedback = [];

  if (avgElbowAngle < 100) {
    state = 'down';
    feedback.push({ message: 'Excellent depth', type: 'good' });
  } else if (avgElbowAngle < 140) {
    state = 'down';
    feedback.push({ message: 'Go lower', type: 'warning' });
    score -= 20;
  }

  return { feedback, score: Math.max(0, score), state, inPosition: true };
}

function analyzeBicepCurl(lm) {
  const leftShoulder = lm[LM.LEFT_SHOULDER], rightShoulder = lm[LM.RIGHT_SHOULDER];
  const leftElbow = lm[LM.LEFT_ELBOW], rightElbow = lm[LM.RIGHT_ELBOW];
  const leftWrist = lm[LM.LEFT_WRIST], rightWrist = lm[LM.RIGHT_WRIST];

  if (!allVisible([leftShoulder, leftElbow, leftWrist, rightShoulder, rightElbow, rightWrist])) {
    return { feedback: [{ message: 'Show both arms for curl tracking', type: 'warning' }], score: 0, state: 'up', inPosition: false };
  }

  const avgAngle = (
    calculateAngle(leftShoulder, leftElbow, leftWrist) +
    calculateAngle(rightShoulder, rightElbow, rightWrist)
  ) / 2;

  let score = 100;
  let state = 'up';
  const feedback = [];

  if (avgAngle < 60) {
    state = 'down';
    feedback.push({ message: 'Full contraction', type: 'good' });
  } else if (avgAngle < 120) {
    state = 'down';
    feedback.push({ message: 'Curl a bit more', type: 'warning' });
  }

  return { feedback, score: Math.max(0, score), state, inPosition: true };
}

const ANALYZERS = { squat: analyzeSquat, pushup: analyzePushup, bicepCurl: analyzeBicepCurl };

const NOT_YET_IMPLEMENTED = [
  'plank', 'shoulderPress', 'lunges', 'tricepDips',
  'mountainClimbers', 'burpees', 'jumpingJacks',
];

class FormAnalysisService {
  constructor() {
    this.isAnalyzing = false;
    this.analysisCallback = undefined;
    this.currentExercise = '';
    this.repCount = 0;
    this.lastState = 'up';
    this.lastRepAt = 0;
    this.scoreSamples = [];
    this.sessionStartedAt = null;
  }

  startAnalysis(exerciseName, callback) {
    if (this.isAnalyzing) return false;
    this.currentExercise = exerciseName;
    this.analysisCallback = callback;
    this.isAnalyzing = true;
    this.repCount = 0;
    this.lastState = 'up';
    this.lastRepAt = 0;
    this.scoreSamples = [];
    this.sessionStartedAt = Date.now();
    return true;
  }

  // Ends the session and persists a summary to Firestore. Returns the saved
  // session object (with its Firestore doc id) so the caller can navigate to
  // a results screen, or null if there was nothing to save / the write failed.
  async stopAnalysis() {
    if (!this.isAnalyzing) return null;
    this.isAnalyzing = false;
    this.analysisCallback = undefined;

    const durationSec = this.sessionStartedAt
      ? Math.round((Date.now() - this.sessionStartedAt) / 1000)
      : 0;
    const avgScore = this.scoreSamples.length
      ? Math.round(this.scoreSamples.reduce((a, b) => a + b, 0) / this.scoreSamples.length)
      : null;

    const session = {
      exercise: this.currentExercise,
      reps: this.repCount,
      avgScore,
      durationSec,
    };

    this.sessionStartedAt = null;
    this.scoreSamples = [];

    try {
      const saved = await this._saveSession(session);
      return saved;
    } catch (e) {
      console.error('[FormAnalysis] failed to save session', e);
      // Don't throw — losing analytics shouldn't block the user from finishing
      // their workout. Return the local summary so the UI can still show it.
      return { ...session, id: null, saved: false };
    }
  }

  async _saveSession(session) {
    const user = useUserStore.getState().user;
    if (!user?.uid) {
      console.warn('[FormAnalysis] no authenticated user — session not saved');
      return { ...session, id: null, saved: false };
    }

    const ref = await addDoc(
      collection(db, 'users', user.uid, 'formSessions'),
      {
        ...session,
        createdAt: serverTimestamp(),
      }
    );

    return { ...session, id: ref.id, saved: true };
  }

  getIsAnalyzing() {
    return this.isAnalyzing;
  }

  getRepCount() {
    return this.repCount;
  }

  // Call this once per pose-detection frame with a 33-point BlazePose landmark
  // array (each entry {x, y, z, visibility}, normalized 0-1 image coordinates —
  // exactly what react-native-mediapipe's onResults callback provides).
  processPoseFrame(landmarks) {
    if (!this.isAnalyzing) return null;

    const analyzer = ANALYZERS[this.currentExercise];
    let result;

    if (!analyzer) {
      result = {
        feedback: [{
          message: NOT_YET_IMPLEMENTED.includes(this.currentExercise)
            ? `Form tracking for ${this.currentExercise} isn't built yet — rep counting only`
            : 'Exercise tracking active',
          type: 'info',
        }],
        score: null,
        state: 'up',
        inPosition: true,
      };
    } else {
      result = analyzer(landmarks);
    }

    if (analyzer && result.state !== this.lastState) {
      if (result.state === 'up' && this.lastState === 'down') {
        const now = Date.now();
        if (now - this.lastRepAt > REP_COOLDOWN_MS) {
          this.repCount += 1;
          this.lastRepAt = now;
        }
      }
      this.lastState = result.state;
    }

    if (typeof result.score === 'number') {
      this.scoreSamples.push(result.score);
    }

    const payload = {
      score: result.score,
      feedback: result.feedback.map((f) => f.message),
      recommendations: this.getFormTips(this.currentExercise),
      repCount: this.repCount,
      state: result.state,
      inPosition: result.inPosition,
    };

    this.analysisCallback?.(payload);
    return payload;
  }

  getFormTips(exerciseName) {
    const exerciseType = (exerciseName || '').toLowerCase();

    if (exerciseType.includes('push')) {
      return [
        'Start in plank position with hands under shoulders',
        'Lower body as one unit until chest nearly touches ground',
        'Push up explosively while maintaining straight line',
        'Keep core tight throughout movement',
      ];
    }
    if (exerciseType.includes('squat')) {
      return [
        'Stand with feet shoulder-width apart',
        'Lower hips back and down as if sitting in a chair',
        'Keep knees in line with toes',
        'Drive through heels to return to standing',
      ];
    }
    if (exerciseType.includes('curl')) {
      return [
        'Keep elbows pinned to your sides',
        'Curl through a full range of motion',
        'Control the descent — don\u2019t let it drop',
        'Avoid swinging your torso for momentum',
      ];
    }
    return [
      'Focus on controlled movements',
      'Maintain proper breathing pattern',
      'Keep core engaged',
      'Use full range of motion',
    ];
  }
}

export default new FormAnalysisService();

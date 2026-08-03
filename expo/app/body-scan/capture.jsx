// app/body-scan/capture.jsx
//
// Turntable-style body scan capture: the user holds still facing the
// camera, then slowly turns in place while the app tracks rotation
// progress in real time from pose landmarks (see lib/rotationTracker.js)
// and calls out each step ("turn right", "face away from the camera",
// "turn left") plus an adaptive "turn slower" correction if the rotation
// is too fast for reliable tracking. A segmented circular progress ring
// and on-screen caption mirror every spoken prompt for anyone who can't
// or doesn't want to rely on audio — voice guidance has its own toggle.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Switch, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { usePoseDetection, Delegate, RunningMode, KnownPoseLandmarks } from 'react-native-mediapipe';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { createRotationTracker } from '@/lib/rotationTracker';
import {
  loadVoiceGuidancePreference, setVoiceGuidanceEnabled, speakPrompt, stopSpeaking,
} from '@/services/voiceGuidanceService';

const POSE_MODEL = 'pose_landmarker_full.task';
const RING_SIZE = 88;

// A pose being detected at all isn't the same as the full body being in
// frame - MediaPipe happily returns landmarks for a close-up face shot too,
// just with low visibility on everything below the shoulders. This checks
// that landmarks spanning head-to-ankles are each confidently visible,
// which is what the "step back, get your whole body in frame" indicator
// is actually supposed to mean.
const FULL_BODY_VISIBILITY_THRESHOLD = 0.6;
function isFullBodyVisible(pose) {
  if (!pose) return false;
  const vis = (index) => pose[index]?.visibility ?? 0;
  const pairMax = (leftIndex, rightIndex) => Math.max(vis(leftIndex), vis(rightIndex));

  const headVisible = vis(KnownPoseLandmarks.nose) >= FULL_BODY_VISIBILITY_THRESHOLD;
  const shouldersVisible =
    pairMax(KnownPoseLandmarks.leftShoulder, KnownPoseLandmarks.rightShoulder) >= FULL_BODY_VISIBILITY_THRESHOLD;
  const hipsVisible =
    pairMax(KnownPoseLandmarks.leftHip, KnownPoseLandmarks.rightHip) >= FULL_BODY_VISIBILITY_THRESHOLD;
  const anklesVisible =
    pairMax(KnownPoseLandmarks.leftAnkle, KnownPoseLandmarks.rightAnkle) >= FULL_BODY_VISIBILITY_THRESHOLD;

  return headVisible && shouldersVisible && hipsVisible && anklesVisible;
}
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const FEET_TO_CM = 30.48;
const INCH_TO_CM = 2.54;
const LB_TO_KG = 0.453592;

const STEP_PROMPTS = {
  front: 'Stand facing the camera and hold still',
  right: "Great — now slowly turn to your right",
  back: 'Keep turning until your back faces the camera',
  left: 'Perfect — now continue turning to your left',
  done: 'Scan complete!',
};

const STEP_CAPTIONS = {
  front: 'Hold still, facing forward',
  right: 'Slowly turn right →',
  back: 'Keep going — show your back',
  left: '← Continue turning left',
  done: 'All done!',
};

export default function BodyScanCaptureScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { runScan, isScanning, error } = useBodyCompositionStore();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [unitSystem, setUnitSystem] = useState('metric'); // 'metric' | 'imperial' — one toggle, applied consistently to height/weight/neck rather than mixing units per field

  // Height — cm in metric mode, feet+inches in imperial mode
  const [heightCmInput, setHeightCmInput] = useState(user?.heightCm ? String(user.heightCm) : '');
  const [heightFeetInput, setHeightFeetInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');

  // Weight — single field, unit follows unitSystem
  const [weightInput, setWeightInput] = useState(user?.weightKg ? String(user.weightKg) : '');

  const [age, setAgeInput] = useState(user?.age ? String(user.age) : '');

  const [neckInput, setNeckInput] = useState(''); // optional — see the "I have a tape measure" toggle below; unit follows unitSystem
  const [showNeckInput, setShowNeckInput] = useState(false);
  const [gender, setGender] = useState(user?.gender || 'male');
  const [showProfileForm, setShowProfileForm] = useState(!user?.heightCm);

  const [step, setStep] = useState('front');
  const [ringProgress, setRingProgress] = useState(0); // 0-1 for the CURRENT step's segment
  const [overallProgress, setOverallProgress] = useState(0);
  const [captionOverride, setCaptionOverride] = useState(null); // temporarily replaces the step caption, e.g. for "turn slower"
  const [tracking, setTracking] = useState(false); // is a body currently detected

  // Temporary diagnostics: the reported symptom ("nothing happens") gives
  // no signal about *where* in camera frame -> native detector -> JS
  // callback -> UI the chain actually breaks. onResults/onError run on
  // the JS thread via the native event bridge (not inside the frame
  // processor worklet itself), so counting real invocations here
  // reliably answers the one question code inspection alone couldn't:
  // is the native side calling back into JS at all, even with an empty
  // result, or not.
  const [framesSeen, setFramesSeen] = useState(0);
  const [actualPixelFormat, setActualPixelFormat] = useState(null);
  const [resultsReceived, setResultsReceived] = useState(0);
  const [posesFound, setPosesFound] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [trackerDebug, setTrackerDebug] = useState({ ratio: null, noseVisibility: null });

  const trackerRef = useRef(null);
  const captionOverrideTimeoutRef = useRef(null);
  if (trackerRef.current == null) trackerRef.current = createRotationTracker();

  // Canonical metric values — every downstream consumer (the estimation
  // math, Firestore, the AI prompt) always works in cm/kg regardless of
  // which unit system the person is currently typing in. Converted here,
  // once, rather than scattered across every call site.
  const getHeightCm = () => {
    if (unitSystem === 'metric') return parseFloat(heightCmInput) || null;
    const ft = parseFloat(heightFeetInput) || 0;
    const inch = parseFloat(heightInchesInput) || 0;
    const cm = ft * FEET_TO_CM + inch * INCH_TO_CM;
    return cm > 0 ? cm : null;
  };
  const getWeightKg = () => {
    const w = parseFloat(weightInput);
    if (!w) return null;
    return unitSystem === 'metric' ? w : w * LB_TO_KG;
  };
  const getNeckCm = () => {
    const n = parseFloat(neckInput);
    if (!n) return undefined; // undefined (not null) — signals "auto-estimate" to the service
    return unitSystem === 'metric' ? n : n * INCH_TO_CM;
  };
  const heightIsValid = getHeightCm() != null;

  useEffect(() => {
    loadVoiceGuidancePreference().then(setVoiceEnabledState);
  }, []);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    // Speak the prompt for whichever step we land on, including the first.
    if (!showProfileForm && step !== 'done') {
      speakPrompt(STEP_PROMPTS[step]);
    }
    return () => stopSpeaking();
  }, [step, showProfileForm]);

  const handleToggleVoice = async (value) => {
    setVoiceEnabledState(value);
    await setVoiceGuidanceEnabled(value);
  };

  const handlePoseResults = useCallback((results) => {
    setResultsReceived((n) => n + 1);
    const pose = results?.results?.[0]?.landmarks?.[0];
    if (pose) setPosesFound((n) => n + 1);
    const fullBodyVisible = isFullBodyVisible(pose);
    setTracking(fullBodyVisible);
    if (!fullBodyVisible) return;

    const result = trackerRef.current.processFrame(pose, Date.now());
    setTrackerDebug({ ratio: result.ratio, noseVisibility: result.noseVisibility });
    setStep(result.step);
    setOverallProgress(result.progress);

    if (result.justCapturedStep) {
      setRingProgress(0); // reset the per-step ring for the new step
    } else if (result.step !== 'front' && result.step !== 'done') {
      // Soft, non-authoritative visual feedback within a turning step —
      // there's no precise "degrees remaining" signal, so this nudges the
      // ring forward over a a few seconds as a sense of motion rather than
      // claiming false precision.
      setRingProgress((p) => Math.min(0.92, p + 0.03));
    }

    if (result.turnSlower) {
      speakPrompt('Please turn a little slower');
      // Reuses the same caption box everything else speaks through, instead
      // of a separate banner — the voice prompt and the visual aid are the
      // same on-screen element, not two competing ones.
      setCaptionOverride('Turn a little slower');
      if (captionOverrideTimeoutRef.current) clearTimeout(captionOverrideTimeoutRef.current);
      captionOverrideTimeoutRef.current = setTimeout(() => setCaptionOverride(null), 2200);
    }

    if (result.step === 'done' && result.justCapturedStep === 'left') {
      handleScanComplete();
    }
  }, []);

  const handleScanComplete = async () => {
    speakPrompt('Scan complete!');
    const captured = trackerRef.current.getCapturedLandmarks();
    const parsedAge = age.trim() === '' ? null : parseInt(age, 10);
    try {
      const { scan } = await runScan({
        uid: user?.uid,
        frontLandmarks: captured.front,
        rightLandmarks: captured.right,
        leftLandmarks: captured.left,
        heightCm: getHeightCm(),
        neckCm: getNeckCm(),
        weightKg: getWeightKg(),
        age: parsedAge,
        gender,
        goal: (user?.goals && user.goals[0]) || 'general fitness',
      });
      router.replace(`/body-scan/${scan.id}`);
    } catch (e) {
      // error surfaced via the store's `error` field, tracker stays at
      // 'done' — user can back out and retry
    }
  };

  const handleRetry = () => {
    trackerRef.current.reset();
    setStep('front');
    setRingProgress(0);
    setOverallProgress(0);
  };

  const { cameraDevice, cameraViewLayoutChangeHandler, frameProcessor: innerFrameProcessorObj, fpsMode } = usePoseDetection(
    { onResults: handlePoseResults, onError: (e) => { setLastError(e?.message || String(e)); console.error('[BodyScan] pose error', e); } },
    RunningMode.LIVE_STREAM,
    POSE_MODEL,
    { delegate: Delegate.GPU, numPoses: 1, minPoseDetectionConfidence: 0.5 }
  );

  // Temporary diagnostic, one layer more fundamental than onResults/onError:
  // those only tell us whether MediaPipe's native module calls back into JS.
  // This tells us whether the camera is delivering frames to the frame
  // processor at all, independent of MediaPipe entirely - confirmed
  // against the real vision-camera source that useFrameProcessor returns
  // { frameProcessor, type: 'readonly' }, not a directly-callable function,
  // before wrapping it this way.
  const incrementFramesSeen = useRunOnJS(() => {
    setFramesSeen((n) => n + 1);
  }, []);
  const reportPixelFormat = useRunOnJS((format) => {
    setActualPixelFormat((prev) => prev ?? format);
  }, []);
  const innerFrameProcessor = innerFrameProcessorObj.frameProcessor;
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    incrementFramesSeen();
    reportPixelFormat(frame.pixelFormat);
    innerFrameProcessor(frame);
  }, [innerFrameProcessor, incrementFramesSeen, reportPixelFormat]);

  if (!device) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Body Scan" showBack />
        <View style={styles.centerMessage}>
          <Text style={styles.centerMessageText}>No camera available on this device.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Body Scan" showBack />
        <View style={styles.centerMessage}>
          <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerMessageText}>Camera access is needed to scan your body composition.</Text>
          <PrimaryButton title="Grant Camera Access" onPress={requestPermission} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  if (showProfileForm) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Body Scan" showBack />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        >
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formWrap}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.formTitle}>A few quick details</Text>
            <Text style={styles.formSubtitle}>
              Used with your scan to estimate body composition (Navy circumference method).
              Neck size is estimated from the scan itself, so you don't need a tape measure.
            </Text>

            <View style={styles.unitToggleRow}>
              {['metric', 'imperial'].map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnitSystem(u)}
                  style={[styles.unitChip, unitSystem === u && styles.unitChipActive]}
                >
                  <Text style={[styles.unitChipText, unitSystem === u && styles.unitChipTextActive]}>
                    {u === 'metric' ? 'Metric (cm / kg)' : 'Imperial (ft / lb)'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Height</Text>
              {unitSystem === 'metric' ? (
                <TextInput
                  style={styles.input} keyboardType="numeric" value={heightCmInput} onChangeText={setHeightCmInput}
                  placeholder="e.g. 178 cm" placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.input, styles.rowInputHalf]} keyboardType="numeric"
                    value={heightFeetInput} onChangeText={setHeightFeetInput}
                    placeholder="5 ft" placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    style={[styles.input, styles.rowInputHalf]} keyboardType="numeric"
                    value={heightInchesInput} onChangeText={setHeightInchesInput}
                    placeholder="10 in" placeholderTextColor={colors.textSecondary}
                  />
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Weight (optional)</Text>
              <TextInput
                style={styles.input} keyboardType="numeric" value={weightInput} onChangeText={setWeightInput}
                placeholder={unitSystem === 'metric' ? 'e.g. 75 kg' : 'e.g. 165 lb'}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Age (optional)</Text>
              <TextInput
                style={styles.input} keyboardType="numeric" value={age} onChangeText={setAgeInput}
                placeholder="e.g. 32" placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Sex (for the estimation formula)</Text>
              <View style={styles.genderRow}>
                {['male', 'female'].map((g) => (
                  <Pressable key={g} onPress={() => setGender(g)} style={[styles.genderChip, gender === g && styles.genderChipActive]}>
                    <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>
                      {g === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Pressable onPress={() => setShowNeckInput((v) => !v)} style={styles.neckToggleRow}>
                <Ionicons name={showNeckInput ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textSecondary} />
                <Text style={styles.neckToggleText}>I have a tape measure and want to enter my neck size</Text>
              </Pressable>
              {showNeckInput && (
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]} keyboardType="numeric"
                  value={neckInput} onChangeText={setNeckInput}
                  placeholder={unitSystem === 'metric' ? 'e.g. 38 cm — optional' : 'e.g. 15 in — optional'}
                  placeholderTextColor={colors.textSecondary}
                />
              )}
            </View>

            <View style={styles.voiceRow}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={styles.voiceLabel}>Voice guidance</Text>
                <Text style={styles.voiceSubtext}>Spoken step-by-step prompts during the scan</Text>
              </View>
              <Switch
                value={voiceEnabled}
                onValueChange={handleToggleVoice}
                trackColor={{ false: colors.border, true: colors.green }}
                thumbColor={colors.text}
              />
            </View>

            <PrimaryButton
              title="Continue to Camera" onPress={() => setShowProfileForm(false)}
              disabled={!heightIsValid} style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (isScanning) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Body Scan" showBack />
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.centerMessageText}>Estimating your body composition…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <ScreenHeader title="Body Scan" showBack transparent />
        <Pressable onPress={() => handleToggleVoice(!voiceEnabled)} style={styles.voiceToggleBtn}>
          <Ionicons name={voiceEnabled ? 'volume-high' : 'volume-mute'} size={18} color={colors.text} />
          <Switch
            value={voiceEnabled} onValueChange={handleToggleVoice}
            trackColor={{ false: colors.border, true: colors.green }} thumbColor={colors.text}
            style={{ marginLeft: spacing.xs }}
          />
        </Pressable>
      </View>

      <View style={styles.cameraWrap} onLayout={cameraViewLayoutChangeHandler}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={cameraDevice ?? device}
          isActive={true}
          frameProcessor={frameProcessor}
          frameProcessorFps={fpsMode}
          pixelFormat="rgb"
        />

        <View pointerEvents="none" style={styles.guideOverlay}>
          <View style={[styles.guideSilhouette, tracking && styles.guideSilhouetteDetected]} />
        </View>

        {/* Temporary diagnostics - remove once tracking is confirmed working */}
        <View pointerEvents="none" style={styles.debugOverlay}>
          <Text style={styles.debugText}>frames: {framesSeen}  results: {resultsReceived}  poses: {posesFound}</Text>
          <Text style={styles.debugText}>pixelFormat: {actualPixelFormat ?? '...'}</Text>
          <Text style={styles.debugText}>
            step: {step}  ratio: {trackerDebug.ratio != null ? trackerDebug.ratio.toFixed(2) : '...'}  noseVis: {trackerDebug.noseVisibility != null ? trackerDebug.noseVisibility.toFixed(2) : '...'}
          </Text>
          {lastError && <Text style={styles.debugTextError}>error: {lastError}</Text>}
        </View>

        {/* Segmented circular progress ring — one arc per step */}
        <View style={styles.ringWrap} pointerEvents="none">
          <RotationRing overallProgress={overallProgress} currentStepProgress={ringProgress} step={step} />
        </View>

        <View style={[styles.captionBox, captionOverride && styles.captionBoxAlert]}>
          <Text style={[styles.captionText, captionOverride && styles.captionTextAlert]}>{captionOverride ?? STEP_CAPTIONS[step]}</Text>
          {!captionOverride && !tracking && step !== 'done' && (
            <Text style={styles.captionSubtext}>Step back until your full body is visible</Text>
          )}
        </View>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={handleRetry}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// Four 90° arc segments (front / right / back / left) around the frame,
// filling in as each step completes, with the active segment shown
// mid-fill via currentStepProgress — a visual echo of the spoken/captioned
// prompt, per the "visual aid" requirement, not just decoration.
function RotationRing({ overallProgress, currentStepProgress, step }) {
  const steps = ['front', 'right', 'back', 'left'];
  const activeIndex = steps.indexOf(step);
  const segmentLength = RING_CIRCUMFERENCE / 4;
  const gap = 6;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      {steps.map((s, i) => {
        const isComplete = activeIndex > i || step === 'done';
        const isActive = i === activeIndex;
        const fillFraction = isComplete ? 1 : isActive ? currentStepProgress : 0;
        const dashLength = Math.max(0, segmentLength - gap) * fillFraction;
        const rotation = -90 + i * 90;
        return (
          <React.Fragment key={s}>
            {/* track (dim background arc) */}
            <Circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
              stroke={colors.border} strokeWidth={RING_STROKE} fill="none"
              strokeDasharray={`${segmentLength - gap} ${RING_CIRCUMFERENCE - (segmentLength - gap)}`}
              strokeDashoffset={-(i * segmentLength)}
              rotation={rotation} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              strokeLinecap="round"
            />
            {/* fill (progress) */}
            <Circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
              stroke={colors.green} strokeWidth={RING_STROKE} fill="none"
              strokeDasharray={`${dashLength} ${RING_CIRCUMFERENCE - dashLength}`}
              strokeDashoffset={-(i * segmentLength)}
              rotation={rotation} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              strokeLinecap="round"
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  centerMessageText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  formScroll: { flex: 1 },
  formWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xl },
  formTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  formSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  unitToggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  unitChip: {
    flex: 1, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  unitChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  unitChipText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  unitChipTextActive: { color: colors.bg, fontWeight: '700' },
  fieldGroup: { marginBottom: spacing.lg },
  inputLabel: { ...typography.bodySmall, color: colors.text, marginBottom: spacing.xs },
  input: {
    minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, ...typography.body,
  },
  rowInputs: { flexDirection: 'row', gap: spacing.sm },
  rowInputHalf: { flex: 1 },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderChip: { flex: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  genderChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  genderChipText: { ...typography.bodySmall, color: colors.textSecondary },
  genderChipTextActive: { color: colors.bg, fontWeight: '700' },
  neckToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  neckToggleText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: 44,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  voiceLabel: { ...typography.body, color: colors.text },
  voiceSubtext: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base },
  cameraWrap: { flex: 1, marginHorizontal: spacing.base, marginTop: spacing.xs, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
  guideOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  debugOverlay: {
    position: 'absolute', top: spacing.base, left: spacing.base, right: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.sm, padding: spacing.xs,
  },
  debugText: { color: '#FFFFFF', fontSize: 12 },
  debugTextError: { color: '#FF6B6B', fontSize: 11, marginTop: 2 },
  guideSilhouette: {
    width: '55%', height: '80%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 200, borderStyle: 'dashed',
  },
  guideSilhouetteDetected: { borderColor: colors.green, borderStyle: 'solid' },
  ringWrap: { position: 'absolute', top: spacing.base, right: spacing.base },
  captionBox: {
    position: 'absolute', bottom: spacing.base, left: spacing.base, right: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center',
  },
  captionBoxAlert: { backgroundColor: colors.orange },
  captionText: { ...typography.h4, color: colors.text, textAlign: 'center' },
  captionTextAlert: { color: colors.bg },
  captionSubtext: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  errorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
  },
  errorText: { ...typography.bodySmall, color: colors.red ?? '#E5484D', flex: 1 },
  retryText: { ...typography.bodySmall, color: colors.green, fontWeight: '700' },
});


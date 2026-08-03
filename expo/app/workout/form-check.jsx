// app/workout/form-check.jsx
//
// Live, on-device AI form check. Real camera + real pose detection + real
// rep counting, replacing the old Math.random() mock entirely.
//
// Stack (committed):
//   react-native-vision-camera  -> camera capture + frame processor host
//   react-native-mediapipe      -> MediaPipe Pose Landmarker frame-processor
//                                   plugin (runs fully on-device, BlazePose
//                                   33-point topology, no network call)
//   services/formAnalysisService -> pure angle-math analysis + Firestore save
//
// SETUP THIS SCREEN NEEDS BEFORE IT WILL RUN (one-time, not code):
//   1. npm install react-native-vision-camera react-native-mediapipe
//   2. A custom dev client build (EAS Build) — this will NOT run in Expo Go.
//      The app already builds a custom dev client elsewhere (see IS_EXPO_GO
//      checks in app/health.jsx / services/authService.js), so this is
//      consistent with how the app already handles native-module screens.
//   3. Bundle a MediaPipe Pose Landmarker .task model file as a native asset
//      and reference its path below (POSE_MODEL) — see react-native-mediapipe's
//      current README for the exact asset-linking step, since that's the one
//      piece of this integration most likely to have shifted since this was
//      written. Everything else in this file is stable regardless.
//   4. Add NSCameraUsageDescription (iOS) / CAMERA permission (Android) to
//      app.json if not already present from expo-camera.

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Line, Circle } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { usePoseDetection } from 'react-native-mediapipe';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius, shadows } from '@/constants/theme';
import { useExpStore } from '@/store/expStore';
import formAnalysisService, { SKELETON_CONNECTIONS } from '@/services/formAnalysisService';

const POSE_MODEL = 'pose_landmarker_lite.task'; // bundled asset — see setup note above

const EXERCISES = [
  { id: 'squat', label: 'Squat' },
  { id: 'pushup', label: 'Push-up' },
  { id: 'bicepCurl', label: 'Bicep Curl' },
];

const FEEDBACK_COLOR = {
  good: colors.green,
  warning: colors.orange,
  info: colors.textSecondary,
};

export default function FormCheckScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const { addExpActivity } = useExpStore();

  const params = useLocalSearchParams();
  const validExerciseIds = EXERCISES.map((e) => e.id);
  const requestedExercise = typeof params.exercise === 'string' && validExerciseIds.includes(params.exercise)
    ? params.exercise
    : 'squat';
  const [selectedExercise, setSelectedExercise] = useState(requestedExercise);
  const [isActive, setIsActive] = useState(false);
  const [live, setLive] = useState({ score: null, feedback: [], repCount: 0, inPosition: false });
  const [landmarks, setLandmarks] = useState(null);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [summary, setSummary] = useState(null); // set after stopping, shown as a results card
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handlePoseResults = useCallback((results) => {
    const pose = results?.results?.[0]?.landmarks?.[0];
    if (!pose) return;
    setLandmarks(pose);
    const payload = formAnalysisService.processPoseFrame(pose);
    if (payload) setLive(payload);
  }, []);

  const { cameraDevice, cameraViewLayoutChangeHandler, frameProcessor, fpsMode } = usePoseDetection(
    {
      onResults: handlePoseResults,
      onError: (e) => console.error('[FormCheck] pose detection error', e),
    },
    'LIVE_STREAM',
    POSE_MODEL,
    { delegate: 'GPU', numPoses: 1, minPoseDetectionConfidence: 0.5 }
  );

  const handleStart = () => {
    formAnalysisService.startAnalysis(selectedExercise, () => {}); // state read via live poll below instead of a second callback
    setSummary(null);
    setLive({ score: null, feedback: [], repCount: 0, inPosition: false });
    setIsActive(true);
  };

  const handleStop = async () => {
    setIsActive(false);
    setSaving(true);
    const session = await formAnalysisService.stopAnalysis();
    setSaving(false);
    if (session && session.reps > 0) {
      setSummary(session);
      // Consistent with how the rest of the app awards XP for completed
      // activity (see services/aiService.js's addExpActivity usage).
      try {
        addExpActivity({
          id: Date.now().toString(),
          type: 'sideMission',
          baseExp: 40 * session.reps,
          multiplier: 1.0,
          date: new Date().toISOString().split('T')[0],
          description: `Form check: ${session.reps} ${EXERCISES.find(e => e.id === session.exercise)?.label ?? session.exercise} reps`,
          completed: true,
        });
      } catch (e) {
        console.error('[FormCheck] EXP add error', e);
      }
    }
  };

  if (!device) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Form Check" showBack />
        <View style={styles.centerMessage}>
          <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerMessageText}>No camera available on this device.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Form Check" showBack />
        <View style={styles.centerMessage}>
          <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerMessageText}>Camera access is needed to check your form.</Text>
          <PrimaryButton title="Grant Camera Access" onPress={requestPermission} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Form Check" showBack />

      <View
        style={styles.cameraWrap}
        onLayout={(e) => {
          setFrameSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
          cameraViewLayoutChangeHandler(e);
        }}
      >
        <Camera
          style={StyleSheet.absoluteFill}
          device={cameraDevice ?? device}
          isActive={isActive}
          frameProcessor={frameProcessor}
          frameProcessorFps={fpsMode}
          pixelFormat="rgb"
        />

        {/* Skeleton overlay */}
        {isActive && landmarks && (
          <Svg style={StyleSheet.absoluteFill}>
            {SKELETON_CONNECTIONS.map(([a, b], i) => {
              const pa = landmarks[a], pb = landmarks[b];
              if (!pa || !pb) return null;
              return (
                <Line
                  key={i}
                  x1={pa.x * frameSize.width} y1={pa.y * frameSize.height}
                  x2={pb.x * frameSize.width} y2={pb.y * frameSize.height}
                  stroke={colors.green} strokeWidth={3} opacity={0.9}
                />
              );
            })}
            {landmarks.map((p, i) => (
              p.visibility > 0.5 ? (
                <Circle key={i} cx={p.x * frameSize.width} cy={p.y * frameSize.height} r={4} fill={colors.text} />
              ) : null
            ))}
          </Svg>
        )}

        {/* Live HUD */}
        {isActive && (
          <View style={styles.hud}>
            <View style={styles.hudBadge}>
              <Text style={styles.hudRepNumber}>{live.repCount}</Text>
              <Text style={styles.hudRepLabel}>REPS</Text>
            </View>
            {typeof live.score === 'number' && (
              <View style={styles.hudBadge}>
                <Text style={styles.hudRepNumber}>{live.score}</Text>
                <Text style={styles.hudRepLabel}>FORM</Text>
              </View>
            )}
          </View>
        )}

        {isActive && live.feedback.length > 0 && (
          <View style={[styles.feedbackBanner, { borderColor: FEEDBACK_COLOR[live.feedback[0]?.type] ?? colors.border }]}>
            <Text style={styles.feedbackText}>{live.feedback[0]}</Text>
          </View>
        )}
      </View>

      {/* Exercise picker — only exercises with real angle-based analysis are listed */}
      {!isActive && (
        <View style={styles.exerciseRow}>
          {EXERCISES.map((ex) => (
            <Pressable
              key={ex.id}
              onPress={() => setSelectedExercise(ex.id)}
              style={[styles.exerciseChip, selectedExercise === ex.id && styles.exerciseChipActive]}
            >
              <Text style={[styles.exerciseChipText, selectedExercise === ex.id && styles.exerciseChipTextActive]}>
                {ex.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {summary && !isActive && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Session complete</Text>
          <View style={styles.summaryRow}>
            <SummaryStat label="Reps" value={summary.reps} />
            <SummaryStat label="Avg Form" value={summary.avgScore != null ? `${summary.avgScore}%` : '—'} />
            <SummaryStat label="Duration" value={`${summary.durationSec}s`} />
          </View>
          {!summary.saved && (
            <Text style={styles.summaryWarning}>Saved locally only — couldn't sync to your account.</Text>
          )}
        </View>
      )}

      <View style={styles.controls}>
        <PrimaryButton
          title={isActive ? 'Stop' : 'Start Form Check'}
          onPress={isActive ? handleStop : handleStart}
          variant={isActive ? 'secondary' : 'primary'}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  cameraWrap: {
    flex: 1,
    margin: spacing.base,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  centerMessageText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hud: {
    position: 'absolute',
    top: spacing.base,
    left: spacing.base,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hudBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minWidth: 64,
  },
  hudRepNumber: { ...typography.numberSmall, color: colors.text },
  hudRepLabel: { ...typography.caption, color: colors.textSecondary },
  feedbackBanner: {
    position: 'absolute',
    bottom: spacing.base,
    left: spacing.base,
    right: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  feedbackText: { ...typography.h4, color: colors.text, textAlign: 'center' },
  exerciseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  exerciseChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  exerciseChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  exerciseChipText: { ...typography.bodySmall, color: colors.textSecondary },
  exerciseChipTextActive: { color: colors.bg, fontWeight: '700' },
  summaryCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  summaryTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryStat: { alignItems: 'center' },
  summaryStatValue: { ...typography.numberSmall, color: colors.text },
  summaryStatLabel: { ...typography.caption, color: colors.textSecondary },
  summaryWarning: { ...typography.bodySmall, color: colors.orange, marginTop: spacing.sm, textAlign: 'center' },
  controls: { paddingHorizontal: spacing.base, paddingBottom: Platform.OS === 'ios' ? spacing.base : spacing.lg },
});

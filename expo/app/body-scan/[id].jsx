// app/body-scan/[id].jsx
//
// Renders a 3D mannequin sized from the scan's real measurements. Uses
// expo-gl + three.js for real native 3D rendering (not a WebView), with a
// simple drag-to-rotate interaction, a comparison view against an earlier
// scan, and the AI-generated commentary on the trend.
//
// Two mesh sources, tried in order:
// 1. High-quality: a remote call to the Anny body-mesh service
//    (anny-service/, Apache 2.0), which returns a detailed mesh (real
//    fingers, toes, facial features) generated from the scan's actual
//    measurements. See anny-service/README.md for how that service works.
// 2. Fallback: the original procedural mannequin (lib/bodyMeshBuilder.js) -
//    always used if the remote call fails for any reason (network, timeout,
//    service error), so this screen never breaks just because an external
//    service is temporarily unavailable.
//
// Why the procedural fallback exists in the first place, and why it avoids
// SMPL specifically: see services/bodyCompositionService.js for the full
// explanation — Meshcapade (the only commercial SMPL API) shut down in
// April 2026, and SMPL itself is patented, with no licensed replacement API
// since. The procedural mannequin sidesteps that entirely: an original
// shape driven by real measurement data, not a derivative of any patented
// statistical body model. Anny (the primary path above) is a different,
// separate situation, not a quiet reversal of that reasoning: it's Apache
// 2.0 licensed and built on MakeHuman's CC0 (public-domain-equivalent)
// assets, not on SMPL's own proprietary training data or topology.

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ScreenHeader from '@/components/ScreenHeader';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { buildBodyMesh } from '@/lib/bodyMeshBuilder';
import { buildSkinnedBodyMesh } from '@/lib/applySkeletonToMesh';

// Real Metro constraint, not just a runtime concern: Metro statically
// analyzes every require() call to build its bundle graph at build time,
// regardless of whether the surrounding code path is ever actually
// executed at runtime. A require() of assets/body-rig/reference-rigged.glb
// here would fail the build the moment this file is touched, even with
// REFERENCE_RIG_BUNDLED left false, because the file doesn't exist yet
// and 'glb' isn't in metro.config.js's resolver.assetExts yet either.
// Once scripts/generateReferenceRig.mjs has been run and that file is
// actually committed, uncomment the require() below (and add 'glb' to
// resolver.assetExts) rather than relying on a boolean flag alone —
// Metro needs the real file to exist at the time this line is bundled,
// not just at the time it's executed.
const REFERENCE_RIG_BUNDLED = false;
const getReferenceRigUri = REFERENCE_RIG_BUNDLED
  ? () => Promise.resolve(null) // ? () => Asset.fromModule(require('../../assets/body-rig/reference-rigged.glb')).downloadAsync().then((a) => a.localUri ?? a.uri)
  : () => Promise.resolve(null);

const MANNEQUIN_GRAY = '#9CA3AF';

// Real, measured latency, not a guess: cold-start requests to this service
// took 80-90+ seconds in direct testing (loading Anny's blend shape data on
// a fresh container instance). 120s gives real margin above that without
// leaving a hung request effectively unbounded if the service is genuinely
// unreachable.
const ANNY_SERVICE_URL = 'https://anny-mesh-service-431690627943.us-central1.run.app/generate-mesh';
const ANNY_REQUEST_TIMEOUT_MS = 120000;

// Loads a real, detailed mesh (individual fingers, toes, facial features -
// see anny-service/README.md) from the Anny body-mesh service, built from
// this scan's actual measurements. Throws on any failure (network, timeout,
// service error, malformed response) rather than returning null, so the
// caller's own try/catch is the single place that decides what happens
// next - this function's only job is "get a real mesh or fail clearly."
async function loadHighQualityMesh(scan) {
  if (!scan.heightCm || !scan.gender) {
    throw new Error('Missing height or gender - required for high-quality mesh generation.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANNY_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(ANNY_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        height_cm: scan.heightCm,
        weight_kg: scan.weightKg ?? undefined,
        gender: scan.gender,
        body_fat_percent: scan.bodyFatPercent ?? undefined,
        waist_cm: scan.measurements?.waistCircumferenceCm ?? undefined,
        hip_cm: scan.measurements?.hipCircumferenceCm ?? undefined,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anny service returned ${response.status}: ${detail.slice(0, 200)}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });

  let mesh = null;
  gltf.scene.traverse((child) => {
    if (child.isMesh && !mesh) mesh = child;
  });
  if (!mesh) {
    throw new Error('Anny service response contained no mesh.');
  }
  return mesh;
}

export default function BodyScanViewerScreen() {
  const params = useLocalSearchParams();
  const scanId = typeof params.id === 'string' ? params.id : '';
  const { user } = useUserStore();
  const { scans, loadScans, latestInsight, getComparisonPair } = useBodyCompositionStore();

  const [loadState, setLoadState] = useState('loading');
  const rotationRef = useRef(0);
  const meshGroupRef = useRef(null);
  const animationFrameRef = useRef(null);
  const disposablesRef = useRef({ geometries: [], materials: [] });

  const scan = scans.find((s) => s.id === scanId) || scans[scans.length - 1] || null;
  const comparison = getComparisonPair(30);

  useEffect(() => {
    if (user?.uid && scans.length === 0) loadScans(user.uid);
  }, [user?.uid]);

  // Three.js geometries/materials/GPU buffers are not garbage-collected by
  // JS's normal memory management — they need an explicit .dispose() call or
  // they leak GPU memory every time this screen mounts with a new scan
  // (e.g. navigating between "New scan" results). Also cancels the render
  // loop so it doesn't keep running against a torn-down GL context.
  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      disposablesRef.current.geometries.forEach((g) => g.dispose());
      disposablesRef.current.materials.forEach((m) => m.dispose());
      disposablesRef.current = { geometries: [], materials: [] };
    };
  }, [scanId]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        rotationRef.current += gesture.dx * 0.005;
        if (meshGroupRef.current) meshGroupRef.current.rotation.y = rotationRef.current;
      },
    })
  ).current;

  const onContextCreate = useCallback(async (gl) => {
    if (!scan) {
      setLoadState('error');
      return;
    }

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    camera.position.set(0, 0.2, 2.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-2, 1, -1);
    scene.add(fill);

    try {
      let geometry;
      let material;
      let displayObject;
      let usedHighQualityMesh = false;

      try {
        setLoadState('loadingHighQuality');
        const loadedMesh = await loadHighQualityMesh(scan);
        material = new THREE.MeshStandardMaterial({
          color: MANNEQUIN_GRAY, roughness: 0.85, metalness: 0.05,
        });
        loadedMesh.material = material;
        geometry = loadedMesh.geometry;
        displayObject = loadedMesh;
        usedHighQualityMesh = true;
        disposablesRef.current.geometries.push(geometry);
        disposablesRef.current.materials.push(material);
      } catch (highQualityError) {
        console.warn('[BodyScanViewer] high-quality mesh unavailable, falling back to local mesh:', highQualityError?.message);
      }

      if (!usedHighQualityMesh) {
        geometry = buildBodyMesh(scan);
        material = new THREE.MeshStandardMaterial({
          color: MANNEQUIN_GRAY, roughness: 0.85, metalness: 0.05,
        });
        disposablesRef.current.geometries.push(geometry);
        disposablesRef.current.materials.push(material);

        // Use the rigged/posable mesh if the one-time reference rig has been
        // generated and bundled (see scripts/generateReferenceRig.mjs) —
        // falls back to the plain static mesh otherwise, so this screen keeps
        // working before that setup step has been done.
        const referenceRigUri = await getReferenceRigUri();
        if (referenceRigUri) {
          try {
            displayObject = await buildSkinnedBodyMesh(geometry, material, referenceRigUri);
          } catch (rigError) {
            console.warn('[BodyScanViewer] skinned mesh unavailable, falling back to static mesh:', rigError.message);
          }
        }
        if (!displayObject) {
          displayObject = new THREE.Mesh(geometry, material);
        }
      }

      // Center vertically so drag-to-rotate pivots around the figure's
      // middle rather than its feet.
      geometry.computeBoundingBox();
      const midY = (geometry.boundingBox.min.y + geometry.boundingBox.max.y) / 2;
      displayObject.position.y = -midY;

      const group = new THREE.Group();
      group.add(displayObject);
      scene.add(group);
      meshGroupRef.current = group;
      setLoadState('ready');
    } catch (e) {
      console.error('[BodyScanViewer] mannequin build failed:', e?.message);
      setLoadState('error');
      return;
    }

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  }, [scan]);

  if (!scan) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Body Scan" showBack />
        <View style={styles.centerMessage}>
          <Text style={styles.centerMessageText}>No scan found. Take your first body scan to get started.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Body Composition" showBack />

      <View style={styles.viewerWrap} {...panResponder.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        {loadState === 'loading' && (
          <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={colors.text} /></View>
        )}
        {loadState === 'loadingHighQuality' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.centerMessageText}>Building your detailed 3D model — this can take a minute the first time</Text>
          </View>
        )}
        {loadState === 'error' && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.centerMessageText}>Couldn't render this scan.</Text>
          </View>
        )}
        <Text style={styles.dragHint}>Drag to rotate</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Est. body fat" value={scan.bodyFatPercent != null ? `${scan.bodyFatPercent}%` : '—'} />
        <Stat label="BMI" value={scan.bmi != null ? `${scan.bmi}` : '—'} />
        <Stat label="Waist" value={scan.measurements?.waistCircumferenceCm ? `${scan.measurements.waistCircumferenceCm} cm` : '—'} />
        <Stat label="Hip" value={scan.measurements?.hipCircumferenceCm ? `${scan.measurements.hipCircumferenceCm} cm` : '—'} />
      </View>
      <Text style={styles.methodNote}>
        Estimated from your photos using the Navy circumference method — a trend indicator, not a clinical measurement.
      </Text>

      {!!scan.measurements?._debug && (
        <View style={styles.debugCard}>
          <Text style={styles.debugTitle}>Debug (temporary)</Text>
          <Text style={styles.debugText}>front raw pixelSpan: {scan.measurements._debug.frontRawPixelSpan}</Text>
          <Text style={styles.debugText}>front nose Y: {scan.measurements._debug.frontNoseY} (expect ~0.1-0.2 for a well-framed shot)</Text>
          <Text style={styles.debugText}>front ankle Y: {scan.measurements._debug.frontAnkleY} (expect ~0.85-0.95)</Text>
          <Text style={styles.debugText}>scale clamped: {scan.measurements._debug.frontScaleClamped ? 'YES' : 'no'}</Text>
          <Text style={styles.debugText}>shoulder-based scale (used): {scan.measurements._debug.shoulderBasedScale} cm/unit</Text>
          <Text style={styles.debugText}>vertical-span scale (diagnostic only): {scan.measurements._debug.verticalSpanBasedScale} cm/unit</Text>
          <Text style={styles.debugText}>hip width: {scan.measurements._debug.hipWidthCm} cm</Text>
          <Text style={styles.debugText}>waist width: {scan.measurements._debug.waistWidthCm} cm</Text>
          <Text style={styles.debugText}>final clamp applied: {scan.measurements._debug.finalClampApplied ? 'YES' : 'no'}</Text>
          <Text style={styles.debugText}>raw (pre-clamp) waist: {scan.measurements._debug.rawWaistCircumferenceCm} cm</Text>
          <Text style={styles.debugText}>raw (pre-clamp) hip: {scan.measurements._debug.rawHipCircumferenceCm} cm</Text>
        </View>
      )}

      {latestInsight && (
        <View style={styles.insightCard}>
          <Text style={styles.insightTrend}>{trendLabel(latestInsight.trend)}</Text>
          <Text style={styles.insightSummary}>{latestInsight.summary}</Text>
          {!!latestInsight.suggestion && (
            <Text style={styles.insightSuggestion}>{latestInsight.suggestion}</Text>
          )}
        </View>
      )}

      {comparison && (
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>
            vs. {daysBetween(comparison.previous.createdAtLocal, comparison.latest.createdAtLocal)} days ago
          </Text>
          {renderDeltas(comparison.previous, comparison.latest)}
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function trendLabel(trend) {
  switch (trend) {
    case 'improving': return '📈 Trending toward your goal';
    case 'declining': return '📉 Moving away from your goal';
    case 'mixed': return '↔️ Mixed signals';
    case 'none': return '👋 First scan';
    default: return '➡️ Holding steady';
  }
}

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function renderDeltas(previous, latest) {
  const fields = [
    ['waistCircumferenceCm', 'Waist'],
    ['hipCircumferenceCm', 'Hip'],
    ['shoulderWidthCm', 'Shoulder width'],
  ];
  return fields.map(([key, label]) => {
    const before = previous.measurements?.[key];
    const after = latest.measurements?.[key];
    if (typeof before !== 'number' || typeof after !== 'number') return null;
    const delta = after - before;
    return (
      <View key={key} style={styles.deltaRow}>
        <Text style={styles.deltaLabel}>{label}</Text>
        <Text style={[styles.deltaValue, delta !== 0 && { color: delta > 0 ? colors.orange : colors.green }]}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} cm
        </Text>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  centerMessageText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  viewerWrap: {
    height: 340, marginHorizontal: spacing.base, marginBottom: spacing.sm,
    borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card,
  },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dragHint: { position: 'absolute', bottom: spacing.sm, alignSelf: 'center', ...typography.caption, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.xs },
  statBox: { alignItems: 'center' },
  statValue: { ...typography.h4, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  methodNote: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  debugCard: { backgroundColor: '#3a1a1a', borderRadius: radius.md, padding: spacing.base, marginHorizontal: spacing.xl, marginBottom: spacing.base },
  debugTitle: { ...typography.bodySmall, color: '#ff8a8a', marginBottom: spacing.xs, fontWeight: '700' },
  debugText: { ...typography.caption, color: '#ffcccc' },
  insightCard: {
    marginHorizontal: spacing.base, marginBottom: spacing.sm,
    padding: spacing.base, borderRadius: radius.lg, backgroundColor: colors.card,
  },
  insightTrend: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
  insightSummary: { ...typography.bodySmall, color: colors.text },
  insightSuggestion: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  comparisonSection: { marginHorizontal: spacing.base, paddingBottom: spacing.lg },
  comparisonTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  deltaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  deltaLabel: { ...typography.bodySmall, color: colors.textSecondary },
  deltaValue: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
});

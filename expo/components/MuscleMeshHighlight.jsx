import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { loadScanMesh } from '@/lib/loadScanMesh';
import { computeVertexColors } from '@/lib/muscleAnchors';
import { colors, typography } from '@/constants/theme';

const MANNEQUIN_GRAY = '#9CA3AF';

export default function MuscleMeshHighlight({ scan, muscleNames, muscleIntensities, height = 220, onRetry }) {
  const [loadState, setLoadState] = useState(scan ? 'loading' : 'no-scan');
  const animationFrameRef = useRef(null);
  const disposablesRef = useRef({ geometries: [], materials: [] });
  const meshGroupRef = useRef(null);

  useEffect(() => {
    setLoadState(scan ? 'loading' : 'no-scan');
  }, [scan?.id]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      disposablesRef.current.geometries.forEach((g) => g.dispose());
      disposablesRef.current.materials.forEach((m) => m.dispose());
      disposablesRef.current = { geometries: [], materials: [] };
    };
  }, [scan?.id]);

  const onContextCreate = useCallback(async (gl) => {
    if (!scan) return;
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    camera.position.set(0.9, 0.15, 2.3);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 2);
    scene.add(key);

    try {
      const { displayObject, geometry, material } = await loadScanMesh(scan);
      disposablesRef.current.geometries.push(geometry);
      disposablesRef.current.materials.push(material);

      const colorAttr = computeVertexColors(geometry, muscleNames || [], muscleIntensities || {}, MANNEQUIN_GRAY, THREE);
      geometry.setAttribute('color', colorAttr);

      const paintedMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.05,
      });
      disposablesRef.current.materials.push(paintedMaterial);
      displayObject.material = paintedMaterial;

      const rotatingGroup = new THREE.Group();
      rotatingGroup.add(displayObject);
      scene.add(rotatingGroup);
      meshGroupRef.current = rotatingGroup;
      setLoadState('ready');
    } catch (e) {
      console.error('[MuscleMeshHighlight] mesh build failed:', e?.message);
      setLoadState('error');
      return;
    }

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      if (meshGroupRef.current) {
        meshGroupRef.current.rotation.y += 0.008;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  }, [scan, muscleNames, muscleIntensities]);

  const hasIntensityData = muscleIntensities && Object.keys(muscleIntensities).length > 0;

  return (
    <View>
      <View style={[styles.wrap, { height }]}>
        {scan && (
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        )}
        {loadState === 'loading' && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        )}
        {(loadState === 'no-scan' || loadState === 'error') && (
          <View style={styles.overlay}>
            <Text style={styles.errorText}>
              {loadState === 'error' ? "Couldn't render your scan." : 'Scan your body to see this in 3D.'}
            </Text>
            {onRetry && (
              <Pressable onPress={onRetry} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Refresh</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {loadState === 'ready' && hasIntensityData && (
        <View style={styles.legendRow}>
          <LegendDot color="#22C55E" label="Low" />
          <LegendDot color="#F59E0B" label="Moderate" />
          <LegendDot color="#DC2626" label="High" />
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  errorText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.text, borderRadius: 20 },
  retryBtnText: { ...typography.caption, color: '#FFF', fontWeight: '700' },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...typography.caption, color: colors.textSecondary },
});

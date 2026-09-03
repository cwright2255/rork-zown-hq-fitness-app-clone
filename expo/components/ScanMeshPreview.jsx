// components/ScanMeshPreview.jsx
//
// Small, static (non-interactive) 3D mesh preview for a single scan -
// built for side-by-side comparison cards where two of these render at
// once. Deliberately no drag-to-rotate: two independent PanResponders
// inside a ScrollView would fight the page's own scroll gesture with no
// clean way to disambiguate "trying to scroll" from "trying to rotate
// this specific mesh." Full interactive rotation still exists on the
// per-scan detail screen (app/body-scan/[id].jsx) and on the dedicated
// compare screen (app/body-scan/compare.jsx, not inside a ScrollView).
import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { loadScanMesh } from '@/lib/loadScanMesh';
import { colors, typography } from '@/constants/theme';

const MANNEQUIN_GRAY = '#9CA3AF';

export default function ScanMeshPreview({ scan, height = 180 }) {
  const [loadState, setLoadState] = useState('loading');
  const animationFrameRef = useRef(null);
  const disposablesRef = useRef({ geometries: [], materials: [] });

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
    if (!scan) {
      setLoadState('error');
      return;
    }
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
      scene.add(displayObject);
      setLoadState('ready');
    } catch (e) {
      console.error('[ScanMeshPreview] mesh build failed:', e?.message);
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

  return (
    <View style={[styles.wrap, { height }]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {loadState === 'loading' && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      )}
      {loadState === 'error' && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>Couldn't render</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.caption, color: colors.textSecondary },
});

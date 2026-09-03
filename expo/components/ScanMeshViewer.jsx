// components/ScanMeshViewer.jsx
//
// Full interactive mesh viewer (drag-to-rotate) for a single scan - the
// rotating sibling to ScanMeshPreview.jsx (which is deliberately static,
// for embedding inline alongside a page's own scroll gesture). This one
// is meant for a dedicated viewing area (its own screen, or a fixed
// section that isn't fighting a shared ScrollView drag), matching the
// same viewer pattern already used in app/body-scan/[id].jsx.
import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, PanResponder } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { loadScanMesh } from '@/lib/loadScanMesh';
import { colors, typography, radius } from '@/constants/theme';

export default function ScanMeshViewer({ scan, height = 320, label }) {
  const [loadState, setLoadState] = useState('loading');
  const rotationRef = useRef(0);
  const meshGroupRef = useRef(null);
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
      const { displayObject, geometry, material } = await loadScanMesh(scan);
      disposablesRef.current.geometries.push(geometry);
      disposablesRef.current.materials.push(material);

      const group = new THREE.Group();
      group.add(displayObject);
      scene.add(group);
      meshGroupRef.current = group;
      setLoadState('ready');
    } catch (e) {
      console.error('[ScanMeshViewer] mesh build failed:', e?.message);
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
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.wrap, { height }]} {...panResponder.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        {loadState === 'loading' && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        )}
        {loadState === 'error' && (
          <View style={styles.overlay}>
            <Text style={styles.errorText}>Couldn't render this scan.</Text>
          </View>
        )}
        {loadState === 'ready' && (
          <Text style={styles.dragHint}>Drag to rotate</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  dragHint: { position: 'absolute', bottom: 8, alignSelf: 'center', ...typography.caption, color: colors.textSecondary },
});

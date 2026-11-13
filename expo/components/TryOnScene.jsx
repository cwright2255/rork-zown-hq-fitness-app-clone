// components/TryOnScene.jsx
//
// The 3D view of the Try-On screen: the person's own body (already built by lib/loadScanMesh.js) with the fitted garment on it, drag to turn. The
// garment is drawn in the same place and turned the same way as the body (it was blended in the body model's own axes), in one colour: the packs hold
// the garment's shape, not its fabric picture. Same renderer and lights as the body scan viewer (components/ScanMeshViewer.jsx).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { buildGarmentGeometry } from '@/lib/tryOn/garmentGeometry';

export const GARMENT_COLOR = '#2F3640';

/** body: { displayObject } from loadScanMesh, or null. garment: { positions, faces } or null. */
export default function TryOnScene({ body, garment, height = 340 }) {
  const parts = useRef({ group: null, bodyObject: null, garmentMesh: null, frame: null });
  const rotation = useRef(0);
  const [ready, setReady] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        rotation.current += gesture.dx * 0.005;
        if (parts.current.group) parts.current.group.rotation.y = rotation.current;
      },
    })
  ).current;

  const onContextCreate = useCallback((gl) => {
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
    const group = new THREE.Group();
    group.rotation.y = rotation.current;
    scene.add(group);
    parts.current.group = group;
    const render = () => {
      parts.current.frame = requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
    setReady(true);
  }, []);

  // The body: put it in the scene when both are there, take it out when it changes. Its owner (the screen) disposes it.
  useEffect(() => {
    const p = parts.current;
    if (!ready || !p.group) return undefined;
    if (p.bodyObject) { p.group.remove(p.bodyObject); p.bodyObject = null; }
    if (body && body.displayObject) { p.group.add(body.displayObject); p.bodyObject = body.displayObject; }
    return undefined;
  }, [ready, body]);

  // The garment: made new for each fit, so the one it replaces is released.
  useEffect(() => {
    const p = parts.current;
    if (!ready || !p.group) return undefined;
    const release = () => {
      if (p.garmentMesh) {
        p.group.remove(p.garmentMesh);
        p.garmentMesh.geometry.dispose();
        p.garmentMesh.material.dispose();
        p.garmentMesh = null;
      }
    };
    release();
    if (garment && body && body.displayObject) {
      const material = new THREE.MeshStandardMaterial({ color: GARMENT_COLOR, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(buildGarmentGeometry(THREE, garment.positions, garment.faces), material);
      const b = body.displayObject; // the same turn and place as the body, because the garment is in the body's own axes
      mesh.position.copy(b.position);
      mesh.rotation.copy(b.rotation);
      mesh.scale.copy(b.scale);
      p.group.add(mesh);
      p.garmentMesh = mesh;
    }
    return release;
  }, [ready, garment, body]);

  useEffect(() => () => {
    const p = parts.current;
    if (p.frame != null) cancelAnimationFrame(p.frame);
    p.frame = null;
    if (p.group && p.bodyObject) p.group.remove(p.bodyObject);
  }, []);

  return (
    <View style={[styles.wrap, { height }]} {...panResponder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  // width: '100%' matters: the Try-On screen centres what is in its stage (alignItems: 'center'), and a view with a height but no width is then as wide as its
  // contents, which are only the absolutely placed GLView, so it was 0 wide and nothing was drawn.
  wrap: { width: '100%', backgroundColor: '#1A1A1A', overflow: 'hidden' },
});

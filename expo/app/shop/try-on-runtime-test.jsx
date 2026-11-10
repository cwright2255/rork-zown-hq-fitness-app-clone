// app/shop/try-on-runtime-test.jsx
//
// Alpha-only diagnostic (opened from Settings -> About). It times, on this phone, the pieces the real try-on will need: blending a garment to a
// new body, saving and reading back a pack, opening two 2048 x 2048 pictures, and drawing and turning the garment next to the body scan. The garment
// is a stand-in made in code with the same sizes as the real shorts (lib/tryOnSpike/standInGarment.js): no product data is in the app for this test,
// and nothing leaves the phone. The only network call is the body scan's own (see runWithBody): the same mesh request the Body Scan screen makes.
//
// Nothing here changes what the app does for anyone who does not open it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GLView } from 'expo-gl';
import { Renderer, loadTextureAsync } from 'expo-three';
import * as THREE from 'three';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import ScreenHeader from '@/components/ScreenHeader';
import { colors } from '@/constants/theme';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { useUserStore } from '@/store/userStore';
import { loadScanMesh } from '@/lib/loadScanMesh';
import { makeStandInGarment, withComponents, STAND_IN_DEFAULTS } from '@/lib/tryOnSpike/standInGarment';
import { COMPONENT_COUNTS, PACK_COMPONENTS, runJsBenchmarks } from '@/lib/tryOnSpike/runJsBenchmarks';
import { runGlTest } from '@/lib/tryOnSpike/runGlTest';
import { formatReport } from '@/lib/tryOnSpike/formatReport';

// Metro picks this up at build time: a plain 2048 x 2048 picture with a made-up weave (no product artwork), used for both pictures the test opens.
const STAND_IN_TEXTURE = require('../../assets/tryon-runtime-test/stand-in-2048.jpg');

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
const getFs = async () => {
  try { return await import('expo-file-system/legacy'); } catch (e) { return null; }
};
const digest = (bytes) => Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);

// The latest body scan the phone knows about (loads the person's scans first if none are in memory yet).
async function latestScan() {
  try {
    let state = useBodyCompositionStore.getState();
    if (state.scans.length === 0) {
      const uid = useUserStore.getState().user?.uid;
      if (uid) {
        await state.loadScans(uid);
        state = useBodyCompositionStore.getState();
      }
    }
    return state.scans[state.scans.length - 1] || null;
  } catch (e) {
    return null;
  }
}

// The body for the "with my body scan" run: the same mesh loader the Body Scan screen uses, so a body already on the phone loads with no network at all
// and otherwise it is requested from the same mesh service, signed in, as that screen does. If anything goes wrong the test just runs without a body.
async function loadBody() {
  const scan = await latestScan();
  if (!scan) return { body: null, state: 'no body scan on this account yet, so none was added' };
  const t0 = now();
  try {
    const { displayObject, geometry, material } = await loadScanMesh(scan);
    const ms = Math.round((now() - t0) * 10) / 10;
    return {
      body: { object: displayObject, dispose: () => { geometry.dispose(); material.dispose(); } },
      state: 'added (the garment is beside it, not fitted)',
      ms,
    };
  } catch (e) {
    return { body: null, state: 'could not be loaded (' + (e && e.message ? e.message : 'unknown') + '), so none was added' };
  }
}

export default function TryOnRuntimeTestScreen() {
  const [phase, setPhase] = useState('idle'); // idle | working | graphics | done
  const [step, setStep] = useState('');
  const [lines, setLines] = useState([]);
  const [glKey, setGlKey] = useState(0);
  const cancelled = useRef(false);
  const pendingRef = useRef(null); // { js, bodyInfo, body } between the no-graphics part and the graphics part
  const garmentRef = useRef(null);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      const pending = pendingRef.current;
      if (pending && pending.body && pending.body.dispose) {
        try { pending.body.dispose(); } catch (e) { /* already released */ }
      }
      pendingRef.current = null;
    };
  }, []);

  const device = { os: Platform.OS, version: String(Platform.Version), app: Constants?.expoConfig?.version };

  const start = useCallback(async (withBody) => {
    if (phase === 'working' || phase === 'graphics') return;
    setPhase('working');
    setLines([]);
    try {
      garmentRef.current = makeStandInGarment({ ...STAND_IN_DEFAULTS, components: Math.max(...COMPONENT_COUNTS) });
      const js = await runJsBenchmarks({ now, getFs, digest, pause, onStep: setStep }, { garment: garmentRef.current });
      if (cancelled.current) return;
      let loaded = { body: null, state: 'not included (garment only)' };
      if (withBody) {
        setStep('Loading your latest body scan...');
        loaded = await loadBody();
        if (cancelled.current) { if (loaded.body) loaded.body.dispose(); return; }
      }
      pendingRef.current = { js, bodyInfo: { state: loaded.state, ms: loaded.ms }, body: loaded.body };
      setGlKey((k) => k + 1);
      setPhase('graphics');
    } catch (e) {
      setLines(['The test stopped: ' + (e && e.message ? e.message : String(e))]);
      setPhase('done');
    }
  }, [phase]);

  const onContextCreate = useCallback(async (gl) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    let glResult;
    try {
      glResult = await runGlTest({
        THREE,
        gl,
        createRenderer: (context) => {
          const renderer = new Renderer({ gl: context });
          renderer.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
          renderer.setClearColor(0xf2f2f2, 1);
          return renderer;
        },
        loadTexture: (asset) => loadTextureAsync({ asset }),
        textureAsset: STAND_IN_TEXTURE,
        now,
        frame: (cb) => requestAnimationFrame(cb),
        isCancelled: () => cancelled.current,
        onStep: setStep,
      }, withComponents(garmentRef.current, PACK_COMPONENTS), pending.body);
    } catch (e) {
      glResult = { error: e && e.message ? e.message : String(e) };
    }
    if (cancelled.current) return;
    setLines(formatReport({ device, js: pending.js, gl: glResult, body: pending.bodyInfo }));
    setPhase('done');
  }, []);

  const share = useCallback(() => {
    Share.share({ message: lines.join('\n') }).catch(() => {});
  }, [lines]);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <ScreenHeader title="Try-On Runtime Test" showBack />
        <Text style={styles.body}>This test needs the phone's graphics chip, so it runs only in the app on a phone.</Text>
      </SafeAreaView>
    );
  }

  const busy = phase === 'working' || phase === 'graphics';
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScreenHeader title="Try-On Runtime Test" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          Alpha test. It times, on this phone, what the try-on will need: blending a garment to a new body, reading a saved pack, opening two 2048 x 2048
          pictures, and drawing and turning the garment. The garment is a stand-in made in code with the same sizes as the real shorts; nothing about you
          leaves the phone.
        </Text>
        <Text style={styles.body}>
          "With my body scan" also puts your latest 3D body in the scene. If it is already on the phone it loads with no network; otherwise it is requested from
          the same mesh service the Body Scan screen uses.
        </Text>

        <Pressable style={[styles.button, busy && styles.buttonOff]} disabled={busy} onPress={() => start(false)} testID="run-garment-only">
          <Text style={styles.buttonText}>Run test</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonAlt, busy && styles.buttonOff]} disabled={busy} onPress={() => start(true)} testID="run-with-body">
          <Text style={[styles.buttonText, styles.buttonAltText]}>Run test with my body scan</Text>
        </Pressable>

        {busy && (
          <View style={styles.status}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.statusText}>{step || 'Starting...'}</Text>
          </View>
        )}

        {phase === 'graphics' && (
          <View style={styles.glWrap}>
            <GLView key={glKey} style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
          </View>
        )}

        {lines.length > 0 && (
          <>
            <Text style={styles.report} selectable testID="report">{lines.join('\n')}</Text>
            {phase === 'done' && (
              <Pressable style={styles.button} onPress={share} testID="share-results">
                <Text style={styles.buttonText}>Share results</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  body: { fontSize: 14, color: colors.textSecondary, marginBottom: 12, lineHeight: 20 },
  button: { backgroundColor: '#000000', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  buttonAlt: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#000000' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  buttonAltText: { color: '#000000' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  statusText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  glWrap: { height: 280, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2F2F2', marginVertical: 12 },
  report: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: colors.text, marginVertical: 12, lineHeight: 16 },
});

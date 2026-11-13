// app/shop/try-on.jsx
//
// Digital Try-On: the person's own 3D body (the same one the Body Scan screen shows) wearing a garment fitted to it. The garment's drape was simulated
// ahead of time on made-up bodies and packed small (lib/tryOn/pack.js); the phone blends it to this body, keeps it off the skin and draws it. The
// fitting happens on the phone and Try-On's own downloads are only the garment files, which are the same for everyone and kept on the phone after the
// first time (lib/tryOn/packStore.js, from private storage that only signed-in people can read). The 3D body itself comes from lib/loadScanMesh.js,
// exactly as on the Body Scan screen: kept on the phone once made, and otherwise requested from the mesh service with the scan's saved numbers. The garment is drawn in one colour, because the packs hold its
// shape, not its fabric picture.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import TryOnScene from '@/components/TryOnScene';
import { colors } from '@/constants/theme';
import { loadScanMesh } from '@/lib/loadScanMesh';
import { latestScan } from '@/lib/tryOn/latestScan';
import { getAppPackStore } from '@/lib/tryOn/appPackStore';
import { garmentsForGroup, groupForGender, sortSizes } from '@/lib/tryOn/garments';
import { fitGarment, loadSizing, readBodyGeometry, recommend } from '@/lib/tryOn/tryOnSession';

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const VERDICT_TEXT = {
  good: 'Expected to fit you well.',
  likely: 'Should fit, though it may feel a little tight or loose in places.',
  tight: 'Likely to feel tight on you. Try the next size up.',
  loose: 'Likely to feel loose on you. Try the next size down.',
  outside: 'Your measurements are outside what this garment was tested on, so treat the fit as a rough guide.',
};

// What to tell the person when the garment files cannot be had (the error's code comes from lib/tryOn/packStore.js).
const unavailableText = (error) => {
  if (error && error.code === 'offline') return 'Try-On downloads its garments the first time you use them. Connect to the internet and try again.';
  if (error && error.code === 'corrupt') return 'A garment file did not download correctly. Try again.';
  return 'Try-On garments are not available yet.';
};

// The reason behind a failure, in small print under the friendly text, so a person (or whoever is helping them) can say what went wrong.
const reasonText = (error) => {
  const message = error && error.message ? String(error.message) : '';
  return message ? 'Details: ' + (message.length > 360 ? message.slice(0, 360) + '...' : message) : null;
};

export default function TryOnScreen() {
  // loading | noScan | unsupported | noDetailedBody | bodyFailed | ready
  const [phase, setPhase] = useState('loading');
  const [message, setMessage] = useState('Finding your latest body scan...');
  const [body, setBody] = useState(null); // { displayObject, positions, faces, group }
  const [sizing, setSizing] = useState(null);
  const [sizingError, setSizingError] = useState(null);
  const [garmentKey, setGarmentKey] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [size, setSize] = useState(null);
  const [fit, setFit] = useState({ status: 'idle', step: '', result: null, error: null });
  const alive = useRef(true);
  const bodyRef = useRef(null);
  const runId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      runId.current += 1;
      const owned = bodyRef.current;
      if (owned) {
        try { owned.geometry.dispose(); } catch (e) { /* already released */ }
        try { owned.material.dispose(); } catch (e) { /* already released */ }
        bodyRef.current = null;
      }
    };
  }, []);

  // 1. The body: the latest scan, built the way the Body Scan screen builds it.
  const loadBody = useCallback(async () => {
    setPhase('loading');
    setMessage('Finding your latest body scan...');
    const scan = await latestScan();
    if (!alive.current) return;
    if (!scan) { setPhase('noScan'); return; }
    const group = groupForGender(scan.gender);
    if (!group) { setPhase('unsupported'); return; }
    setMessage('Loading your 3D body. The first time can take up to a minute.');
    try {
      const loaded = await loadScanMesh(scan);
      if (!alive.current) { loaded.geometry.dispose(); loaded.material.dispose(); return; }
      if (!loaded.usedHighQualityMesh) { loaded.geometry.dispose(); loaded.material.dispose(); setPhase('noDetailedBody'); return; }
      const { positions, faces } = readBodyGeometry(loaded.geometry);
      bodyRef.current = { geometry: loaded.geometry, material: loaded.material };
      setBody({ displayObject: loaded.displayObject, positions, faces, group });
      setPhase('ready');
    } catch (e) {
      if (!alive.current) return;
      setPhase(e && e.code === 'no-detailed-body' ? 'noDetailedBody' : 'bodyFailed');
    }
  }, []);

  useEffect(() => { loadBody(); }, [loadBody]);

  // 2. The sizing for the body's group (a small download, kept on the phone).
  const loadSizingFor = useCallback(async (group) => {
    setSizingError(null);
    try {
      const loaded = await loadSizing(getAppPackStore(), group);
      if (!alive.current) return;
      setSizing(loaded);
      setGarmentKey((current) => current || garmentsForGroup(group)[0].key);
    } catch (e) {
      if (alive.current) setSizingError(e);
    }
  }, []);

  useEffect(() => { if (body && !sizing) loadSizingFor(body.group); }, [body, sizing, loadSizingFor]);

  // 3. A fit: blend the chosen size to the body and push it off the skin.
  const runFit = useCallback(async (key, chosenSize) => {
    if (!body || !sizing) return;
    const id = ++runId.current;
    setSize(chosenSize);
    setFit({ status: 'fitting', step: 'Getting the garment...', result: null, error: null });
    try {
      // let the screen show "fitting" before the blend takes the phone's attention
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = await fitGarment(
        { store: getAppPackStore(), now, onStep: (step) => { if (alive.current && runId.current === id) setFit((f) => ({ ...f, step })); } },
        { sizing, garmentKey: key, group: body.group, size: chosenSize, bodyPositions: body.positions, bodyFaces: body.faces },
      );
      if (!alive.current || runId.current !== id) return;
      setFit({ status: 'done', step: '', result, error: null });
    } catch (e) {
      if (!alive.current || runId.current !== id) return;
      setFit({ status: 'error', step: '', result: null, error: e });
    }
  }, [body, sizing]);

  // A new garment: pick the size to start with, then fit it.
  useEffect(() => {
    if (!body || !sizing || !garmentKey) return;
    let rec;
    try {
      rec = recommend(sizing, garmentKey, body.positions);
    } catch (e) {
      setFit({ status: 'error', step: '', result: null, error: e });
      return;
    }
    setRecommendation(rec);
    runFit(garmentKey, rec.size);
  }, [body, sizing, garmentKey, runFit]);

  const garments = body ? garmentsForGroup(body.group) : [];
  const sizes = sizing && garmentKey && sizing.garments[garmentKey] ? sortSizes(Object.keys(sizing.garments[garmentKey].sizes)) : [];
  const result = fit.status === 'done' ? fit.result : null;
  const fitNote = result ? [VERDICT_TEXT[result.fit.verdict], result.outsidePack ? 'Your body shape is unusual for this garment, so the drape may be less exact.' : null].filter(Boolean) : [];

  let overlay = null;
  if (phase === 'loading') overlay = { busy: true, text: message };
  else if (phase === 'noScan') overlay = { text: 'Take a body scan first. Try-On fits garments to your 3D body.', action: { label: 'Take a Body Scan', onPress: () => router.push('/body-scan/capture') } };
  else if (phase === 'unsupported') overlay = { text: 'Try-On needs a body scan that says whether it is a male or a female body.' };
  else if (phase === 'noDetailedBody') overlay = { text: 'Try-On needs the detailed 3D body, which was not available just now.', action: { label: 'Try Again', onPress: loadBody } };
  else if (phase === 'bodyFailed') overlay = { text: 'Your 3D body could not be loaded.', action: { label: 'Try Again', onPress: loadBody } };
  else if (sizingError) overlay = { text: unavailableText(sizingError), detail: reasonText(sizingError), action: { label: 'Try Again', onPress: () => loadSizingFor(body.group) } };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
        <Text style={s.headerTitle}>Digital Try-On</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.stage}>
          {phase === 'ready' && (
            <TryOnScene body={body} garment={result ? { positions: result.positions, faces: result.faces } : null} height={340} />
          )}
          {overlay && (
            <View style={s.overlay}>
              {overlay.busy ? <ActivityIndicator color="#999" /> : <Ionicons name="body-outline" size={48} color="#666" />}
              <Text style={s.overlayText}>{overlay.text}</Text>
              {!!overlay.detail && <Text style={s.overlayDetail}>{overlay.detail}</Text>}
              {overlay.action && (
                <Pressable style={s.overlayBtn} onPress={overlay.action.onPress}><Text style={s.overlayBtnText}>{overlay.action.label}</Text></Pressable>
              )}
            </View>
          )}
          {!overlay && phase === 'ready' && (fit.status === 'fitting' || !sizing) && (
            <View style={s.fitting}><ActivityIndicator color="#FFF" /><Text style={s.fittingText}>{sizing ? fit.step : 'Getting the garments...'}</Text></View>
          )}
          {!overlay && result && <Text style={s.dragHint}>Drag to turn</Text>}
        </View>

        <Text style={s.privacy}>Garments are fitted on this phone. Try-On only downloads garment files; your 3D body is built the same way Body Scan builds it.</Text>

        {phase === 'ready' && !sizingError && (
          <>
            <Text style={s.sectionLabel}>Garment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {garments.map((g) => (
                <Pressable key={g.key} style={[s.productCard, garmentKey === g.key && s.productSelected]} onPress={() => setGarmentKey(g.key)} accessibilityRole="button" accessibilityState={{ selected: garmentKey === g.key }}>
                  <Ionicons name={g.icon} size={24} color={garmentKey === g.key ? '#FFF' : '#333'} />
                  <Text style={[s.productName, garmentKey === g.key && { color: '#FFF' }]}>{g.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {sizes.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Size{recommendation ? ` (best fit for you: ${recommendation.size})` : ''}</Text>
                <View style={s.pills}>
                  {sizes.map((sz) => (
                    <Pressable key={sz} style={[s.pill, size === sz && s.pillActive, recommendation && recommendation.size === sz && size !== sz && s.pillBest]} onPress={() => garmentKey && runFit(garmentKey, sz)} accessibilityRole="button" accessibilityState={{ selected: size === sz }}>
                      <Text style={[s.pillText, size === sz && s.pillTextActive]}>{sz}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {fit.status === 'error' && (
              <>
                <Text style={s.note}>{fit.error && fit.error.name === 'PackStoreError' ? unavailableText(fit.error) : 'The garment could not be fitted just now. Try another size or try again.'}</Text>
                {!!reasonText(fit.error) && <Text style={s.noteDetail}>{reasonText(fit.error)}</Text>}
              </>
            )}
            {fitNote.map((line) => <Text key={line} style={s.note}>{line}</Text>)}
            {result && (
              <Text style={s.timing}>Fitted in {(result.timings.total / 1000).toFixed(1)} s{result.downloaded ? ' (first time: the garment was downloaded)' : ''}. The garment is shown in one colour; fabric pictures are not part of Try-On yet.</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#000' },
  content: { paddingBottom: 40 },
  stage: { height: 340, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#1A1A1A' },
  overlayText: { fontSize: 14, color: '#BBB', marginTop: 12, textAlign: 'center', lineHeight: 20 },
  overlayDetail: { fontSize: 11, color: '#888', marginTop: 10, textAlign: 'center', lineHeight: 15 },
  overlayBtn: { marginTop: 16, backgroundColor: '#FFF', paddingHorizontal: 22, height: 40, borderRadius: 20, justifyContent: 'center' },
  overlayBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  fitting: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  fittingText: { fontSize: 12, color: '#FFF' },
  dragHint: { position: 'absolute', bottom: 8, alignSelf: 'center', fontSize: 11, color: '#999' },
  privacy: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: 20, marginTop: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  chips: { paddingLeft: 20, paddingRight: 6 },
  productCard: { width: 130, backgroundColor: '#F0F0F0', borderRadius: 14, padding: 14, alignItems: 'center', marginRight: 10 },
  productSelected: { backgroundColor: '#000' },
  productName: { fontSize: 12, fontWeight: '600', color: '#333', marginTop: 6, textAlign: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  pill: { minWidth: 48, height: 44, paddingHorizontal: 8, borderRadius: 22, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  pillActive: { backgroundColor: '#000' },
  pillBest: { borderWidth: 2, borderColor: '#000' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#333' },
  pillTextActive: { color: '#FFF' },
  note: { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 20, marginTop: 14 },
  noteDetail: { fontSize: 11, color: '#888', lineHeight: 15, paddingHorizontal: 20, marginTop: 6 },
  timing: { fontSize: 11, color: '#999', lineHeight: 16, paddingHorizontal: 20, marginTop: 12 },
});

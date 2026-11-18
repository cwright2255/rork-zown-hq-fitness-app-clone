// app/shop/try-on.jsx
//
// Digital Try-On: the person's own 3D body (the same one the Body Scan screen shows) wearing a garment fitted to it. The garment's drape was simulated
// ahead of time on made-up bodies and packed small (lib/tryOn/pack.js); the phone blends it to this body, keeps it off the skin and draws it. The
// fitting happens on the phone and Try-On's own downloads are only the garment files, which are the same for everyone and kept on the phone after the
// first time (lib/tryOn/packStore.js, from private storage that only signed-in people can read). The 3D body itself comes from lib/loadScanMesh.js,
// exactly as on the Body Scan screen: kept on the phone once made, and otherwise requested from the mesh service with the scan's saved numbers. The garments are drawn in one colour each, because the packs hold their
// shape, not their fabric picture. A top and a bottom can be worn together (the hoodie over the sweatpants or the shorts): the bottom is fitted first, exactly as when it is worn alone,
// and the top is fitted over it (lib/tryOn/layers.js), so what goes over a bottom never changes its fit.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import TryOnScene from '@/components/TryOnScene';
import { STAGE_BACKGROUND } from '@/lib/tryOn/stage';
import { colors } from '@/constants/theme';
import { loadScanMesh } from '@/lib/loadScanMesh';
import { latestScan } from '@/lib/tryOn/latestScan';
import { getAppPackStore } from '@/lib/tryOn/appPackStore';
import { garmentsForGroup, groupForGender, sortSizes } from '@/lib/tryOn/garments';
import { EMPTY_OUTFIT, SLOTS, slotOf, tapGarment } from '@/lib/tryOn/outfit';
import { fitGarment, loadSizing, readBodyGeometry, recommend } from '@/lib/tryOn/tryOnSession';

const IDLE = { status: 'idle', step: '', result: null, error: null, key: null, size: null };

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
  const [outfit, setOutfit] = useState(EMPTY_OUTFIT); // the garment worn in each slot: { top, bottom }
  const [chosenSize, setChosenSize] = useState({}); // garment key -> the size being shown
  const [recommendations, setRecommendations] = useState({}); // garment key -> { size, ... } from recommend()
  const [fits, setFits] = useState({ bottom: IDLE, top: IDLE }); // slot -> { status, step, result, error, key, size }
  const alive = useRef(true);
  const bodyRef = useRef(null);
  const runIds = useRef({ bottom: 0, top: 0 }); // the newest fit asked for in each slot: an older, slower answer is dropped
  const started = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      runIds.current = { bottom: runIds.current.bottom + 1, top: runIds.current.top + 1 };
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
    } catch (e) {
      if (alive.current) setSizingError(e);
    }
  }, []);

  useEffect(() => { if (body && !sizing) loadSizingFor(body.group); }, [body, sizing, loadSizingFor]);

  // The garments that can be tried: the body's group, and only those the sizing has (a garment whose files are not up yet is not offered).
  const garments = body && sizing ? garmentsForGroup(body.group).filter((g) => sizing.garments[g.key]) : [];
  const labelOfKey = (key) => (garmentsForGroup(body ? body.group : null).find((g) => g.key === key) || { label: key }).label;

  // 3. A fit: blend the chosen size to the body and push it off the skin (and, for a top, off the bottom that is worn under it).
  const runFit = useCallback(async (slot, key, size, under) => {
    if (!body || !sizing) return;
    const id = ++runIds.current[slot];
    const mine = () => alive.current && runIds.current[slot] === id;
    setFits((f) => ({ ...f, [slot]: { status: 'fitting', step: 'Getting the garment...', result: null, error: null, key, size } }));
    try {
      // let the screen show "fitting" before the blend takes the phone's attention
      await new Promise((resolve) => setTimeout(resolve, 0));
      const args = { sizing, garmentKey: key, group: body.group, size, bodyPositions: body.positions, bodyFaces: body.faces };
      if (under) args.under = [under];
      const result = await fitGarment(
        { store: getAppPackStore(), now, onStep: (step) => { if (mine()) setFits((f) => ({ ...f, [slot]: { ...f[slot], step } })); } },
        args,
      );
      if (!mine()) return;
      setFits((f) => ({ ...f, [slot]: { status: 'done', step: '', result, error: null, key, size } }));
    } catch (e) {
      if (!mine()) return;
      setFits((f) => ({ ...f, [slot]: { status: 'error', step: '', result: null, error: e, key, size } }));
    }
  }, [body, sizing]);

  // Putting a garment on starts it on its own recommended size.
  const putOn = useCallback((key) => {
    const slot = slotOf(body.group, key);
    let rec = null;
    try {
      rec = recommend(sizing, key, body.positions);
    } catch (e) {
      setFits((f) => ({ ...f, [slot]: { status: 'error', step: '', result: null, error: e, key, size: null } }));
    }
    if (rec) {
      setRecommendations((r) => ({ ...r, [key]: rec }));
      setChosenSize((c) => ({ ...c, [key]: rec.size }));
    }
  }, [body, sizing]);

  // The first garment is put on once there is a body and sizing.
  useEffect(() => {
    if (!body || !sizing || started.current) return;
    started.current = true;
    const first = garmentsForGroup(body.group).find((g) => sizing.garments[g.key]);
    if (first) {
      setOutfit((o) => tapGarment(o, body.group, first.key));
      putOn(first.key);
    }
  }, [body, sizing, putOn]);

  // A tap: takes a worn garment off, or puts one on (in place of the one worn in its slot).
  const onTapGarment = (key) => {
    const wasWorn = outfit.top === key || outfit.bottom === key;
    setOutfit((o) => tapGarment(o, body.group, key));
    if (!wasWorn) putOn(key);
  };

  const bottomKey = outfit.bottom;
  const topKey = outfit.top;
  const bottomSize = bottomKey ? chosenSize[bottomKey] : null;
  const topSize = topKey ? chosenSize[topKey] : null;

  // The bottom is fitted on its own, exactly as when it is worn alone.
  useEffect(() => {
    if (!body || !sizing) return;
    if (!bottomKey) { runIds.current.bottom += 1; setFits((f) => ({ ...f, bottom: IDLE })); return; }
    if (!bottomSize) return;
    runFit('bottom', bottomKey, bottomSize, null);
  }, [body, sizing, bottomKey, bottomSize, runFit]);

  // The top is fitted over the bottom that is worn, once that is fitted; when the bottom changes, the top is fitted again over the new one.
  const bottomFit = fits.bottom;
  const bottomReady = !bottomKey || (bottomFit.status === 'done' && bottomFit.key === bottomKey && bottomFit.size === bottomSize) || bottomFit.status === 'error';
  const bottomLayer = bottomKey && bottomFit.status === 'done' && bottomFit.result ? { positions: bottomFit.result.positions, faces: bottomFit.result.faces } : null;
  useEffect(() => {
    if (!body || !sizing) return;
    if (!topKey) { runIds.current.top += 1; setFits((f) => ({ ...f, top: IDLE })); return; }
    if (!topSize) return;
    if (!bottomReady) {
      runIds.current.top += 1;
      setFits((f) => ({ ...f, top: { status: 'fitting', step: 'Fitting the bottom first...', result: null, error: null, key: topKey, size: topSize } }));
      return;
    }
    runFit('top', topKey, topSize, bottomLayer);
    // bottomLayer is a new object each render; the bottom's fit result itself says when it changed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, sizing, topKey, topSize, bottomReady, bottomFit.result, runFit]);

  const worn = SLOTS.map((slot) => ({ slot, key: outfit[slot], fit: fits[slot] })).filter((w) => w.key);
  const sizesOf = (key) => (sizing && sizing.garments[key] ? sortSizes(Object.keys(sizing.garments[key].sizes)) : []);
  // What is drawn: each fitted garment, bottom first. Made anew only when a fit's result changes, so the scene does not rebuild its meshes on every small update.
  const bottomDone = outfit.bottom && fits.bottom.status === 'done' ? fits.bottom.result : null;
  const topDone = outfit.top && fits.top.status === 'done' ? fits.top.result : null;
  const drawn = useMemo(
    () => [bottomDone && { slot: 'bottom', key: outfit.bottom, positions: bottomDone.positions, faces: bottomDone.faces }, topDone && { slot: 'top', key: outfit.top, positions: topDone.positions, faces: topDone.faces }].filter(Boolean),
    [outfit.bottom, outfit.top, bottomDone, topDone],
  );
  const fitting = worn.find((w) => w.fit.status === 'fitting');
  const several = worn.length > 1;
  const notesFor = (w) => {
    const result = w.fit.status === 'done' ? w.fit.result : null;
    if (!result) return [];
    const lines = [VERDICT_TEXT[result.fit.verdict], result.outsidePack ? 'Your body shape is unusual for this garment, so the drape may be less exact.' : null].filter(Boolean);
    return several ? lines.map((line) => labelOfKey(w.key) + ': ' + line) : lines;
  };
  const totalMs = worn.reduce((sum, w) => sum + (w.fit.status === 'done' && w.fit.result ? w.fit.result.timings.total : 0), 0);
  const allDone = worn.length > 0 && worn.every((w) => w.fit.status === 'done' && w.fit.result);
  const downloadedAny = worn.some((w) => w.fit.status === 'done' && w.fit.result && w.fit.result.downloaded);

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
            <TryOnScene body={body} garments={drawn} height={340} />
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
          {!overlay && phase === 'ready' && (!!fitting || !sizing) && (
            <View style={s.fitting}><ActivityIndicator color="#FFF" /><Text style={s.fittingText}>{sizing ? fitting.fit.step : 'Getting the garments...'}</Text></View>
          )}
          {!overlay && drawn.length > 0 && <Text style={s.dragHint}>Drag to turn</Text>}
        </View>

        <Text style={s.privacy}>Garments are fitted on this phone. Try-On only downloads garment files; your 3D body is built the same way Body Scan builds it.</Text>

        {phase === 'ready' && !sizingError && (
          <>
            <Text style={s.sectionLabel}>Garment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {garments.map((g) => {
                const on = outfit.top === g.key || outfit.bottom === g.key;
                return (
                  <Pressable key={g.key} style={[s.productCard, on && s.productSelected]} onPress={() => onTapGarment(g.key)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Ionicons name={g.icon} size={24} color={on ? '#FFF' : '#333'} />
                    <Text style={[s.productName, on && { color: '#FFF' }]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {garments.some((g) => g.slot === 'top') && garments.some((g) => g.slot === 'bottom') && (
              <Text style={s.hint}>Tap a garment to put it on or take it off. A top is worn over a bottom.</Text>
            )}

            {worn.map((w) => {
              const sizes = sizesOf(w.key);
              if (sizes.length === 0) return null;
              const rec = recommendations[w.key];
              const chosen = chosenSize[w.key];
              return (
                <React.Fragment key={w.key}>
                  <Text style={s.sectionLabel}>{(several ? 'Size: ' + labelOfKey(w.key) : 'Size') + (rec ? ` (best fit for you: ${rec.size})` : '')}</Text>
                  <View style={s.pills}>
                    {sizes.map((sz) => (
                      <Pressable key={sz} style={[s.pill, chosen === sz && s.pillActive, rec && rec.size === sz && chosen !== sz && s.pillBest]} onPress={() => setChosenSize((c) => ({ ...c, [w.key]: sz }))} accessibilityRole="button" accessibilityState={{ selected: chosen === sz }}>
                        <Text style={[s.pillText, chosen === sz && s.pillTextActive]}>{sz}</Text>
                      </Pressable>
                    ))}
                  </View>
                </React.Fragment>
              );
            })}

            {worn.filter((w) => w.fit.status === 'error').map((w) => (
              <React.Fragment key={'err-' + w.key}>
                <Text style={s.note}>{w.fit.error && w.fit.error.name === 'PackStoreError' ? unavailableText(w.fit.error) : (several ? labelOfKey(w.key) + ' could not be fitted just now. Try another size or try again.' : 'The garment could not be fitted just now. Try another size or try again.')}</Text>
                {!!reasonText(w.fit.error) && <Text style={s.noteDetail}>{reasonText(w.fit.error)}</Text>}
              </React.Fragment>
            ))}
            {worn.flatMap(notesFor).map((line) => <Text key={line} style={s.note}>{line}</Text>)}
            {allDone && (
              <Text style={s.timing}>Fitted in {(totalMs / 1000).toFixed(1)} s{downloadedAny ? ' (first time: the garment was downloaded)' : ''}. {several ? 'Each garment is shown in one colour' : 'The garment is shown in one colour'}; fabric pictures are not part of Try-On yet.</Text>
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
  stage: { height: 340, backgroundColor: STAGE_BACKGROUND, justifyContent: 'center', alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: STAGE_BACKGROUND },
  overlayText: { fontSize: 14, color: '#555', marginTop: 12, textAlign: 'center', lineHeight: 20 },
  overlayDetail: { fontSize: 11, color: '#777', marginTop: 10, textAlign: 'center', lineHeight: 15 },
  overlayBtn: { marginTop: 16, backgroundColor: '#000', paddingHorizontal: 22, height: 40, borderRadius: 20, justifyContent: 'center' },
  overlayBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  fitting: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  fittingText: { fontSize: 12, color: '#FFF' },
  dragHint: { position: 'absolute', bottom: 8, alignSelf: 'center', fontSize: 11, color: '#777' },
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
  hint: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: 20, marginTop: 10 },
  note: { fontSize: 14, color: '#333', lineHeight: 20, paddingHorizontal: 20, marginTop: 14 },
  noteDetail: { fontSize: 11, color: '#888', lineHeight: 15, paddingHorizontal: 20, marginTop: 6 },
  timing: { fontSize: 11, color: '#999', lineHeight: 16, paddingHorizontal: 20, marginTop: 12 },
});

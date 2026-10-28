// app/workout/session.jsx
//
// Today's Session: the training engine's pick for today (lib/sessionPicker.js), built on the phone from how rested each muscle is, what has been
// done this week, the goal, the equipment and the injuries on the profile. Each exercise says why it was picked, in the engine's words. The
// engine's session is shown at once and costs nothing; a moment later the AI may put its own words on the name and the reasons
// (services/sessionWordingService.js), and they replace the engine's only when they pass lib/sessionWording.js's checks against the engine's own
// numbers, with a line under the title saying so. The exercises, sets, reps and weights are always the engine's. Start Workout saves the session
// the way Quick Workout saves one (store/workoutStore.js addWorkout) and opens it on the workout detail screen, where the usual Start button,
// the target card and the Easy / OK / Hard buttons work as for any workout.
//
// Each exercise has four controls, which are how the person tells the engine what it got right and wrong (lib/trainingFeedback.js):
//   More / Less  count at once and change how often the exercise is picked from the next session built (changing the time or the equipment, or
//                opening the screen again): the session on the screen is not reshuffled under the person.
//   Swap         before starting only: up to three other exercises for the same muscle, each with its reason; the one tapped takes the place of
//                this one, and the rest of the session stays exactly as it is.
//   Exclude      after a confirmation: never picked again until restored from the list at the bottom (a bodyweight progression is excluded with
//                its easier and harder versions). The slot is filled by the first swap option, or dropped when none fits.
// A session that has been swapped or excluded in is the person's, not the engine's, so the AI is not asked to put words on it. What was swapped
// and excluded is counted when the workout is started (lib/trainingMeasures.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrainingFeedbackStore } from '@/store/trainingFeedbackStore';
import { INJURY_LABELS } from '@/lib/userProfileData';
import {
  SESSION_RULES, EQUIPMENT_LABELS, SESSION_DISCLAIMER, minutesFromPreference, sessionToWorkout, dropExercise,
} from '@/lib/sessionPicker';
import { getExercise } from '@/lib/exerciseLibrary';
import { startFromParams } from '@/lib/homeRecommendations';
import { feedbackKey, voteOf, excludedList } from '@/lib/trainingFeedback';
import {
  refreshSessionSources, buildTodaySession, getSwapOptions, swapInExercise,
} from '@/services/sessionService';
import { WORDING_RULES, WORDING_CAPTION, applyWording } from '@/lib/sessionWording';
import { wordSession, peekWording } from '@/services/sessionWordingService';
import { unitFromSetting } from '@/lib/weightUnits';

const EQUIPMENT_CHOICES = ['gym', 'dumbbells', 'bodyweight'];

function repsText(x) {
  if (x.timed) return `${x.sets} x ${x.holdSeconds}s hold`;
  return `${x.sets} x ${x.reps} reps`;
}

export default function TodaySessionScreen() {
  const router = useRouter();
  const uid = useUserStore((s) => s.user?.uid);
  const weightUnit = useSettingsStore((s) => unitFromSetting(s.weightUnits));
  // Opened from a Recommended Workouts card on Home, the screen starts with that card's time and equipment; opened any other way, with the
  // person's preferred time and a full gym.
  const params = useLocalSearchParams();
  const [start] = useState(() => startFromParams(params, minutesFromPreference(useUserStore.getState().user?.preferences?.preferredDuration)));
  const [minutes, setMinutes] = useState(start.minutes);
  const [equipment, setEquipment] = useState(start.equipment);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // The exercise whose swap options are open ({ id, options }), whether a swap is being worked out, and whether the excluded list is open.
  const [swapOpen, setSwapOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const feedback = useTrainingFeedbackStore((s) => s.feedback);
  // The AI's checked wording, with the session it was made for: it is only put on that session, never on the next one.
  const [worded, setWorded] = useState({ session: null, wording: null });
  const latest = useRef(0);
  const refreshed = useRef(null);
  const histories = useRef(new Map());
  // How many exercises of the session on the screen were swapped for another, and how many excluded, counted when Start Workout is pressed.
  const edits = useRef({ swapped: 0, excluded: 0 });

  const build = useCallback(async () => {
    const mine = latest.current + 1;
    latest.current = mine;
    setLoading(true);
    setError(null);
    try {
      // The stores are brought up to date once; changing the time or the equipment only picks again.
      if (!refreshed.current) refreshed.current = refreshSessionSources(uid);
      await refreshed.current;
      const next = await buildTodaySession({ uid, user: useUserStore.getState().user, minutes, equipment, cache: histories.current });
      if (latest.current !== mine) return;
      if (next) {
        edits.current = { swapped: 0, excluded: 0 };
        setSwapOpen(null);
        setSession(next);
      } else { setSession(null); setError("Couldn't build a session right now. Please try again."); }
    } catch {
      if (latest.current === mine) { setSession(null); setError("Couldn't build a session right now. Please try again."); }
    } finally {
      if (latest.current === mine) setLoading(false);
    }
  }, [uid, minutes, equipment]);

  useEffect(() => { build(); }, [build]);

  // The cloud copy of what the person has told the engine is brought in (and kept up to date) once the person is known.
  useEffect(() => {
    if (uid) useTrainingFeedbackStore.getState().startSync(uid);
  }, [uid]);

  const ok = !loading && session && session.status === 'ok';
  const wording = ok && worded.session === session ? worded.wording : null;
  const shown = ok ? applyWording(session, wording) : null;

  // Once the session has settled, the AI is asked for the words (an answer already kept for the same session is used at once). The session is
  // on the screen meanwhile, in the engine's words, and stays so if nothing usable comes back.
  useEffect(() => {
    // A session the person has swapped or excluded something in is theirs now: the AI's words were written for the session as it was picked.
    if (!ok || session.edited) return undefined;
    const known = peekWording(session, { unit: weightUnit, equipment });
    if (known !== undefined) {
      setWorded({ session, wording: known });
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await wordSession(session, { unit: weightUnit, equipment });
      if (!cancelled) setWorded({ session, wording: found });
    }, WORDING_RULES.delayMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ok, session, weightUnit, equipment]);

  const handleStart = async () => {
    const workout = sessionToWorkout(shown);
    if (!workout || !uid || saving) return;
    setSaving(true);
    try {
      const saved = await useWorkoutStore.getState().addWorkout(workout, uid);
      useTrainingFeedbackStore.getState().recordStart({
        exercises: shown.exercises.length, swapped: edits.current.swapped, excluded: edits.current.excluded,
      });
      router.replace(`/workout/${saved.id}`);
    } catch {
      setError("Couldn't save the session. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const currentUser = () => useUserStore.getState().user;

  const handleVote = (x, tapped) => useTrainingFeedbackStore.getState().vote(feedbackKey(x), tapped);

  // Opens (or closes) the other exercises that could take this one's place.
  const handleSwapToggle = (x) => {
    if (busy) return;
    if (swapOpen && swapOpen.id === x.id) { setSwapOpen(null); return; }
    setSwapOpen({ id: x.id, options: getSwapOptions({ user: currentUser(), minutes, equipment, session, exerciseId: x.id }) });
  };

  const handleSwapPick = async (x, pick) => {
    if (busy) return;
    const mine = latest.current;
    setBusy(true);
    try {
      const next = await swapInExercise(session, x.id, pick, { uid, user: currentUser(), cache: histories.current });
      // The time or the equipment was changed meanwhile: that session is gone, and so is this swap.
      if (latest.current !== mine) return;
      useTrainingFeedbackStore.getState().noteSwap(feedbackKey(x));
      edits.current.swapped += 1;
      setSwapOpen(null);
      setSession(next);
    } finally {
      setBusy(false);
    }
  };

  const doExclude = async (x) => {
    if (busy) return;
    const mine = latest.current;
    const lib = getExercise(x.id);
    setBusy(true);
    try {
      useTrainingFeedbackStore.getState().exclude(feedbackKey(x), { name: x.name, ladder: !!(lib && lib.ladder) });
      edits.current.excluded += 1;
      setSwapOpen(null);
      // The slot goes to the first exercise that fits (the exclusion is already in force, so a bodyweight progression's other rungs are not offered);
      // with none that fits it is dropped, and a session left with nothing is built again.
      const [first] = getSwapOptions({ user: currentUser(), minutes, equipment, session, exerciseId: x.id, limit: 1 });
      const next = first
        ? await swapInExercise(session, x.id, first, { uid, user: currentUser(), cache: histories.current })
        : dropExercise(session, x.id);
      if (latest.current !== mine) return;
      if (next) setSession(next);
      else build();
    } finally {
      setBusy(false);
    }
  };

  const handleExclude = (x) => {
    if (busy) return;
    const lib = getExercise(x.id);
    const what = lib && lib.ladder ? `${x.name} or its easier and harder versions` : x.name;
    Alert.alert(
      `Exclude ${x.name}?`,
      `Today's Session will not pick ${what} again until you restore it from the list at the bottom of this screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exclude', style: 'destructive', onPress: () => doExclude(x) },
      ],
    );
  };

  const excluded = excludedList(feedback);

  const leftOut = ok ? session.leftOutFor.map((id) => INJURY_LABELS[id] || id.replace(/_/g, ' ')) : [];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Today's Session" showBack variant="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          Chosen from how rested each muscle is, what you have done this week, your goal, your equipment and any injuries on your profile.
        </Text>

        <Text style={styles.label}>Time</Text>
        <View style={styles.chipRow}>
          {SESSION_RULES.minutesOptions.map((m) => (
            <Pressable
              key={m}
              style={[styles.chip, minutes === m && styles.chipActive]}
              onPress={() => setMinutes(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: minutes === m }}
            >
              <Text style={[styles.chipText, minutes === m && styles.chipTextActive]}>{m} min</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, styles.labelGap]}>Equipment</Text>
        <View style={styles.chipRow}>
          {EQUIPMENT_CHOICES.map((id) => (
            <Pressable
              key={id}
              style={[styles.chip, equipment === id && styles.chipActive]}
              onPress={() => setEquipment(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: equipment === id }}
            >
              <Text style={[styles.chipText, equipment === id && styles.chipTextActive]}>{EQUIPMENT_LABELS[id]}</Text>
            </Pressable>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#000" />
            <Text style={styles.loadingText}>Choosing your exercises...</Text>
          </View>
        )}

        {!loading && error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && session && session.status !== 'ok' && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{session.message}</Text>
          </View>
        )}

        {ok && (
          <>
            <Text style={styles.sessionTitle}>{shown.name}</Text>
            <Text style={styles.sessionMeta}>
              {shown.exercises.length} exercises · {shown.totalSets} sets · about {shown.minutes} min
            </Text>
            {shown.worded && <Text style={styles.wordedCaption}>{WORDING_CAPTION}</Text>}
            <Text style={styles.feedbackHelp}>
              More and Less change how often an exercise is picked, from the next session you build. Swap replaces it in this session. Exclude removes it until you restore it.
            </Text>
            {shown.exercises.map((x) => {
              const vote = voteOf(feedback, feedbackKey(x));
              const open = swapOpen && swapOpen.id === x.id ? swapOpen : null;
              return (
                <View key={x.id} style={styles.card}>
                  <Text style={styles.cardName}>{x.name}</Text>
                  <Text style={styles.cardSets}>{repsText(x)}</Text>
                  {!!x.target && <Text style={styles.cardTarget}>Start at {x.target}</Text>}
                  {!!x.detail && <Text style={styles.cardDetail}>{x.detail}</Text>}
                  <Text style={styles.cardReason}>{x.reason}</Text>
                  <View style={styles.pillRow}>
                    <Pressable
                      style={[styles.pill, vote === 'more' && styles.pillActive]}
                      onPress={() => handleVote(x, 'more')}
                      accessibilityRole="button"
                      accessibilityLabel={`More ${x.name}`}
                      accessibilityState={{ selected: vote === 'more' }}
                    >
                      <Text style={[styles.pillText, vote === 'more' && styles.pillTextActive]}>More</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.pill, vote === 'less' && styles.pillActive]}
                      onPress={() => handleVote(x, 'less')}
                      accessibilityRole="button"
                      accessibilityLabel={`Less ${x.name}`}
                      accessibilityState={{ selected: vote === 'less' }}
                    >
                      <Text style={[styles.pillText, vote === 'less' && styles.pillTextActive]}>Less</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.pill, !!open && styles.pillActive]}
                      onPress={() => handleSwapToggle(x)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Swap ${x.name}`}
                      accessibilityState={{ expanded: !!open }}
                    >
                      <Text style={[styles.pillText, !!open && styles.pillTextActive]}>Swap</Text>
                    </Pressable>
                    <Pressable
                      style={styles.pill}
                      onPress={() => handleExclude(x)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Exclude ${x.name}`}
                    >
                      <Text style={[styles.pillText, styles.pillTextDanger]}>Exclude</Text>
                    </Pressable>
                  </View>
                  {!!open && (
                    <View style={styles.swapPanel}>
                      {open.options.length === 0 ? (
                        <Text style={styles.swapNone}>
                          No other exercise fits right now: the muscles it works are still recovering, or the time, your equipment or your injuries leave nothing else.
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.swapLabel}>Swap for</Text>
                          {open.options.map((o) => (
                            <Pressable
                              key={o.id}
                              style={styles.swapOption}
                              onPress={() => handleSwapPick(x, o)}
                              disabled={busy}
                              accessibilityRole="button"
                              accessibilityLabel={`Swap ${x.name} for ${o.name}`}
                            >
                              <Text style={styles.swapName}>{o.name}</Text>
                              <Text style={styles.cardSets}>{repsText(o)}</Text>
                              <Text style={styles.cardReason}>{o.reason}</Text>
                            </Pressable>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            {!!shown.note && <Text style={styles.note}>{shown.note}</Text>}
            {leftOut.length > 0 && (
              <Text style={styles.note}>
                Left out because of the injuries you reported: {leftOut.join(', ')}. Exercises that load those areas are never picked.
              </Text>
            )}
            <Text style={styles.disclaimer}>{SESSION_DISCLAIMER}</Text>
          </>
        )}

        {!loading && excluded.length > 0 && (
          <View style={styles.excludedBox}>
            <Pressable
              onPress={() => setShowExcluded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showExcluded }}
              accessibilityLabel={`Excluded exercises, ${excluded.length}`}
            >
              <Text style={styles.excludedTitle}>{showExcluded ? 'Hide' : 'Show'} excluded exercises ({excluded.length})</Text>
            </Pressable>
            {showExcluded && (
              <>
                {excluded.map((e) => (
                  <View key={e.key} style={styles.excludedRow}>
                    <Text style={styles.excludedName}>{e.ladder ? `${e.name} and its easier and harder versions` : e.name}</Text>
                    <Pressable
                      style={styles.pill}
                      onPress={() => useTrainingFeedbackStore.getState().restore(e.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Restore ${e.name}`}
                    >
                      <Text style={styles.pillText}>Restore</Text>
                    </Pressable>
                  </View>
                ))}
                <Text style={styles.note}>
                  A restored exercise can be picked again the next time the session is built: change the time or the equipment, or open this screen again.
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {ok && (
        <View style={styles.bottomBar}>
          <PrimaryButton title="Start Workout" onPress={handleStart} loading={saving} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 140 },
  intro: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999', marginBottom: 10 },
  labelGap: { marginTop: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0F0F0' },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#333' },
  chipTextActive: { color: '#FFF' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28 },
  loadingText: { fontSize: 14, color: '#666' },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 24 },
  noticeBox: { marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: '#F6F6F6' },
  noticeText: { fontSize: 14, color: '#333', lineHeight: 21 },
  sessionTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginTop: 28 },
  sessionMeta: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 14 },
  wordedCaption: { fontSize: 11, color: '#999', lineHeight: 16, marginTop: -8, marginBottom: 14 },
  card: { padding: 14, borderRadius: 14, backgroundColor: '#F6F6F6', marginBottom: 10 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#000' },
  cardSets: { fontSize: 14, color: '#333', marginTop: 2 },
  cardTarget: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 6 },
  cardDetail: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 17 },
  cardReason: { fontSize: 12, color: '#666', marginTop: 6, lineHeight: 17 },
  feedbackHelp: { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0' },
  pillActive: { backgroundColor: '#000', borderColor: '#000' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#333' },
  pillTextActive: { color: '#FFF' },
  pillTextDanger: { color: '#DC2626' },
  swapPanel: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E4E4E4' },
  swapLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999', marginBottom: 8 },
  swapNone: { fontSize: 12, color: '#666', lineHeight: 18 },
  swapOption: { padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 8 },
  swapName: { fontSize: 15, fontWeight: '700', color: '#000' },
  excludedBox: { marginTop: 24, padding: 14, borderRadius: 14, backgroundColor: '#F6F6F6' },
  excludedTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  excludedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  excludedName: { flex: 1, fontSize: 13, color: '#000' },
  note: { fontSize: 12, color: '#666', lineHeight: 18, marginTop: 8 },
  disclaimer: { fontSize: 11, color: '#999', lineHeight: 16, marginTop: 14 },
  bottomBar: { position: 'absolute', left: 20, right: 20, bottom: 24 },
});

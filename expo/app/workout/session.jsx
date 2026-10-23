// app/workout/session.jsx
//
// Today's Session: the training engine's pick for today (lib/sessionPicker.js), built on the phone from how rested each muscle is, what has been
// done this week, the goal, the equipment and the injuries on the profile. Each exercise says why it was picked, in the engine's words. The
// engine's session is shown at once and costs nothing; a moment later the AI may put its own words on the name and the reasons
// (services/sessionWordingService.js), and they replace the engine's only when they pass lib/sessionWording.js's checks against the engine's own
// numbers, with a line under the title saying so. The exercises, sets, reps and weights are always the engine's. Start Workout saves the session
// the way Quick Workout saves one (store/workoutStore.js addWorkout) and opens it on the workout detail screen, where the usual Start button,
// the target card and the Easy / OK / Hard buttons work as for any workout.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useSettingsStore } from '@/store/settingsStore';
import { INJURY_LABELS } from '@/lib/userProfileData';
import {
  SESSION_RULES, EQUIPMENT_LABELS, SESSION_DISCLAIMER, minutesFromPreference, sessionToWorkout,
} from '@/lib/sessionPicker';
import { refreshSessionSources, buildTodaySession } from '@/services/sessionService';
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
  const [minutes, setMinutes] = useState(() => minutesFromPreference(useUserStore.getState().user?.preferences?.preferredDuration));
  const [equipment, setEquipment] = useState('gym');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // The AI's checked wording, with the session it was made for: it is only put on that session, never on the next one.
  const [worded, setWorded] = useState({ session: null, wording: null });
  const latest = useRef(0);
  const refreshed = useRef(null);
  const histories = useRef(new Map());

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
      if (next) setSession(next);
      else { setSession(null); setError("Couldn't build a session right now. Please try again."); }
    } catch {
      if (latest.current === mine) { setSession(null); setError("Couldn't build a session right now. Please try again."); }
    } finally {
      if (latest.current === mine) setLoading(false);
    }
  }, [uid, minutes, equipment]);

  useEffect(() => { build(); }, [build]);

  const ok = !loading && session && session.status === 'ok';
  const wording = ok && worded.session === session ? worded.wording : null;
  const shown = ok ? applyWording(session, wording) : null;

  // Once the session has settled, the AI is asked for the words (an answer already kept for the same session is used at once). The session is
  // on the screen meanwhile, in the engine's words, and stays so if nothing usable comes back.
  useEffect(() => {
    if (!ok) return undefined;
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
      router.replace(`/workout/${saved.id}`);
    } catch {
      setError("Couldn't save the session. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
            {shown.exercises.map((x) => (
              <View key={x.id} style={styles.card}>
                <Text style={styles.cardName}>{x.name}</Text>
                <Text style={styles.cardSets}>{repsText(x)}</Text>
                {!!x.target && <Text style={styles.cardTarget}>Start at {x.target}</Text>}
                {!!x.detail && <Text style={styles.cardDetail}>{x.detail}</Text>}
                <Text style={styles.cardReason}>{x.reason}</Text>
              </View>
            ))}
            {!!shown.note && <Text style={styles.note}>{shown.note}</Text>}
            {leftOut.length > 0 && (
              <Text style={styles.note}>
                Left out because of the injuries you reported: {leftOut.join(', ')}. Exercises that load those areas are never picked.
              </Text>
            )}
            <Text style={styles.disclaimer}>{SESSION_DISCLAIMER}</Text>
          </>
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
  note: { fontSize: 12, color: '#666', lineHeight: 18, marginTop: 8 },
  disclaimer: { fontSize: 11, color: '#999', lineHeight: 16, marginTop: 14 },
  bottomBar: { position: 'absolute', left: 20, right: 20, bottom: 24 },
});

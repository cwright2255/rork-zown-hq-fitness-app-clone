// app/profile/coach-memory.jsx
//
// "What your Coach remembers": the short list of notes the Coach keeps about the person between chats (lib/coachMemory.js,
// services/coachMemoryService.js). They can read it, remove a note, forget everything, or pause it. Paused, the Coach neither adds to the list
// nor uses it. Everything shown is what is really saved: a change that could not be saved says so, and the list is read again.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import {
  loadCoachMemory, removeCoachNote, forgetCoachMemory, setCoachMemoryPaused,
} from '@/services/coachMemoryService';
import { MEMORY_MAX_FACTS, readMemory } from '@/lib/coachMemory';

export const INTRO = 'As you chat, your Coach keeps a short list of things worth remembering, like how many days a week you can train. It uses the list in every chat and in your Today brief.';
export const PRIVACY_NOTE = 'The list is saved to your account and sent to the AI along with your messages, so the Coach can use it. It is erased if you delete your account. The Coach is told not to keep health conditions, medications or other sensitive details.';
export const EMPTY_TEXT = 'Nothing yet. Once you have chatted with your Coach, the things it picks up will show here.';
export const SAVE_ERROR = 'That could not be saved. Check your connection and try again.';

export default function CoachMemoryScreen() {
  const uid = useUserStore((s) => s.user?.uid);
  const [memory, setMemory] = useState(null); // null until the list has been read
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Nobody signed in has no list to wait for.
    if (!uid) {
      setMemory(readMemory(null));
      return undefined;
    }
    loadCoachMemory(uid).then((loaded) => { if (!cancelled) setMemory(loaded); });
    return () => { cancelled = true; };
  }, [uid]);

  // Runs a change, shows what is saved afterwards, and says so when it could not be saved (the list is then read again, so it is never wrong).
  // The controls are turned off while it runs, so there is never a second change on its way.
  const change = useCallback(async (work) => {
    if (!uid) return;
    setBusy(true);
    try {
      setMemory(await work(uid));
    } catch {
      Alert.alert('Not saved', SAVE_ERROR);
      setMemory(await loadCoachMemory(uid));
    } finally {
      setBusy(false);
    }
  }, [uid]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile/settings'));

  const confirmForget = () => {
    Alert.alert(
      'Forget everything?',
      'Your Coach will forget all the notes in this list, and will not read your earlier chats again to rebuild it. Your chats themselves stay as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Forget everything', style: 'destructive', onPress: () => change((id) => forgetCoachMemory(id)) },
      ],
    );
  };

  const facts = memory?.facts ?? [];
  const remembering = memory ? !memory.paused : true;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="memory-back" accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>What your Coach remembers</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text testID="memory-intro" style={styles.intro}>{INTRO}</Text>

        {memory === null ? (
          <ActivityIndicator testID="memory-loading" color="#000000" style={styles.loading} />
        ) : (
          <>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>Remember things from our chats</Text>
                <Text style={styles.switchSub}>When this is off, your Coach stops adding to the list and does not use it.</Text>
              </View>
              <Switch
                testID="memory-switch"
                value={remembering}
                disabled={busy}
                onValueChange={(on) => change((id) => setCoachMemoryPaused(id, !on))}
                accessibilityLabel="Remember things from our chats"
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {facts.length === 0 ? (
              <Text testID="memory-empty" style={styles.empty}>{EMPTY_TEXT}</Text>
            ) : (
              <View style={styles.list}>
                <Text testID="memory-count" style={styles.count}>{`${facts.length} of ${MEMORY_MAX_FACTS} notes`}</Text>
                {facts.map((fact, i) => (
                  <View key={`${i}-${fact}`} testID={`memory-note-${i}`} style={styles.note}>
                    <Text style={styles.noteText}>{fact}</Text>
                    <Pressable
                      testID={`memory-remove-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove note: ${fact}`}
                      disabled={busy}
                      hitSlop={8}
                      onPress={() => change((id) => removeCoachNote(id, i))}
                      style={styles.remove}
                    >
                      <Ionicons name="close" size={18} color="#666666" />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  testID="memory-forget"
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={confirmForget}
                  style={styles.forget}
                >
                  <Text style={styles.forgetText}>Forget everything</Text>
                </Pressable>
              </View>
            )}

            {!remembering ? (
              <Text testID="memory-paused" style={styles.paused}>Paused. Your Coach is not adding to this list or using it.</Text>
            ) : null}
          </>
        )}

        <Text testID="memory-privacy" style={styles.privacy}>{PRIVACY_NOTE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  placeholder: { width: 40 },
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 14, color: '#444444', lineHeight: 20, marginBottom: 16 },
  loading: { marginVertical: 32 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F7F7', borderRadius: 14,
    padding: 14, marginBottom: 16,
  },
  switchText: { flex: 1, paddingRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#000000' },
  switchSub: { fontSize: 12, color: '#666666', marginTop: 2 },
  empty: { fontSize: 14, color: '#666666', textAlign: 'center', paddingVertical: 24 },
  list: { marginBottom: 8 },
  count: { fontSize: 12, color: '#8A8A8A', marginBottom: 8 },
  note: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 12,
    paddingVertical: 10, paddingLeft: 14, paddingRight: 10, marginBottom: 8,
  },
  noteText: { flex: 1, fontSize: 14, color: '#000000', lineHeight: 20, paddingRight: 8 },
  remove: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  forget: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 10 },
  forgetText: { fontSize: 14, fontWeight: '700', color: '#FF3B30' },
  paused: { fontSize: 13, color: '#666666', marginTop: 8 },
  privacy: { fontSize: 12, color: '#8A8A8A', lineHeight: 17, marginTop: 24 },
});

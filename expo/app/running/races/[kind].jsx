// app/running/races/[kind].jsx
//
// A virtual race: the Local 5K (every week) or the Worldwide 10K (every month).
// Join it, start it from here, and your time goes on the board when you cross the
// distance on the run screen (app/running/active.jsx). The rules are in
// lib/virtualRaces.js, the board and your results in store/virtualRaceStore.js, and
// what happens at the finish in services/raceBoard.js.
//
// The local board needs to know roughly where you are, to find runners near you; the
// position stays on the phone, only the coarse map squares around it are asked for.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVirtualRaceStore } from '@/store/virtualRaceStore';
import { publishMyRaces } from '@/services/raceBoard';
import {
  isRaceKind, currentRace, raceEntryId, raceDistanceText, raceSchedule, raceBlurb,
  boardRows, formatRaceTime, formatRacePace,
} from '@/lib/virtualRaces';

const NO_ENTRIES = [];

function Row({ row, units }) {
  return (
    <View style={[styles.row, row.you && styles.rowYou]} testID={`race-row-${row.uid}`}>
      <Text style={styles.rank}>{row.rank === null ? '–' : row.rank}</Text>
      {row.avatar ? (
        <Image source={{ uri: row.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarEmpty]}>
          <Text style={styles.avatarLetter}>{String(row.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.rowName}>
        <Text style={[styles.name, row.you && styles.nameYou]} numberOfLines={1}>{row.you ? `${row.name} (you)` : row.name}</Text>
        <Text style={styles.pace}>{formatRacePace(row.timeSec, row.distanceKm, units)}</Text>
      </View>
      <Text style={styles.time}>{formatRaceTime(row.timeSec)}</Text>
    </View>
  );
}

export default function RaceScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams();
  const { user } = useUserStore();
  const units = useSettingsStore((s) => s.units); // Settings > Distance Units
  const shown = useSettingsStore((s) => s.showInLeaderboards !== false); // Settings > Show in Leaderboards
  const valid = isRaceKind(kind);
  const race = useMemo(() => (valid ? currentRace(kind) : null), [valid, kind]);
  const uid = user && user.uid;
  const key = race ? raceEntryId(race.id, uid) : '';

  const joined = useVirtualRaceStore((s) => s.joined[key]);
  const finished = useVirtualRaceStore((s) => s.finished[key]);
  const board = useVirtualRaceStore((s) => (valid ? s.boards[kind] : undefined));
  const join = useVirtualRaceStore((s) => s.join);
  const leave = useVirtualRaceStore((s) => s.leave);
  const loadBoard = useVirtualRaceStore((s) => s.loadBoard);

  // Roughly where you are, for the local board: checking | ready | ask (not asked yet) | denied | error. The worldwide board needs no position.
  const [place, setPlace] = useState({ status: 'checking', position: null });
  const [refreshing, setRefreshing] = useState(false);

  const findPlace = useCallback(async (ask) => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && ask) permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPlace({ status: permission.status === 'undetermined' ? 'ask' : 'denied', position: null });
        return;
      }
      const here = (await Location.getLastKnownPositionAsync())
        || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setPlace({ status: 'ready', position: { latitude: here.coords.latitude, longitude: here.coords.longitude } });
    } catch (e) {
      setPlace({ status: 'error', position: null });
    }
  }, []);

  useEffect(() => {
    if (kind === 'local') findPlace(false);
  }, [kind, findPlace]);

  // Results that could not be posted earlier go up now.
  useEffect(() => {
    if (uid) publishMyRaces({ user });
  }, [uid]);

  // The board is read when the screen opens, when your position is found, and again
  // when you come back to it (from a run, say) so your new time is in its place.
  const reload = useCallback(() => {
    if (!race) return;
    if (race.kind === 'world') loadBoard(race);
    else if (place.status === 'ready') loadBoard(race, { position: place.position });
    else if (place.status !== 'checking') loadBoard(race, { position: null });
  }, [race, place, loadBoard]);
  useFocusEffect(reload);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (kind === 'local') await findPlace(false);
      else await loadBoard(race);
    } finally {
      setRefreshing(false);
    }
  }, [kind, race, findPlace, loadBoard]);

  if (!race) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back" testID="race-back">
            <Ionicons name="chevron-back" size={22} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Virtual Races</Text>
        </View>
        <Text style={styles.empty} testID="race-unknown">That race does not exist.</Text>
      </SafeAreaView>
    );
  }

  const isIn = !!joined || !!finished;
  const posted = !!finished && finished.posted;
  const mine = posted ? {
    uid, name: user.name || 'Zown User', avatar: user.profileImage, timeSec: finished.timeSec, distanceKm: race.distanceKm, finishedAt: finished.finishedAt,
  } : null;
  const current = board && board.raceId === race.id ? board : null;
  const rows = boardRows(current ? current.entries : NO_ENTRIES, mine, uid);
  const status = current ? current.status : 'loading';

  const start = () => router.push({ pathname: '/running/active', params: { raceKind: race.kind } });

  let boardBody;
  if (status === 'needsLocation') {
    boardBody = (
      <View style={styles.notice} testID="race-needs-location">
        <Text style={styles.noticeText}>To find runners near you, Zown needs to know roughly where you are. Your position stays on your phone.</Text>
        {place.status === 'denied' ? (
          <Pressable style={styles.smallBtn} onPress={() => Linking.openSettings()} testID="race-open-settings">
            <Text style={styles.smallBtnText}>Open Settings</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.smallBtn} onPress={() => findPlace(true)} testID="race-allow-location">
            <Text style={styles.smallBtnText}>Allow location</Text>
          </Pressable>
        )}
      </View>
    );
  } else if (status === 'error') {
    boardBody = (
      <View style={styles.notice} testID="race-board-error">
        <Text style={styles.noticeText}>Couldn't load the board. Check your signal and try again.</Text>
        <Pressable style={styles.smallBtn} onPress={onRefresh} testID="race-board-retry">
          <Text style={styles.smallBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (rows.length > 0) {
    boardBody = rows.map((row) => <Row key={row.uid} row={row} units={units} />);
  } else if (status === 'loading') {
    boardBody = <ActivityIndicator style={styles.spinner} color="#000" testID="race-board-loading" />;
  } else {
    boardBody = <Text style={styles.empty} testID="race-board-empty">No one has finished yet. Be the first.</Text>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back" testID="race-back">
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>{race.name}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={race.kind === 'local' ? 'location' : 'globe-outline'} size={26} color="#FFF" />
          </View>
          <Text style={styles.heroTitle}>{raceDistanceText(race, units)}</Text>
          <Text style={styles.heroSchedule} testID="race-schedule">{raceSchedule(race)}</Text>
          <Text style={styles.heroBlurb}>{raceBlurb(race.kind, units)}</Text>
        </View>

        {finished && (
          <View style={styles.result} testID="race-result">
            <Text style={styles.resultLabel}>Your time</Text>
            <Text style={styles.resultTime} testID="race-result-time">{formatRaceTime(finished.timeSec)}</Text>
            <Text style={styles.resultPace}>{formatRacePace(finished.timeSec, race.distanceKm, units)}</Text>
            <Text style={styles.resultState} testID="race-result-state">
              {posted ? 'On the board' : (shown ? 'Not on the board yet. It will be sent when you have a signal.' : 'Not on the board, because you are hidden from leaderboards.')}
            </Text>
          </View>
        )}

        {!uid ? (
          <Text style={styles.empty} testID="race-signin">Sign in to join the race.</Text>
        ) : (
          <View style={styles.actions}>
            {isIn ? (
              <>
                <Pressable style={styles.primary} onPress={start} testID="race-start">
                  <Ionicons name="play" size={18} color="#FFF" />
                  <Text style={styles.primaryText}>{finished ? 'Run it again' : 'Start race'}</Text>
                </Pressable>
                {!finished && (
                  <Pressable style={styles.link} onPress={() => leave(race, uid)} testID="race-leave">
                    <Text style={styles.linkText}>Leave race</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Pressable style={styles.primary} onPress={() => join(race, uid)} testID="race-join">
                <Text style={styles.primaryText}>Join race</Text>
              </Pressable>
            )}
            <Text style={styles.fineprint}>Runs only. Walks do not count. Your time is taken when you cross {race.distanceKm}K on the run screen.</Text>
          </View>
        )}

        <Text style={styles.boardTitle}>{race.kind === 'local' ? 'Fastest near you' : 'Fastest in the world'}</Text>
        <View testID="race-board">{boardBody}</View>

        <Text style={styles.privacy} testID="race-privacy">
          Your name, picture and time are shown to other Zown users. The local race uses a rough map square for where you started, never your exact location. {shown ? 'You can hide yourself in Settings under Show in Leaderboards.' : 'You are hidden from leaderboards in Settings, so your times are not posted.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  content: { paddingBottom: 100 },

  hero: { alignItems: 'center', marginHorizontal: 20, marginTop: 8, marginBottom: 20, backgroundColor: '#F5F5F5', borderRadius: 20, padding: 20 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#000' },
  heroSchedule: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 2 },
  heroBlurb: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 10, lineHeight: 19 },

  result: { alignItems: 'center', marginHorizontal: 20, marginBottom: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5E5', padding: 16 },
  resultLabel: { fontSize: 12, fontWeight: '600', color: '#999' },
  resultTime: { fontSize: 36, fontWeight: '800', color: '#000', marginTop: 2 },
  resultPace: { fontSize: 13, color: '#666', marginTop: 2 },
  resultState: { fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' },

  actions: { marginHorizontal: 20, marginBottom: 24, alignItems: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: '#000' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  link: { paddingVertical: 12 },
  linkText: { fontSize: 13, fontWeight: '600', color: '#666' },
  fineprint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10, lineHeight: 17 },

  boardTitle: { fontSize: 18, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  rowYou: { backgroundColor: '#F5F5F5' },
  rank: { width: 26, fontSize: 15, fontWeight: '800', color: '#000', textAlign: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E5E5' },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 15, fontWeight: '700', color: '#666' },
  rowName: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#000' },
  nameYou: { fontWeight: '800' },
  pace: { fontSize: 12, color: '#999', marginTop: 1 },
  time: { fontSize: 16, fontWeight: '800', color: '#000' },

  notice: { marginHorizontal: 20, backgroundColor: '#F5F5F5', borderRadius: 14, padding: 14, alignItems: 'flex-start', gap: 10 },
  noticeText: { fontSize: 13, color: '#666', lineHeight: 19 },
  smallBtn: { backgroundColor: '#000', borderRadius: 18, paddingHorizontal: 16, height: 36, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  spinner: { marginVertical: 24 },
  empty: { fontSize: 14, color: '#999', textAlign: 'center', marginHorizontal: 20, marginVertical: 24 },
  privacy: { fontSize: 11, color: '#999', lineHeight: 16, marginHorizontal: 20, marginTop: 24 },
});

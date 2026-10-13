// components/RunMusicSheet.jsx
//
// The music sheet behind "Music" in the run screen's menu: what is playing, back,
// play or pause, forward and search, for whichever of Spotify or Apple Music is
// connected, or a way to connect one. It is the same player the workout screen
// has (store/useActiveMusicPlayer.js), in the run screen's black and white.

import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActiveMusicPlayer } from '@/store/useActiveMusicPlayer';

/** How often what is playing is looked up again while the sheet is open. */
const REFRESH_MS = 15000;

function playbackMessage(error) {
  const text = error && error.message;
  if (text && text.includes('No active device')) {
    return 'Open Spotify once on this phone (or another device) so it can receive playback, then try again.';
  }
  return text || 'Could not update playback.';
}

// Runs a player action and tells the person if it fails, instead of failing quietly.
function attempt(action) {
  let result;
  try {
    result = action();
  } catch (e) {
    result = Promise.reject(e);
  }
  Promise.resolve(result).catch((e) => Alert.alert('Playback Failed', playbackMessage(e)));
}

// The hook that reads the connected player lives here, so it is only listening
// while the sheet is open.
function SheetBody({ onClose }) {
  const router = useRouter();
  const {
    isConnected, trackName, artistName, isPlaying,
    playTrack, pauseTrack, nextTrack, previousTrack, updateCurrentTrack,
  } = useActiveMusicPlayer();

  useEffect(() => {
    if (!isConnected || typeof updateCurrentTrack !== 'function') return undefined;
    const refresh = () => {
      try {
        Promise.resolve(updateCurrentTrack()).catch(() => {});
      } catch (e) {
        // Not knowing what is playing is not worth a message.
      }
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [isConnected]);

  const go = (path) => {
    onClose();
    router.push(path);
  };

  if (!isConnected) {
    return (
      <View style={styles.centered}>
        <Ionicons name="musical-notes" size={40} color="#FFF" style={styles.noteIcon} />
        <Text style={styles.connectTitle}>Connect Music</Text>
        <Text style={styles.connectText}>Connect Spotify or Apple Music to control your music during your run</Text>
        <Pressable style={styles.connectBtn} onPress={() => go('/profile/settings')} testID="run-music-connect">
          <Text style={styles.connectBtnText}>Connect</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.track} numberOfLines={1} testID="run-music-track">{trackName || 'No Track Playing'}</Text>
      <Text style={styles.artist} numberOfLines={1} testID="run-music-artist">{artistName || 'Unknown Artist'}</Text>
      <View style={styles.controls}>
        <Pressable onPress={() => go('/music-search')} accessibilityLabel="Search music" testID="run-music-search">
          <Ionicons name="search" size={22} color="#FFF" />
        </Pressable>
        <Pressable onPress={() => attempt(previousTrack)} accessibilityLabel="Previous track" testID="run-music-prev">
          <Ionicons name="play-skip-back" size={28} color="#FFF" />
        </Pressable>
        <Pressable
          style={styles.playBtn}
          onPress={() => attempt(isPlaying ? pauseTrack : playTrack)}
          accessibilityLabel={isPlaying ? 'Pause music' : 'Play music'}
          testID="run-music-toggle"
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
        </Pressable>
        <Pressable onPress={() => attempt(nextTrack)} accessibilityLabel="Next track" testID="run-music-next">
          <Ionicons name="play-skip-forward" size={28} color="#FFF" />
        </Pressable>
      </View>
    </>
  );
}

export default function RunMusicSheet({ visible, onClose }) {
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="run-music-backdrop">
        <Pressable style={styles.sheet} onPress={() => {}} testID="run-music-sheet">
          <View style={styles.grabber} />
          <SheetBody onClose={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 20 },
  track: { fontSize: 18, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  artist: { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 24 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32 },
  playBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  centered: { alignItems: 'center' },
  noteIcon: { marginBottom: 16 },
  connectTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  connectText: { fontSize: 13, color: '#999', marginBottom: 20, textAlign: 'center' },
  connectBtn: { backgroundColor: '#FFF', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  connectBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});

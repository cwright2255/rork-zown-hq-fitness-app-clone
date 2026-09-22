import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Platform, LayoutAnimation, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSpotifyStore } from '@/store/spotifyStore';

// Real, new: matches the exact, established card structure every other
// widget on this screen uses (same size/shape as Calories, Heart, etc.,
// collapsed to one headline value + tap-to-expand). Built directly on
// the existing, already fully-built store/spotifyStore.js (isConnected,
// currentTrack, playTrack/pauseTrack/nextTrack/previousTrack) rather
// than duplicating that logic - this widget is a new, independent
// display for it, not a rebuild of the existing SpotifyMusicPlayer.jsx.
//
// Real fix, alongside this: store/spotifyStore.js's updateCurrentTrack
// previously only ever stored the track item itself
// (services/spotifyService.js's getCurrentlyPlaying returned just
// response?.item), silently discarding the sibling is_playing field
// Spotify's own API also returns - meaning there was previously no way
// to know whether playback was actually playing or paused, which this
// widget's play/pause button genuinely needs. Fixed both files so
// isPlaying is real, live state now.
const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

const POLL_INTERVAL_MS = 15000;

function truncate(str, max) {
  if (!str) return str;
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

export default function MusicWidget() {
  const { isConnected, currentTrack, isPlaying, updateCurrentTrack, playTrack, pauseTrack, nextTrack, previousTrack } = useSpotifyStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isConnected) return;
    updateCurrentTrack();
    intervalRef.current = setInterval(() => updateCurrentTrack(), POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isConnected]);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((v) => !v);
  };

  const artistNames = currentTrack?.artists?.map((a) => a.name).join(', ');
  const albumArtUrl = currentTrack?.album?.images?.[0]?.url;

  const headline = currentTrack ? truncate(currentTrack.name, 14) : '\u2014';
  const unit = currentTrack ? truncate(artistNames, 16) : 'Spotify';

  return (
    <View style={[s.cardContainer, isExpanded && s.expandedCardContainer, isExpanded && { overflow: 'visible' }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggleExpand} style={s.statCard}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={s.statCardHeader}>
            <Text style={s.statLabel}>Music</Text>
            <Ionicons name="musical-notes-outline" size={20} color="#000" />
          </View>
          <Text style={s.statValue} numberOfLines={1}>{headline}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.statUnit} numberOfLines={1}>{unit}</Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#999" />
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={s.insightPanel}>
          {!isConnected ? (
            <View>
              <Text style={s.insightTitle}>Not Connected</Text>
              <Text style={s.detailStatText}>Connect Spotify to see what's playing and control it from here.</Text>
              <TouchableOpacity style={s.panelBtn} onPress={() => router.push('/profile/settings')}>
                <Text style={s.panelBtnText}>Connect Spotify</Text>
              </TouchableOpacity>
            </View>
          ) : !currentTrack ? (
            <View>
              <Text style={s.insightTitle}>Nothing Playing</Text>
              <Text style={s.detailStatText}>Search for a song to start playing it right here.</Text>
              <TouchableOpacity style={s.panelBtn} onPress={() => router.push('/music-search')}>
                <Text style={s.panelBtnText}>Search Music</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                {albumArtUrl ? (
                  <Image source={{ uri: albumArtUrl }} style={s.albumArt} />
                ) : (
                  <View style={[s.albumArt, s.albumArtPlaceholder]}>
                    <Ionicons name="musical-note" size={20} color="#999" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.insightTitle} numberOfLines={1}>{currentTrack.name}</Text>
                  <Text style={s.detailStatText} numberOfLines={1}>{artistNames}</Text>
                </View>
              </View>
              <View style={s.controlsRow}>
                <TouchableOpacity style={s.controlBtn} onPress={() => router.push('/music-search')}>
                  <Ionicons name="search" size={18} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={s.controlBtn} onPress={previousTrack}>
                  <Ionicons name="play-skip-back" size={18} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.controlBtn, s.controlBtnPrimary]}
                  onPress={() => {
                    const action = isPlaying ? pauseTrack() : playTrack();
                    action.catch((e) => {
                      const noDevice = e?.message?.includes('No active device');
                      Alert.alert(
                        'Playback Failed',
                        noDevice
                          ? 'Open Spotify once on this phone (or another device) so it can receive playback, then try again.'
                          : (e?.message || 'Could not update playback.')
                      );
                    });
                  }}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={s.controlBtn} onPress={nextTrack}>
                  <Ionicons name="play-skip-forward" size={18} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  expandedCardContainer: {
    width: width - H_PAD * 2,
    overflow: 'visible',
  },
  statCard: {
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#000' },
  statUnit: { fontSize: 12, color: '#999', marginTop: 2, flex: 1, marginRight: 8 },
  insightPanel: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
    paddingBottom: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
  },
  insightTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 6 },
  detailStatText: { fontSize: 12, color: '#444' },
  panelBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  panelBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  albumArt: { width: 48, height: 48, borderRadius: 8 },
  albumArtPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  controlBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  controlBtnPrimary: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000000' },
});

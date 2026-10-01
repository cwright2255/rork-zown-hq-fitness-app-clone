import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable, Image, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useActiveMusicPlayer } from '@/store/useActiveMusicPlayer';

const SEARCH_DEBOUNCE_MS = 400;

// Real, new: lets the user actually search for and choose a specific
// song from within the app, rather than only being able to control
// whatever's already playing from elsewhere.
//
// Real fix: this previously called spotifyService.searchTracks and
// useSpotifyStore().playTrack directly, meaning search only ever worked
// against Spotify - never Apple Music, even once that was connected. Now
// uses the shared useActiveMusicPlayer() hook, whose own searchTracks()
// and playTrack() already delegate to whichever service is genuinely
// connected and return one normalized result shape either way.
export default function MusicSearchScreen() {
  const {
    isConnected, canSearchCatalog, searchTracks, searchAlbums, playTrack, playAlbum,
    addToQueue, playNext, clearQueue, startArtistMix, queue,
  } = useActiveMusicPlayer();
  const [query, setQuery] = useState('');
  // Real, new: Songs/Albums toggle - the request was specifically "search
  // albums and play them" as a distinct capability from song search, not a
  // merged results list, so this is a simple mode switch that decides
  // which search function runs and which row renderer/action applies.
  const [searchMode, setSearchMode] = useState('songs');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const items = searchMode === 'albums' ? await searchAlbums(trimmed) : await searchTracks(trimmed);
      setResults(items);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchMode]);

  const handleSelectTrack = async (track) => {
    setStartingId(track.id);
    try {
      // Real, new: picking a song to play right now is a deliberate "start
      // fresh" action, so whatever was queued before is cleared rather
      // than silently continuing into unrelated songs afterward.
      clearQueue();
      await playTrack(track.id);
      router.back();
    } catch (e) {
      const noDevice = e?.message?.includes('No active device');
      Alert.alert(
        'Playback Failed',
        noDevice
          ? 'Open Spotify once on this phone (or another device) so it can receive playback, then try again.'
          : (e?.message || 'Could not start this track.')
      );
    } finally {
      setStartingId(null);
    }
  };

  const handleSelectAlbum = async (album) => {
    setStartingId(album.id);
    try {
      await playAlbum(album);
      router.back();
    } catch (e) {
      const noDevice = e?.message?.includes('No active device');
      Alert.alert(
        'Playback Failed',
        noDevice
          ? 'Open Spotify once on this phone (or another device) so it can receive playback, then try again.'
          : (e?.message || 'Could not start this album.')
      );
    } finally {
      setStartingId(null);
    }
  };

  // Real, new: the "..." button's action sheet for a song row - everything
  // besides "Play Now" (the row's own tap target, unchanged above) that
  // the request asked for: queue it next, queue it at the end, or start a
  // mix of more songs from this artist.
  const handleTrackActions = (track) => {
    Alert.alert(
      track.trackName,
      track.artistName,
      [
        {
          text: 'Play Next',
          onPress: () => playNext(track),
        },
        {
          text: 'Add to Queue',
          onPress: () => addToQueue(track),
        },
        {
          text: `More Like This (${track.artistName})`,
          onPress: async () => {
            const started = await startArtistMix(track.artistName);
            if (started) router.back();
            else Alert.alert('Artist Mix', `Couldn't find more songs by ${track.artistName}.`);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </Pressable>
          <Text style={s.headerTitle}>Search Music</Text>
          <View style={s.placeholder} />
        </View>
        <View style={s.emptyState}>
          <Ionicons name="musical-notes-outline" size={40} color="#CCCCCC" />
          <Text style={s.emptyStateText}>Connect Spotify or Apple Music in Settings first to search and play music.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Real, new: isConnected only means auth succeeded - it does NOT mean this
  // Apple ID can actually search/play catalog content (that needs an active
  // Apple Music subscription, checked separately via canPlayCatalogContent).
  // Without this, a subscription problem and a genuine zero-result search
  // looked identical: an empty list with no explanation either way.
  if (!canSearchCatalog) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </Pressable>
          <Text style={s.headerTitle}>Search Music</Text>
          <View style={s.placeholder} />
        </View>
        <View style={s.emptyState}>
          <Ionicons name="alert-circle-outline" size={40} color="#CCCCCC" />
          <Text style={s.emptyStateText}>This Apple ID doesn't have an active Apple Music subscription, so catalog search isn't available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </Pressable>
        <Text style={s.headerTitle}>Search Music</Text>
        <View style={s.placeholder} />
      </View>

      <View style={s.modeToggle}>
        <Pressable
          style={[s.modeBtn, searchMode === 'songs' && s.modeBtnActive]}
          onPress={() => setSearchMode('songs')}
        >
          <Text style={[s.modeBtnText, searchMode === 'songs' && s.modeBtnTextActive]}>Songs</Text>
        </Pressable>
        <Pressable
          style={[s.modeBtn, searchMode === 'albums' && s.modeBtnActive]}
          onPress={() => setSearchMode('albums')}
        >
          <Text style={[s.modeBtnText, searchMode === 'albums' && s.modeBtnTextActive]}>Albums</Text>
        </Pressable>
      </View>

      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="#666666" />
        <TextInput
          style={s.searchInput}
          placeholder={searchMode === 'albums' ? 'Album or artist' : 'Song, artist, or album'}
          placeholderTextColor="#999999"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
        />
        {isSearching && <ActivityIndicator size="small" color="#000000" />}
      </View>

      {queue.length > 0 && (
        <Text style={s.queueBanner}>
          Up next: {queue[0].trackName} {queue.length > 1 ? `+${queue.length - 1} more` : ''}
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !isSearching && query.trim() ? (
            <Text style={s.noResultsText}>No results for "{query.trim()}"</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isStarting = startingId === item.id;

          if (searchMode === 'albums') {
            return (
              <Pressable style={s.row} onPress={() => handleSelectAlbum(item)} disabled={!!startingId}>
                {item.artworkUrl ? (
                  <Image source={{ uri: item.artworkUrl }} style={s.artThumb} />
                ) : (
                  <View style={[s.artThumb, s.artThumbPlaceholder]}>
                    <Ionicons name="musical-note" size={16} color="#999" />
                  </View>
                )}
                <View style={s.rowText}>
                  <Text style={s.trackName} numberOfLines={1}>{item.albumName}</Text>
                  <Text style={s.artistName} numberOfLines={1}>
                    {item.artistName}{typeof item.trackCount === 'number' ? ` · ${item.trackCount} tracks` : ''}
                  </Text>
                </View>
                {isStarting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="play-circle" size={28} color="#000000" />
                )}
              </Pressable>
            );
          }

          return (
            <View style={s.row}>
              <Pressable style={s.rowMain} onPress={() => handleSelectTrack(item)} disabled={!!startingId}>
                {item.artworkUrl ? (
                  <Image source={{ uri: item.artworkUrl }} style={s.artThumb} />
                ) : (
                  <View style={[s.artThumb, s.artThumbPlaceholder]}>
                    <Ionicons name="musical-note" size={16} color="#999" />
                  </View>
                )}
                <View style={s.rowText}>
                  <Text style={s.trackName} numberOfLines={1}>{item.trackName}</Text>
                  <Text style={s.artistName} numberOfLines={1}>{item.artistName}</Text>
                </View>
                {isStarting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="play-circle" size={28} color="#000000" />
                )}
              </Pressable>
              <Pressable
                style={s.moreBtn}
                onPress={() => handleTrackActions(item)}
                disabled={!!startingId}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#666666" />
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000000' },
  placeholder: { width: 32 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#000000' },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#FFFFFF' },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#999999' },
  modeBtnTextActive: { color: '#000000' },
  queueBanner: {
    fontSize: 12,
    color: '#666666',
    marginHorizontal: 16,
    marginTop: 10,
  },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artThumb: { width: 46, height: 46, borderRadius: 6 },
  artThumbPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  trackName: { fontSize: 14, fontWeight: '600', color: '#000000' },
  artistName: { fontSize: 12, color: '#666666', marginTop: 2 },
  noResultsText: { fontSize: 13, color: '#999999', textAlign: 'center', marginTop: 30 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyStateText: { fontSize: 14, color: '#666666', textAlign: 'center' },
});

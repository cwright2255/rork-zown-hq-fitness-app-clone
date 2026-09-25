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
  const { isConnected, canSearchCatalog, searchTracks, playTrack } = useActiveMusicPlayer();
  const [query, setQuery] = useState('');
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
      const tracks = await searchTracks(trimmed);
      setResults(tracks);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelectTrack = async (track) => {
    setStartingId(track.id);
    try {
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

      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="#666666" />
        <TextInput
          style={s.searchInput}
          placeholder="Song, artist, or album"
          placeholderTextColor="#999999"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
        />
        {isSearching && <ActivityIndicator size="small" color="#000000" />}
      </View>

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
          return (
            <Pressable style={s.row} onPress={() => handleSelectTrack(item)} disabled={!!startingId}>
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
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
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

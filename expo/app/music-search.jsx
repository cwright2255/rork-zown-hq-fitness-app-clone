import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable, Image, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';

const SEARCH_DEBOUNCE_MS = 400;

// Real, new: lets the user actually search for and choose a specific
// song from within the app, rather than only being able to control
// whatever's already playing from elsewhere. Built directly on
// spotifyService.js's already-working searchTracks - the gap wasn't in
// the backend, it was that nothing in the app's UI ever let a user
// reach it. Selecting a result calls the same, already-built
// store/spotifyStore.js's playTrack(uri) the widget's own play button
// uses, so control immediately afterward - including from the widget
// itself, on HQ - continues to work exactly as it already does today.
export default function MusicSearchScreen() {
  const { isConnected, playTrack } = useSpotifyStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [startingUri, setStartingUri] = useState(null);
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
      const tracks = await spotifyService.searchTracks(trimmed);
      setResults(tracks);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelectTrack = async (track) => {
    setStartingUri(track.uri);
    try {
      await playTrack(track.uri);
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
      setStartingUri(null);
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
          <Text style={s.emptyStateText}>Connect Spotify in Settings first to search and play music.</Text>
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
          const artistNames = item.artists?.map((a) => a.name).join(', ');
          const artUrl = item.album?.images?.[item.album.images.length - 1]?.url;
          const isStarting = startingUri === item.uri;
          return (
            <Pressable style={s.row} onPress={() => handleSelectTrack(item)} disabled={!!startingUri}>
              {artUrl ? (
                <Image source={{ uri: artUrl }} style={s.artThumb} />
              ) : (
                <View style={[s.artThumb, s.artThumbPlaceholder]}>
                  <Ionicons name="musical-note" size={16} color="#999" />
                </View>
              )}
              <View style={s.rowText}>
                <Text style={s.trackName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.artistName} numberOfLines={1}>{artistNames}</Text>
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

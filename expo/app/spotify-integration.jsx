import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Music, Play, Pause, Settings, RefreshCw, Loader } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import SpotifyEmbedPlayer from '@/components/SpotifyEmbedPlayer';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';


export default function SpotifyIntegration() {
  const {
    isConnected,
    isClientCredentialsReady,
    user,
    disconnectSpotify,
    initializeSpotify,
    initializeClientCredentials: storeInitClientCreds
  } = useSpotifyStore();

  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);

  useEffect(() => {
    if (!isConnected && !isClientCredentialsReady) {
      void storeInitClientCreds();
    }
  }, [isClientCredentialsReady, isConnected, storeInitClientCreds]);

  useEffect(() => {
    if (isConnected || isClientCredentialsReady) {
      void loadPlaylists();
    }
  }, [isConnected, isClientCredentialsReady]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const workoutPlaylists = await spotifyService.getWorkoutPlaylists();
      setPlaylists(workoutPlaylists.slice(0, 6));
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      if (Platform.OS === 'web') {
        const success = await spotifyService.authenticateWithPopup();
        if (success) {
          await initializeSpotify();
          Alert.alert('Success', 'Connected to Spotify!');
          void loadPlaylists();
        } else {
          const clientSuccess = await storeInitClientCreds();
          if (clientSuccess) {
            Alert.alert('Connected', 'You can browse and play tracks.');
            void loadPlaylists();
          } else {
            Alert.alert('Connection Failed', 'Could not connect to Spotify.');
          }
        }
      } else {
        const clientSuccess = await storeInitClientCreds();
        if (clientSuccess) {
          void loadPlaylists();
        }
      }
    } catch (error) {
      console.error('Spotify connection error:', error);
      Alert.alert('Error', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectSpotify();
    setPlaylists([]);
    setPlaylistTracks([]);
    setSelectedPlaylist(null);
    setActiveTrack(null);
  };

  const openPlaylist = async (playlist) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      setSelectedPlaylist(playlist);
      setLoadingTracks(true);
      const tracks = await spotifyService.getPlaylistTracks(playlist.id);
      setPlaylistTracks(tracks.filter((t) => t && t.id));
    } catch (error) {
      console.error('Failed to load playlist tracks:', error);
      Alert.alert('Error', 'Failed to load playlist tracks.');
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleTrackPress = useCallback((track) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('[SpotifyIntegration] Playing track via embed:', track.name);
    setActiveTrack(track);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Music Player',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text.primary,
          headerRight: () =>
          <TouchableOpacity onPress={() => router.push('/profile/settings')}>
              <Settings size={24} color={Colors.text.primary} />
            </TouchableOpacity>

        }} />
      

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Card variant="elevated" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, (isConnected || isClientCredentialsReady) && styles.statusDotActive]} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isConnected ? 'Connected to Spotify' : isClientCredentialsReady ? 'Ready to Play' : 'Not Connected'}
              </Text>
              {user ?
              <Text style={styles.statusSubtitle}>{user.display_name || user.id}</Text> :
              isClientCredentialsReady ?
              <Text style={styles.statusSubtitle}>Play tracks directly in-app</Text> :
              null}
            </View>
            <Music size={24} color={isConnected || isClientCredentialsReady ? '#1DB954' : Colors.text.tertiary} />
          </View>

          <View style={styles.statusActions}>
            {isConnected || isClientCredentialsReady ?
            <View style={styles.buttonRow}>
                <Button
                title="Refresh"
                onPress={handleConnect}
                variant="outline"
                style={styles.actionButton}
                disabled={loading}
                leftIcon={<RefreshCw size={16} color={Colors.primary} />}
                testID="reconnect-spotify-button" />
              
                <Button
                title="Disconnect"
                onPress={handleDisconnect}
                variant="outline"
                style={[styles.actionButton, styles.disconnectButton]}
                testID="disconnect-spotify-button" />
              
              </View> :

            <Button
              title={loading ? 'Connecting...' : 'Connect to Spotify'}
              onPress={handleConnect}
              leftIcon={<Music size={16} color={Colors.text.inverse} />}
              style={[styles.actionButton, styles.connectBtn]}
              disabled={loading}
              testID="connect-spotify-button" />

            }
          </View>
        </Card>

        {activeTrack &&
        <SpotifyEmbedPlayer
          trackId={activeTrack.id}
          trackName={activeTrack.name}
          artistName={activeTrack.artists.map((a) => a.name).join(', ')}
          onClose={() => setActiveTrack(null)}
          compact={false} />

        }

        {selectedPlaylist &&
        <Card variant="elevated" style={styles.playlistDetailCard}>
            <View style={styles.playlistDetailHeader}>
              <TouchableOpacity onPress={() => {setSelectedPlaylist(null);setPlaylistTracks([]);}}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.playlistDetailTitle} numberOfLines={1}>{selectedPlaylist.name}</Text>
            </View>

            {loadingTracks ?
          <View style={styles.loadingContainer}>
                <Loader size={20} color={Colors.text.tertiary} />
                <Text style={styles.loadingText}>Loading tracks...</Text>
              </View> :
          playlistTracks.length > 0 ?
          <View style={styles.tracksList}>
                {playlistTracks.slice(0, 20).map((track, index) => {
              const isActive = activeTrack?.id === track.id;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.trackItem, isActive && styles.trackItemActive]}
                  onPress={() => handleTrackPress(track)}
                  activeOpacity={0.7}>
                  
                      <Text style={[styles.trackNum, isActive && styles.trackNumActive]}>{index + 1}</Text>
                      {track.album?.images?.[0] &&
                  <Image source={{ uri: track.album.images[0].url }} style={styles.trackArt} />
                  }
                      <View style={styles.trackInfo}>
                        <Text style={[styles.trackTitle, isActive && styles.trackTitleActive]} numberOfLines={1}>
                          {track.name}
                        </Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                          {track.artists.map((a) => a.name).join(', ')}
                        </Text>
                      </View>
                      <View style={[styles.trackPlayIcon, isActive && styles.trackPlayIconActive]}>
                        {isActive ?
                    <Pause size={12} color="#fff" /> :

                    <Play size={12} color={Colors.text.primary} style={{ marginLeft: 1 }} />
                    }
                      </View>
                    </TouchableOpacity>);

            })}
              </View> :

          <Text style={styles.noTracksText}>No tracks found in this playlist.</Text>
          }
          </Card>
        }

        {!selectedPlaylist && (isConnected || isClientCredentialsReady) &&
        <Card variant="elevated" style={styles.playlistsCard}>
            <View style={styles.playlistsHeader}>
              <Text style={styles.playlistsTitle}>Workout Playlists</Text>
              <Button
              title="Refresh"
              onPress={loadPlaylists}
              variant="outline"
              size="small"
              disabled={loading} />
            
            </View>

            {loading ?
          <View style={styles.loadingContainer}>
                <Loader size={20} color={Colors.text.tertiary} />
                <Text style={styles.loadingText}>Loading playlists...</Text>
              </View> :
          playlists.length > 0 ?
          <View style={styles.playlistGrid}>
                {playlists.map((playlist) =>
            <TouchableOpacity
              key={playlist.id}
              style={styles.playlistCard}
              onPress={() => openPlaylist(playlist)}
              activeOpacity={0.75}>
              
                    {playlist.images?.[0] ?
              <Image source={{ uri: playlist.images[0].url }} style={styles.playlistImage} /> :

              <View style={styles.playlistImagePlaceholder}>
                        <Music size={24} color={Colors.text.tertiary} />
                      </View>
              }
                    <Text style={styles.playlistName} numberOfLines={2}>{playlist.name}</Text>
                    <Text style={styles.playlistTrackCount}>{playlist.tracks?.total || 0} tracks</Text>
                  </TouchableOpacity>
            )}
              </View> :

          <Text style={styles.noPlaylistsText}>No workout playlists found.</Text>
          }
          </Card>
        }

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  statusCard: {
    marginBottom: 16
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.inactive,
    marginRight: 12
  },
  statusDotActive: {
    backgroundColor: '#1DB954'
  },
  statusInfo: {
    flex: 1
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary
  },
  statusSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2
  },
  statusActions: {
    alignItems: 'flex-start'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8
  },
  disconnectButton: {
    borderColor: '#ef4444'
  },
  actionButton: {
    paddingHorizontal: 20
  },
  connectBtn: {
    backgroundColor: '#1DB954',
    borderRadius: 24
  },
  playlistDetailCard: {
    marginBottom: 16
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12
  },
  backText: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '600'
  },
  playlistDetailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary
  },
  tracksList: {
    gap: 2
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8
  },
  trackItemActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.08)'
  },
  trackNum: {
    width: 22,
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  trackNumActive: {
    color: '#1DB954',
    fontWeight: '700'
  },
  trackArt: {
    width: 38,
    height: 38,
    borderRadius: 5,
    marginLeft: 8,
    marginRight: 10
  },
  trackInfo: {
    flex: 1
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 1
  },
  trackTitleActive: {
    color: '#1DB954'
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.text.secondary
  },
  trackPlayIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  trackPlayIconActive: {
    backgroundColor: '#1DB954'
  },
  noTracksText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 20
  },
  playlistsCard: {
    marginBottom: 16
  },
  playlistsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  playlistsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary
  },
  playlistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  playlistCard: {
    width: '47%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    overflow: 'hidden'
  },
  playlistImage: {
    width: '100%',
    aspectRatio: 1
  },
  playlistImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  playlistName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    paddingHorizontal: 10,
    paddingTop: 8
  },
  playlistTrackCount: {
    fontSize: 11,
    color: Colors.text.secondary,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 2
  },
  noPlaylistsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic'
  }
});
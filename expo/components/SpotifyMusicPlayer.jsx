import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Animated, Platform } from 'react-native';
import { Play, Pause, Music, Volume2, Loader, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import SpotifyEmbedPlayer from '@/components/SpotifyEmbedPlayer';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import { tokens } from '../../theme/tokens';


export default function SpotifyMusicPlayer({ workoutType = 'cardio', style }) {
  const {
    isConnected,
    isClientCredentialsReady,
    getRecommendationsForWorkout,
    isLoading,
    initializeClientCredentials,
    initializeSpotify
  } = useSpotifyStore();

  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);
  const [showTrackList, setShowTrackList] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const hasApiAccess = isConnected || isClientCredentialsReady;

  useEffect(() => {
    if (activeTrack) {
      const pulse = Animated.loop(
        Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })]
        )
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [activeTrack, pulseAnim]);

  const loadRecommendations = useCallback(async () => {
    if (!hasApiAccess) {
      console.log('[SpotifyMusicPlayer] No API access, trying to initialize...');
      const success = await initializeClientCredentials();
      if (!success) {
        console.log('[SpotifyMusicPlayer] Could not initialize client credentials');
        return;
      }
    }
    setIsLoadingRecommendations(true);
    try {
      console.log('[SpotifyMusicPlayer] Fetching fresh recommendations for:', workoutType);
      const tracks = await getRecommendationsForWorkout(workoutType);
      setRecommendations(tracks.slice(0, 15));
      console.log('[SpotifyMusicPlayer] Loaded', tracks.length, 'tracks');
    } catch (error) {
      console.error('[SpotifyMusicPlayer] Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [hasApiAccess, workoutType, getRecommendationsForWorkout, initializeClientCredentials]);

  useEffect(() => {
    if (hasApiAccess) {
      loadRecommendations();
    }
  }, [hasApiAccess, workoutType, loadRecommendations]);

  const handleTrackPress = useCallback((track) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('[SpotifyMusicPlayer] Playing track via embed:', track.name);
    setActiveTrack(track);
  }, []);

  const handleCloseEmbed = useCallback(() => {
    setActiveTrack(null);
  }, []);

  const handleConnectSpotify = async () => {
    try {
      if (Platform.OS === 'web') {
        const success = await spotifyService.authenticateWithPopup();
        if (success) {
          await initializeSpotify();
          Alert.alert('Success', 'Connected to Spotify!');
          loadRecommendations();
        } else {
          const clientSuccess = await initializeClientCredentials();
          if (clientSuccess) {
            loadRecommendations();
          } else {
            Alert.alert('Connection Failed', 'Could not connect to Spotify.');
          }
        }
      } else {
        const clientSuccess = await initializeClientCredentials();
        if (clientSuccess) {
          loadRecommendations();
        }
      }
    } catch (error) {
      console.error('[SpotifyMusicPlayer] Connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Spotify.');
    }
  };

  const handlePlayFirst = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (recommendations.length > 0) {
      setActiveTrack(recommendations[0]);
    }
  }, [recommendations]);

  const handleNextTrack = useCallback(() => {
    if (!activeTrack || recommendations.length === 0) return;
    const currentIndex = recommendations.findIndex((t) => t.id === activeTrack.id);
    const nextIndex = (currentIndex + 1) % recommendations.length;
    setActiveTrack(recommendations[nextIndex]);
  }, [activeTrack, recommendations]);

  if (!hasApiAccess) {
    return (
      <Card variant="outlined" style={[styles.container, style]}>
        <View style={styles.disconnectedContainer}>
          <View style={styles.iconCircle}>
            <Music size={28} color="#1DB954" />
          </View>
          <Text style={styles.disconnectedTitle}>Music Player</Text>
          <Text style={styles.disconnectedText}>
            Connect to Spotify to play music during your workout
          </Text>
          <Button
            title="Connect Spotify"
            onPress={handleConnectSpotify}
            loading={isLoading}
            style={styles.connectButton}
            leftIcon={<Music size={16} color={Colors.text.inverse} />}
            testID="connect-spotify-button" />
          
        </View>
      </Card>);

  }

  return (
    <View style={[styles.container, style]}>
      {activeTrack &&
      <SpotifyEmbedPlayer
        trackId={activeTrack.id}
        trackName={activeTrack.name}
        artistName={activeTrack.artists.map((a) => a.name).join(', ')}
        onClose={handleCloseEmbed}
        compact={false} />

      }

      {!activeTrack && !isLoadingRecommendations && recommendations.length > 0 &&
      <TouchableOpacity
        style={styles.quickPlayBanner}
        onPress={handlePlayFirst}
        activeOpacity={0.8}>
        
          <Volume2 size={18} color="#1DB954" />
          <Text style={styles.quickPlayText}>
            Tap to play ({recommendations.length} tracks)
          </Text>
          <Play size={16} color="#1DB954" />
        </TouchableOpacity>
      }

      <View style={styles.recommendationsContainer}>
        <View style={styles.recommendationsHeader}>
          <Text style={styles.recommendationsTitle}>
            {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Mix
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={loadRecommendations} disabled={isLoadingRecommendations} style={styles.refreshBtn}>
              <RefreshCw size={14} color="#1DB954" />
              <Text style={styles.refreshText}>
                {isLoadingRecommendations ? 'Loading...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
            {recommendations.length > 0 &&
            <TouchableOpacity
              style={styles.toggleListBtn}
              onPress={() => setShowTrackList(!showTrackList)}>
              
                {showTrackList ?
              <ChevronUp size={18} color={Colors.text.secondary} /> :

              <ChevronDown size={18} color={Colors.text.secondary} />
              }
              </TouchableOpacity>
            }
          </View>
        </View>

        {isLoadingRecommendations ?
        <View style={styles.loadingContainer}>
            <Loader size={20} color={Colors.text.tertiary} />
            <Text style={styles.loadingText}>Finding tracks...</Text>
          </View> :
        recommendations.length > 0 && showTrackList ?
        <>
            {recommendations.map((track, index) => {
            const isActive = activeTrack?.id === track.id;
            return (
              <TouchableOpacity
                key={track.id}
                style={[
                styles.trackItem,
                isActive && styles.trackItemActive]
                }
                onPress={() => handleTrackPress(track)}
                activeOpacity={0.7}>
                
                  <View style={styles.trackIndex}>
                    {isActive ?
                  <Animated.View style={[styles.equalizerContainer, { transform: [{ scale: pulseAnim }] }]}>
                        <View style={[styles.eqBar, styles.eqBar1]} />
                        <View style={[styles.eqBar, styles.eqBar2]} />
                        <View style={[styles.eqBar, styles.eqBar3]} />
                      </Animated.View> :

                  <Text style={styles.trackNumber}>
                        {index + 1}
                      </Text>
                  }
                  </View>

                  {track.album?.images?.[0] ?
                <Image
                  source={{ uri: track.album.images[0].url }}
                  style={[styles.trackAlbumArt, isActive && styles.trackAlbumArtActive]} /> :


                <View style={[styles.trackAlbumArt, styles.trackAlbumArtPlaceholder]}>
                      <Music size={16} color={Colors.text.tertiary} />
                    </View>
                }

                  <View style={styles.trackDetails}>
                    <Text
                    style={[styles.trackItemName, isActive && styles.trackItemNameActive]}
                    numberOfLines={1}>
                    
                      {track.name}
                    </Text>
                    <Text style={styles.trackItemArtist} numberOfLines={1}>
                      {track.artists.map((a) => a.name).join(', ')}
                    </Text>
                  </View>

                  <TouchableOpacity
                  style={[styles.trackPlayBtn, isActive && styles.trackPlayBtnActive]}
                  onPress={() => handleTrackPress(track)}>
                  
                    {isActive ?
                  <Pause size={14} color=tokens.colors.background.default /> :

                  <Play size={14} color={Colors.text.primary} style={{ marginLeft: 1 }} />
                  }
                  </TouchableOpacity>
                </TouchableOpacity>);

          })}
          </> :
        recommendations.length === 0 ?
        <View style={styles.emptyContainer}>
            <Music size={24} color={Colors.text.tertiary} />
            <Text style={styles.noTracksText}>No tracks found. Tap Refresh to try again.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadRecommendations}>
              <RefreshCw size={14} color="#1DB954" />
              <Text style={styles.retryText}>Refresh</Text>
            </TouchableOpacity>
          </View> :
        null}
      </View>
    </View>);

}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16
  },
  disconnectedContainer: {
    alignItems: 'center',
    padding: 28
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  disconnectedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6
  },
  disconnectedText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20
  },
  connectButton: {
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingHorizontal: 28
  },
  quickPlayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.15)'
  },
  quickPlayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1DB954'
  },
  recommendationsContainer: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  refreshText: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '600'
  },
  toggleListBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center'
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
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 2
  },
  trackItemActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.08)'
  },
  trackIndex: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackNumber: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontWeight: '500',
    fontVariant: ['tabular-nums']
  },
  equalizerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 14,
    gap: 2
  },
  eqBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#1DB954'
  },
  eqBar1: {
    height: 8
  },
  eqBar2: {
    height: 14
  },
  eqBar3: {
    height: 6
  },
  trackAlbumArt: {
    width: 42,
    height: 42,
    borderRadius: 6,
    marginLeft: 10,
    marginRight: 12
  },
  trackAlbumArtActive: {
    borderWidth: 1.5,
    borderColor: '#1DB954'
  },
  trackDetails: {
    flex: 1
  },
  trackItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2
  },
  trackItemNameActive: {
    color: '#1DB954'
  },
  trackItemArtist: {
    fontSize: 12,
    color: Colors.text.secondary
  },
  trackAlbumArtPlaceholder: {
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  trackPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  trackPlayBtnActive: {
    backgroundColor: '#1DB954'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10
  },
  noTracksText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center'
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(29, 185, 84, 0.1)'
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1DB954'
  }
});
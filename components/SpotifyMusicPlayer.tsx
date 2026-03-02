import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Animated, Platform } from 'react-native';
import { Play, Pause, SkipForward, SkipBack, Music, Volume2, Disc3, Loader } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import { audioPlayer, AudioTrack, PlaybackInfo } from '@/services/audioPlayerService';
import { SpotifyTrack, SpotifyArtist, WorkoutType } from '@/types/spotify';

interface SpotifyMusicPlayerProps {
  workoutType?: WorkoutType;
  style?: object;
}

function spotifyTrackToAudioTrack(track: SpotifyTrack): AudioTrack {
  return {
    id: track.id,
    name: track.name,
    artistName: track.artists.map((a: SpotifyArtist) => a.name).join(', '),
    albumArt: track.album?.images?.[0]?.url,
    previewUrl: track.preview_url || '',
    durationMs: track.duration_ms || 30000,
    uri: track.uri,
  };
}

export default function SpotifyMusicPlayer({ workoutType = 'cardio', style }: SpotifyMusicPlayerProps) {
  const {
    isConnected,
    isClientCredentialsReady,
    getRecommendationsForWorkout,
    getSpotifyAuthUrl,
    isLoading,
    initializeClientCredentials,
    initializeSpotify,
  } = useSpotifyStore();

  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [playback, setPlayback] = useState<PlaybackInfo>(audioPlayer.getPlaybackInfo());
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const hasApiAccess = isConnected || isClientCredentialsReady;

  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe((info) => {
      setPlayback(info);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (playback.isPlaying) {
      spinAnimRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      spinAnimRef.current.start();
    } else {
      if (spinAnimRef.current) {
        spinAnimRef.current.stop();
        spinAnimRef.current = null;
      }
    }
  }, [playback.isPlaying, spinAnim]);

  useEffect(() => {
    if (playback.durationMs > 0) {
      const progress = playback.positionMs / playback.durationMs;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [playback.positionMs, playback.durationMs, progressAnim]);

  const loadRecommendations = useCallback(async () => {
    if (!hasApiAccess) return;
    setIsLoadingRecommendations(true);
    try {
      const tracks = await getRecommendationsForWorkout(workoutType);
      setRecommendations(tracks.slice(0, 8));
      console.log('[SpotifyMusicPlayer] Loaded', tracks.length, 'recommendations');
    } catch (error) {
      console.error('[SpotifyMusicPlayer] Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [hasApiAccess, workoutType, getRecommendationsForWorkout]);

  useEffect(() => {
    if (hasApiAccess) {
      loadRecommendations();
    }
  }, [hasApiAccess, workoutType, loadRecommendations]);

  const handleTrackPress = useCallback(async (track: SpotifyTrack, index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (!track.preview_url) {
      Alert.alert('Preview Unavailable', 'This track doesn\'t have a preview available.');
      return;
    }

    const audioTracks = recommendations
      .filter((t) => !!t.preview_url)
      .map(spotifyTrackToAudioTrack);

    const queueIndex = audioTracks.findIndex((t) => t.id === track.id);
    audioPlayer.setQueue(audioTracks, queueIndex >= 0 ? queueIndex : 0);
    await audioPlayer.loadAndPlay(spotifyTrackToAudioTrack(track));
  }, [recommendations]);

  const handlePlayPause = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (playback.isLoaded) {
      await audioPlayer.togglePlayPause();
    } else if (recommendations.length > 0) {
      const playable = recommendations.find((t) => !!t.preview_url);
      if (playable) {
        const audioTracks = recommendations.filter((t) => !!t.preview_url).map(spotifyTrackToAudioTrack);
        audioPlayer.setQueue(audioTracks, 0);
        await audioPlayer.loadAndPlay(audioTracks[0]);
      }
    }
  }, [playback.isLoaded, recommendations]);

  const handleNext = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await audioPlayer.playNext();
  }, []);

  const handlePrevious = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await audioPlayer.playPrevious();
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

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

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
            testID="connect-spotify-button"
          />
        </View>
      </Card>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {playback.currentTrack && (
        <View style={styles.nowPlayingCard}>
          <View style={styles.nowPlayingBg}>
            <View style={styles.nowPlayingContent}>
              <View style={styles.albumArtContainer}>
                {playback.currentTrack.albumArt ? (
                  <Animated.View style={[styles.discWrapper, { transform: [{ rotate: spinInterpolate }] }]}>
                    <Image
                      source={{ uri: playback.currentTrack.albumArt }}
                      style={styles.albumArt}
                    />
                    <View style={styles.discHole} />
                  </Animated.View>
                ) : (
                  <View style={styles.albumArtPlaceholder}>
                    <Disc3 size={32} color={Colors.text.tertiary} />
                  </View>
                )}
              </View>

              <View style={styles.trackInfo}>
                <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
                <Text style={styles.trackName} numberOfLines={1}>
                  {playback.currentTrack.name}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  {playback.currentTrack.artistName}
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(playback.positionMs)}</Text>
                <Text style={styles.timeText}>{formatTime(playback.durationMs)}</Text>
              </View>
            </View>

            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handlePrevious}
                activeOpacity={0.7}
                testID="prev-track-button"
              >
                <SkipBack size={20} color={Colors.text.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
                activeOpacity={0.8}
                testID="play-pause-button"
              >
                {playback.isBuffering ? (
                  <Loader size={24} color="#fff" />
                ) : playback.isPlaying ? (
                  <Pause size={24} color="#fff" />
                ) : (
                  <Play size={24} color="#fff" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleNext}
                activeOpacity={0.7}
                testID="next-track-button"
              >
                <SkipForward size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {!playback.currentTrack && !isLoadingRecommendations && recommendations.length > 0 && (
        <TouchableOpacity
          style={styles.quickPlayBanner}
          onPress={handlePlayPause}
          activeOpacity={0.8}
        >
          <Volume2 size={18} color="#1DB954" />
          <Text style={styles.quickPlayText}>Tap to start workout music</Text>
          <Play size={16} color="#1DB954" />
        </TouchableOpacity>
      )}

      <View style={styles.recommendationsContainer}>
        <View style={styles.recommendationsHeader}>
          <Text style={styles.recommendationsTitle}>
            {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Mix
          </Text>
          <TouchableOpacity onPress={loadRecommendations} disabled={isLoadingRecommendations}>
            <Text style={styles.refreshText}>
              {isLoadingRecommendations ? 'Loading...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoadingRecommendations ? (
          <View style={styles.loadingContainer}>
            <Loader size={20} color={Colors.text.tertiary} />
            <Text style={styles.loadingText}>Finding tracks...</Text>
          </View>
        ) : recommendations.length > 0 ? (
          recommendations.map((track, index) => {
            const isActive = audioPlayer.isCurrentTrack(track.id);
            const hasPreview = !!track.preview_url;
            return (
              <TouchableOpacity
                key={track.id}
                style={[
                  styles.trackItem,
                  isActive && styles.trackItemActive,
                  !hasPreview && styles.trackItemDisabled,
                ]}
                onPress={() => handleTrackPress(track, index)}
                activeOpacity={hasPreview ? 0.7 : 1}
                disabled={!hasPreview}
              >
                <View style={styles.trackIndex}>
                  {isActive && playback.isPlaying ? (
                    <View style={styles.equalizerContainer}>
                      <View style={[styles.eqBar, styles.eqBar1]} />
                      <View style={[styles.eqBar, styles.eqBar2]} />
                      <View style={[styles.eqBar, styles.eqBar3]} />
                    </View>
                  ) : (
                    <Text style={[styles.trackNumber, isActive && styles.trackNumberActive]}>
                      {index + 1}
                    </Text>
                  )}
                </View>

                {track.album?.images?.[0] && (
                  <Image
                    source={{ uri: track.album.images[0].url }}
                    style={[styles.trackAlbumArt, isActive && styles.trackAlbumArtActive]}
                  />
                )}

                <View style={styles.trackDetails}>
                  <Text
                    style={[styles.trackItemName, isActive && styles.trackItemNameActive]}
                    numberOfLines={1}
                  >
                    {track.name}
                  </Text>
                  <Text style={styles.trackItemArtist} numberOfLines={1}>
                    {track.artists.map((a: SpotifyArtist) => a.name).join(', ')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.trackPlayBtn, isActive && styles.trackPlayBtnActive]}
                  onPress={() => {
                    if (isActive) {
                      audioPlayer.togglePlayPause();
                    } else {
                      handleTrackPress(track, index);
                    }
                  }}
                  disabled={!hasPreview}
                >
                  {!hasPreview ? (
                    <Music size={14} color={Colors.text.tertiary} />
                  ) : isActive && playback.isPlaying ? (
                    <Pause size={14} color="#fff" />
                  ) : (
                    <Play size={14} color={isActive ? '#fff' : Colors.text.primary} style={{ marginLeft: 1 }} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Music size={24} color={Colors.text.tertiary} />
            <Text style={styles.noTracksText}>No tracks available. Try refreshing.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  disconnectedContainer: {
    alignItems: 'center',
    padding: 28,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  disconnectedTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  disconnectedText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingHorizontal: 28,
  },
  nowPlayingCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nowPlayingBg: {
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 16,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  albumArtContainer: {
    marginRight: 16,
  },
  discWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArt: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  discHole: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111',
  },
  albumArtPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  nowPlayingLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#1DB954',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  trackName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 2,
  },
  artistName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontVariant: ['tabular-nums'] as const,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderColor: 'rgba(29, 185, 84, 0.15)',
  },
  quickPlayText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1DB954',
  },
  recommendationsContainer: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  refreshText: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  trackItemActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.06)',
  },
  trackItemDisabled: {
    opacity: 0.45,
  },
  trackIndex: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackNumber: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontWeight: '500' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  trackNumberActive: {
    color: '#1DB954',
  },
  equalizerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 14,
    gap: 2,
  },
  eqBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#1DB954',
  },
  eqBar1: {
    height: 8,
  },
  eqBar2: {
    height: 14,
  },
  eqBar3: {
    height: 6,
  },
  trackAlbumArt: {
    width: 42,
    height: 42,
    borderRadius: 6,
    marginLeft: 10,
    marginRight: 12,
  },
  trackAlbumArtActive: {
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  trackDetails: {
    flex: 1,
  },
  trackItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  trackItemNameActive: {
    color: '#1DB954',
  },
  trackItemArtist: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  trackPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  trackPlayBtnActive: {
    backgroundColor: '#1DB954',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  noTracksText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});

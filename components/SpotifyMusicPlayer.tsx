import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Linking, Platform } from 'react-native';
import { Play, Pause, SkipForward, SkipBack, Music, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import { SpotifyTrack, SpotifyArtist, WorkoutType } from '@/types/spotify';

interface SpotifyMusicPlayerProps {
  workoutType?: WorkoutType;
  style?: object;
}

export default function SpotifyMusicPlayer({ workoutType = 'cardio', style }: SpotifyMusicPlayerProps) {
  const {
    isConnected,
    isClientCredentialsReady,
    currentTrack,
    playTrack,
    pauseTrack,
    nextTrack,
    previousTrack,
    updateCurrentTrack,
    getRecommendationsForWorkout,
    getSpotifyAuthUrl,
    connectSpotifyImplicit,
    isLoading,
    initializeClientCredentials,
    initializeSpotify,
  } = useSpotifyStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  const hasApiAccess = isConnected || isClientCredentialsReady;
  
  const loadRecommendations = useCallback(async () => {
    if (!hasApiAccess) return;
    
    setIsLoadingRecommendations(true);
    try {
      const tracks = await getRecommendationsForWorkout(workoutType);
      setRecommendations(tracks.slice(0, 5));
      console.log('SpotifyMusicPlayer: Loaded', tracks.length, 'recommendations');
    } catch (error) {
      console.error('SpotifyMusicPlayer: Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [hasApiAccess, workoutType, getRecommendationsForWorkout]);
  
  useEffect(() => {
    if (hasApiAccess) {
      loadRecommendations();
      
      if (isConnected) {
        updateCurrentTrack();
        const interval = setInterval(() => {
          updateCurrentTrack();
        }, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [hasApiAccess, isConnected, workoutType, updateCurrentTrack, loadRecommendations]);
  
  const handlePlayPause = async () => {
    if (!isConnected) {
      Alert.alert('Spotify Premium Required', 'Playback control requires a connected Spotify Premium account. Tracks will open in Spotify instead.');
      return;
    }
    
    try {
      if (isPlaying) {
        await pauseTrack();
        setIsPlaying(false);
      } else {
        if (currentTrack) {
          await playTrack(currentTrack.uri);
        } else if (recommendations.length > 0) {
          await playTrack(recommendations[0].uri);
        }
        setIsPlaying(true);
      }
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to control playback. Make sure Spotify is open and you have Premium.');
    }
  };
  
  const handleNext = async () => {
    if (!isConnected) return;
    try {
      await nextTrack();
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to skip track.');
    }
  };
  
  const handlePrevious = async () => {
    if (!isConnected) return;
    try {
      await previousTrack();
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to go to previous track.');
    }
  };
  
  const handleTrackPress = async (track: SpotifyTrack) => {
    if (isConnected) {
      try {
        await playTrack(track.uri);
        setIsPlaying(true);
      } catch (error) {
        openTrackInSpotify(track);
      }
    } else {
      openTrackInSpotify(track);
    }
  };

  const openTrackInSpotify = (track: SpotifyTrack) => {
    if (track.external_urls?.spotify) {
      Linking.openURL(track.external_urls.spotify);
    }
  };
  
  const handleConnectSpotify = async () => {
    try {
      if (Platform.OS === 'web') {
        console.log('SpotifyMusicPlayer: Starting popup auth...');
        const success = await spotifyService.authenticateWithPopup();
        console.log('SpotifyMusicPlayer: Popup auth result:', success);
        
        if (success) {
          await initializeSpotify();
          Alert.alert('Success', 'Connected to Spotify!');
          loadRecommendations();
        } else {
          console.log('SpotifyMusicPlayer: Falling back to client credentials...');
          const clientSuccess = await initializeClientCredentials();
          if (clientSuccess) {
            loadRecommendations();
            Alert.alert('Connected', 'You can browse music and get recommendations. Tap a track to open it in Spotify.');
          } else {
            Alert.alert('Connection Failed', 'Could not connect to Spotify. Please check your settings.');
          }
        }
      } else {
        const authUrl = await getSpotifyAuthUrl();
        const supported = await Linking.canOpenURL(authUrl);
        if (supported) {
          await Linking.openURL(authUrl);
        } else {
          Alert.alert('Error', 'Unable to open Spotify authorization');
        }
      }
    } catch (error) {
      console.error('SpotifyMusicPlayer: Connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Spotify. Please try again.');
    }
  };
  
  if (!hasApiAccess) {
    return (
      <Card variant="outlined" style={[styles.container, style]}>
        <View style={styles.disconnectedContainer}>
          <Music size={32} color={Colors.text.tertiary} />
          <Text style={styles.disconnectedTitle}>Connect Spotify</Text>
          <Text style={styles.disconnectedText}>
            Connect your Spotify account to play music during workouts
          </Text>
          <Button
            title="Connect Spotify"
            onPress={handleConnectSpotify}
            loading={isLoading}
            style={styles.connectButton}
            leftIcon={<ExternalLink size={16} color={Colors.text.inverse} />}
          />
        </View>
      </Card>
    );
  }
  
  return (
    <Card variant="elevated" style={[styles.container, style]}>
      {isConnected && currentTrack && (
        <View style={styles.currentTrackContainer}>
          <View style={styles.currentTrackInfo}>
            {currentTrack.album.images[0] && (
              <Image
                source={{ uri: currentTrack.album.images[0].url }}
                style={styles.albumArt}
              />
            )}
            
            <View style={styles.trackDetails}>
              <Text style={styles.trackName} numberOfLines={1}>
                {currentTrack.name}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {currentTrack.artists.map((artist: SpotifyArtist) => artist.name).join(', ')}
              </Text>
            </View>
          </View>
          
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handlePrevious}
            >
              <SkipBack size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={handlePlayPause}
            >
              {isPlaying ? (
                <Pause size={24} color={Colors.text.inverse} />
              ) : (
                <Play size={24} color={Colors.text.inverse} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleNext}
            >
              <SkipForward size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isConnected && isClientCredentialsReady && (
        <View style={styles.clientCredsBanner}>
          <Music size={16} color="#1DB954" />
          <Text style={styles.clientCredsBannerText}>
            Tap any track to open in Spotify
          </Text>
        </View>
      )}
      
      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>
          Recommended for {workoutType} workout
        </Text>
        
        {isLoadingRecommendations ? (
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        ) : recommendations.length > 0 ? (
          recommendations.map((track) => (
            <TouchableOpacity
              key={track.id}
              style={styles.recommendationItem}
              onPress={() => handleTrackPress(track)}
            >
              {track.album.images[0] && (
                <Image
                  source={{ uri: track.album.images[0].url }}
                  style={styles.recommendationAlbumArt}
                />
              )}
              
              <View style={styles.recommendationDetails}>
                <Text style={styles.recommendationName} numberOfLines={1}>
                  {track.name}
                </Text>
                <Text style={styles.recommendationArtist} numberOfLines={1}>
                  {track.artists.map((artist: SpotifyArtist) => artist.name).join(', ')}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.playRecommendationButton}
                onPress={() => handleTrackPress(track)}
              >
                {isConnected ? (
                  <Play size={16} color={Colors.primary} />
                ) : (
                  <ExternalLink size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noRecommendationsText}>
            No recommendations available. Try refreshing.
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  disconnectedContainer: {
    alignItems: 'center',
    padding: 24,
  },
  disconnectedTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 12,
    marginBottom: 8,
  },
  disconnectedText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  connectButton: {
    marginTop: 8,
  },
  clientCredsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  clientCredsBannerText: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '500' as const,
  },
  currentTrackContainer: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  currentTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  trackDetails: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  recommendationsContainer: {},
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    padding: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  recommendationAlbumArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  recommendationDetails: {
    flex: 1,
  },
  recommendationName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  recommendationArtist: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  playRecommendationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecommendationsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    padding: 16,
  },
});

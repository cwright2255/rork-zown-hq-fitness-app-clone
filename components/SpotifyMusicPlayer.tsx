import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Linking, Platform } from 'react-native';
import { Play, Pause, SkipForward, SkipBack, Music, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSpotifyStore } from '@/store/spotifyStore';
import { SpotifyTrack } from '@/types/spotify';

interface SpotifyMusicPlayerProps {
  workoutType?: 'cardio' | 'strength' | 'yoga' | 'running';
  style?: any;
}

export default function SpotifyMusicPlayer({ workoutType = 'cardio', style }: SpotifyMusicPlayerProps) {
  const {
    isConnected,
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
  } = useSpotifyStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  
  useEffect(() => {
    if (isConnected) {
      updateCurrentTrack();
      loadRecommendations();
      
      // Update current track every 30 seconds
      const interval = setInterval(() => {
        updateCurrentTrack();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected, workoutType, updateCurrentTrack]);
  
  const loadRecommendations = async () => {
    if (!isConnected) return;
    
    setIsLoadingRecommendations(true);
    try {
      const tracks = await getRecommendationsForWorkout(workoutType);
      setRecommendations(tracks.slice(0, 5));
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };
  
  const handlePlayPause = async () => {
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
    try {
      await nextTrack();
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to skip track.');
    }
  };
  
  const handlePrevious = async () => {
    try {
      await previousTrack();
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to go to previous track.');
    }
  };
  
  const handleTrackPress = async (track: SpotifyTrack) => {
    try {
      await playTrack(track.uri);
      setIsPlaying(true);
    } catch (error) {
      Alert.alert('Playback Error', 'Unable to play this track.');
    }
  };
  
  const handleConnectSpotify = async () => {
    try {
      const authUrl = await getSpotifyAuthUrl();
      
      if (Platform.OS === 'web') {
        // For web, open in same window and handle callback
        const popup = window.open(authUrl, 'spotify-auth', 'width=500,height=600');
        
        // Listen for the popup to close or redirect
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Check if we have a token in localStorage (set by callback page)
            const urlFragment = localStorage.getItem('spotify_callback_fragment');
            if (urlFragment) {
              localStorage.removeItem('spotify_callback_fragment');
              connectSpotifyImplicit(urlFragment);
            }
          }
        }, 1000);
      } else {
        // For mobile, use Linking
        const supported = await Linking.canOpenURL(authUrl);
        if (supported) {
          await Linking.openURL(authUrl);
        } else {
          Alert.alert('Error', 'Unable to open Spotify authorization');
        }
      }
    } catch (error) {
      console.error('Failed to connect to Spotify:', error);
      Alert.alert('Connection Error', 'Failed to connect to Spotify. Please try again.');
    }
  };
  
  if (!isConnected) {
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
            icon={<ExternalLink size={16} color={Colors.text.inverse} />}
          />
        </View>
      </Card>
    );
  }
  
  return (
    <Card variant="elevated" style={[styles.container, style]}>
      {/* Current Track */}
      {currentTrack && (
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
                {currentTrack.artists.map(artist => artist.name).join(', ')}
              </Text>
            </View>
          </View>
          
          {/* Playback Controls */}
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
      
      {/* Workout Recommendations */}
      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>
          Recommended for {workoutType} workout
        </Text>
        
        {isLoadingRecommendations ? (
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        ) : recommendations.length > 0 ? (
          recommendations.map((track, index) => (
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
                  {track.artists.map(artist => artist.name).join(', ')}
                </Text>
              </View>
              
              <TouchableOpacity style={styles.playRecommendationButton}>
                <Play size={16} color={Colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noRecommendationsText}>
            No recommendations available
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
    fontWeight: '600',
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
    fontWeight: '600',
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
  recommendationsContainer: {
    // No additional styles needed
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '500',
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
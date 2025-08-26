import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Music, ExternalLink, User, PlayCircle, Settings } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';

export default function SpotifyIntegration() {
  const { 
    isConnected, 
    user, 
    connectSpotifyImplicit,
    disconnectSpotify 
  } = useSpotifyStore();
  
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (isConnected) {
      loadPlaylists();
    }
  }, [isConnected]);
  
  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const workoutPlaylists = await spotifyService.getWorkoutPlaylists();
      setPlaylists(workoutPlaylists.slice(0, 5)); // Show first 5
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleConnect = async () => {
    try {
      if (Platform.OS === 'web') {
        const success = await spotifyService.authenticateWithPopup();
        if (!success) {
          Alert.alert('Spotify', 'Authentication was canceled or failed.');
        }
        return;
      }
      const authUrl = spotifyService.getAuthorizationUrl();
      Alert.alert(
        'Connect Spotify',
        'You will be redirected to Spotify to authorize this app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              await Linking.openURL(authUrl);
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Spotify',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            await disconnectSpotify();
            setPlaylists([]);
          }
        }
      ]
    );
  };
  
  const openPlaylist = (playlist: any) => {
    if (playlist.external_urls?.spotify) {
      Linking.openURL(playlist.external_urls.spotify);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Spotify Integration',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text.primary,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/profile/settings')}>
              <Settings size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <Card variant="elevated" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Music size={32} color={isConnected ? '#1DB954' : Colors.text.tertiary} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isConnected ? 'Connected to Spotify' : 'Not Connected'}
              </Text>
              {user && (
                <Text style={styles.statusSubtitle}>
                  {user.display_name || user.id}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.statusActions}>
            {isConnected ? (
              <Button
                title="Disconnect"
                onPress={handleDisconnect}
                variant="outline"
                style={styles.actionButton}
                testID="disconnect-spotify-button"
              />
            ) : (
              <Button
                title="Connect Spotify"
                onPress={handleConnect}
                leftIcon={<ExternalLink size={16} color={Colors.text.inverse} />}
                style={styles.actionButton}
                testID="connect-spotify-button"
              />
            )}
          </View>
        </Card>
        
        {/* Setup Instructions */}
        {!isConnected && (
          <Card variant="outlined" style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>Setup Instructions</Text>
            <Text style={styles.instructionsText}>
              {spotifyService.getSetupInstructions()}
            </Text>
          </Card>
        )}
        
        {/* Workout Playlists */}
        {isConnected && (
          <Card variant="elevated" style={styles.playlistsCard}>
            <View style={styles.playlistsHeader}>
              <Text style={styles.playlistsTitle}>Workout Playlists</Text>
              <Button
                title="Refresh"
                onPress={loadPlaylists}
                variant="outline"
                size="small"
                disabled={loading}
              />
            </View>
            
            {loading ? (
              <Text style={styles.loadingText}>Loading playlists...</Text>
            ) : playlists.length > 0 ? (
              <View style={styles.playlistsList}>
                {playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist.id}
                    style={styles.playlistItem}
                    onPress={() => openPlaylist(playlist)}
                  >
                    <PlayCircle size={20} color={Colors.primary} />
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistName} numberOfLines={1}>
                        {playlist.name}
                      </Text>
                      <Text style={styles.playlistTracks}>
                        {playlist.tracks?.total || 0} tracks
                      </Text>
                    </View>
                    <ExternalLink size={16} color={Colors.text.tertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noPlaylistsText}>
                No workout playlists found. Try connecting to Spotify first.
              </Text>
            )}
          </Card>
        )}
        
        {/* Service Status */}
        <Card variant="outlined" style={styles.debugCard}>
          <Text style={styles.debugTitle}>Service Status</Text>
          <Text style={styles.debugText}>
            {JSON.stringify(spotifyService.getServiceStatus(), null, 2)}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  statusSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statusActions: {
    alignItems: 'flex-start',
  },
  actionButton: {
    paddingHorizontal: 24,
  },
  instructionsCard: {
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  playlistsCard: {
    marginBottom: 16,
  },
  playlistsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  playlistsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  playlistsList: {
    gap: 12,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  playlistTracks: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  noPlaylistsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  debugCard: {
    marginBottom: 16,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});
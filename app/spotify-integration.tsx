import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Music, ExternalLink, PlayCircle, Settings } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';

export default function SpotifyIntegration() {
  const { 
    isConnected, 
    user, 
    disconnectSpotify 
  } = useSpotifyStore();
  
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientCredentialsReady, setClientCredentialsReady] = useState(false);
  
  useEffect(() => {
    // Try to initialize client credentials on mount for public API access
    initClientCredentials();
  }, []);
  
  useEffect(() => {
    if (isConnected || clientCredentialsReady) {
      loadPlaylists();
    }
  }, [isConnected, clientCredentialsReady]);
  
  const initClientCredentials = async () => {
    try {
      const success = await spotifyService.initializeClientCredentials();
      setClientCredentialsReady(success);
      if (success) {
        console.log('Client Credentials initialized - public API access ready');
      }
    } catch (error) {
      console.error('Failed to init client credentials:', error);
    }
  };
  
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
      setLoading(true);
      // Use Client Credentials flow - no redirect URIs needed!
      const success = await spotifyService.initializeClientCredentials();
      if (success) {
        setClientCredentialsReady(true);
        Alert.alert('Success', 'Connected to Spotify! You can now browse playlists and get recommendations.');
        loadPlaylists();
      } else {
        Alert.alert(
          'Connection Failed', 
          'Could not connect to Spotify. Please check that EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET is set correctly in your environment variables.\n\nYou can find your Client Secret in the Spotify Developer Dashboard.'
        );
      }
    } catch (error) {
      Alert.alert('Error', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDisconnect = async () => {
    await disconnectSpotify();
    setPlaylists([]);
    setClientCredentialsReady(false);
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
            <Music size={32} color={isConnected || clientCredentialsReady ? '#1DB954' : Colors.text.tertiary} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isConnected ? 'Connected to Spotify' : clientCredentialsReady ? 'Public Access Ready' : 'Not Connected'}
              </Text>
              {user ? (
                <Text style={styles.statusSubtitle}>
                  {user.display_name || user.id}
                </Text>
              ) : clientCredentialsReady ? (
                <Text style={styles.statusSubtitle}>
                  Search & browse playlists available
                </Text>
              ) : null}
            </View>
          </View>
          
          <View style={styles.statusActions}>
            {isConnected || clientCredentialsReady ? (
              <View style={styles.buttonRow}>
                <Button
                  title="Refresh"
                  onPress={handleConnect}
                  variant="outline"
                  style={styles.actionButton}
                  disabled={loading}
                  testID="reconnect-spotify-button"
                />
                <Button
                  title="Disconnect"
                  onPress={handleDisconnect}
                  variant="outline"
                  style={[styles.actionButton, styles.disconnectButton]}
                  testID="disconnect-spotify-button"
                />
              </View>
            ) : (
              <Button
                title={loading ? "Connecting..." : "Connect to Spotify"}
                onPress={handleConnect}
                leftIcon={<Music size={16} color={Colors.text.inverse} />}
                style={styles.actionButton}
                disabled={loading}
                testID="connect-spotify-button"
              />
            )}
          </View>
        </Card>
        
        {/* Setup Instructions */}
        <Card variant="outlined" style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>
            {clientCredentialsReady ? '✅ Connected!' : 'Setup Instructions'}
          </Text>
          <Text style={styles.instructionsText}>
            {spotifyService.getSetupInstructions()}
          </Text>
        </Card>
        
        {/* Workout Playlists */}
        {(isConnected || clientCredentialsReady) && (
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  disconnectButton: {
    borderColor: '#ef4444',
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
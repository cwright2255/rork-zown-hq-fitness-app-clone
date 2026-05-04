import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Music } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import SpotifyEmbedPlayer from '@/components/SpotifyEmbedPlayer';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function SpotifyIntegrationScreen() {
  const {
    isConnected,
    user,
    initializeSpotify,
    disconnectSpotify,
  } = useSpotifyStore();

  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initializeSpotify) initializeSpotify();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!isConnected || !spotifyService?.getUserPlaylists) return;
      setLoading(true);
      try {
        const res = await spotifyService.getUserPlaylists();
        setPlaylists(res?.items || res || []);
      } catch (e) {
        console.log('playlists error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isConnected]);

  const handleConnect = async () => {
    try {
      if (spotifyService?.authorize) {
        await spotifyService.authorize();
      }
      if (initializeSpotify) await initializeSpotify();
    } catch (e) {
      Alert.alert('Spotify', 'Unable to connect.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSpotify?.();
    } catch (e) {
      Alert.alert('Spotify', 'Unable to disconnect.');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Spotify" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Music size={40} color={tokens.colors.background.default} />
          </View>
          <Text style={styles.title}>
            {isConnected ? 'Connected to Spotify' : 'Connect Spotify'}
          </Text>
          {user?.display_name ? (
            <Text style={styles.sub}>{user.display_name}</Text>
          ) : (
            <Text style={styles.sub}>
              Soundtrack your workouts with your playlists
            </Text>
          )}
        </View>

        {!isConnected ? (
          <PrimaryButton
            title="Connect with Spotify"
            variant="spotify"
            onPress={handleConnect}
          />
        ) : (
          <>
            {SpotifyEmbedPlayer ? (
              <View style={styles.embedWrap}>
                <SpotifyEmbedPlayer />
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Your Playlists</Text>
            {loading ? (
              <Text style={styles.muted}>Loadingâ¦</Text>
            ) : playlists.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.muted}>No playlists yet.</Text>
              </View>
            ) : (
              playlists.slice(0, 10).map(p => (
                <View key={p.id} style={styles.plRow}>
                  <Text style={styles.plName} numberOfLines={1}>{p.name}</Text>
                  {p.tracks?.total != null ? (
                    <Text style={styles.plMeta}>{p.tracks.total} tracks</Text>
                  ) : null}
                </View>
              ))
            )}

            <View style={{ height: 20 }} />
            <PrimaryButton
              title="Disconnect"
              variant="outline"
              onPress={handleDisconnect}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  hero: { alignItems: 'center', paddingVertical: 24 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1DB954',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { color: tokens.colors.background.default, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: '#999', fontSize: 13, marginTop: 6, textAlign: 'center' },
  embedWrap: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 12, marginTop: 12,
  },
  plRow: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  plName: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '600' },
  plMeta: { color: '#999', fontSize: 12, marginTop: 2 },
  emptyCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 24, alignItems: 'center',
  },
  muted: { color: '#999', fontSize: 13 },
});

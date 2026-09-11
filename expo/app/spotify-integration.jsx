import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Music } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import SpotifyEmbedPlayer from '@/components/SpotifyEmbedPlayer';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import { tokens } from '../../theme/tokens';



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
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Music size={40} color="#000000" />
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
              <Text style={styles.muted}>LoadingÃÂ¢ÃÂÃÂ¦</Text>
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

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. iconWrap's Spotify-brand green (#1DB954) is
// untouched - a deliberate brand color, not a theme-dependent one, so
// out of scope here.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: { alignItems: 'center', paddingVertical: 24 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1DB954',
    alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing.md,
  },
  title: { color: '#000000', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: '#999999', fontSize: 13, marginTop: 6, textAlign: 'center' },
  embedWrap: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 14, marginTop: 12,
  },
  plRow: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.md, padding: 14, marginBottom: tokens.spacing.sm,
  },
  plName: { color: '#000000', fontSize: 14, fontWeight: '600' },
  plMeta: { color: '#999999', fontSize: 12, marginTop: 2 },
  emptyCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, alignItems: 'center',
  },
  muted: { color: '#999999', fontSize: 13 },
});

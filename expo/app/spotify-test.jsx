import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { TestTube } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../theme/tokens';

export default function SpotifyTestScreen() {
  const { isConnected, user } = useSpotifyStore();
  const [results, setResults] = useState([]);

  const log = (msg) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const testAuthUrl = async () => {
    try {
      const url = spotifyService?.getAuthUrl?.();
      log(`Auth URL: ${url ? 'OK' : 'not configured'}`);
    } catch (e) {
      log(`Auth URL error: ${e.message}`);
    }
  };

  const testConnection = async () => {
    try {
      const profile = await spotifyService?.getCurrentUser?.();
      log(`Profile: ${profile?.display_name || 'none'}`);
    } catch (e) {
      log(`Profile error: ${e.message}`);
    }
  };

  const clearResults = () => setResults([]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Spotify Test" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.statusCard}>
          <View style={styles.iconWrap}>
            <TestTube size={24} color=tokens.colors.background.default />
          </View>
          <Text style={styles.title}>Connection Status</Text>
          <Text style={styles.sub}>
            {isConnected ? 'Connected' : 'Disconnected'}
            {user?.display_name ? ` Â· ${user.display_name}` : ''}
          </Text>
          <Text style={styles.sub}>Platform: {Platform.OS}</Text>
        </View>

        <Text style={styles.sectionLabel}>Tests</Text>
        <PrimaryButton title="Test Auth URL" variant="outline" onPress={testAuthUrl} />
        <View style={{ height: 8 }} />
        <PrimaryButton title="Test Connection" variant="outline" onPress={testConnection} />
        <View style={{ height: 8 }} />
        <PrimaryButton title="Clear Results" variant="ghost" onPress={clearResults} />

        <Text style={styles.sectionLabel}>Results</Text>
        <View style={styles.logCard}>
          {results.length === 0 ? (
            <Text style={styles.muted}>No test output yet.</Text>
          ) : (
            results.map((r, i) => (
              <Text key={i} style={styles.logLine}>{r}</Text>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  statusCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { color: tokens.colors.background.default, fontSize: 18, fontWeight: '700' },
  sub: { color: '#999', fontSize: 13, marginTop: 4 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 12, marginTop: 12,
  },
  logCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 14, minHeight: 120, gap: 4,
  },
  muted: { color: '#999', fontSize: 13 },
  logLine: { color: tokens.colors.background.default, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

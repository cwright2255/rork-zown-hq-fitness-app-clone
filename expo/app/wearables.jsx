import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import BottomNavigation from '@/components/BottomNavigation';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function WearablesScreen() {
  const [devices, setDevices] = useState([
    { id: '1', name: 'Apple Watch', connected: true, lastSync: '2 min ago' },
    { id: '2', name: 'Garmin Forerunner', connected: false, lastSync: null },
    { id: '3', name: 'Whoop 4.0', connected: false, lastSync: null },
  ]);

  const handleSync = (id) => {
    setDevices(devices.map(d =>
      d.id === id ? { ...d, lastSync: 'Just now' } : d
    ));
    Alert.alert('Synced', 'Device data synced.');
  };

  const toggleConnect = (id) => {
    setDevices(devices.map(d =>
      d.id === id ? { ...d, connected: !d.connected, lastSync: !d.connected ? 'Just now' : null } : d
    ));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Wearables" />
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 180 }}>
        <Text style={styles.sectionLabel}>My Devices</Text>
        {devices.map(d => (
          <View key={d.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{d.name}</Text>
                {d.lastSync ? (
                  <Text style={styles.sub}>Last sync: {d.lastSync}</Text>
                ) : null}
              </View>
              <View style={[styles.badge, d.connected ? styles.badgeConnected : styles.badgeDisconnected]}>
                <Text style={[styles.badgeText, { color: d.connected ? '#22C55E' : '#999' }]}>
                  {d.connected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              {d.connected ? (
                <TouchableOpacity onPress={() => handleSync(d.id)} style={styles.syncBtn}>
                  <Text style={styles.syncText}>Sync</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => toggleConnect(d.id)} style={styles.syncBtn}>
                <Text style={styles.syncText}>{d.connected ? 'Disconnect' : 'Connect'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          title="Connect Device"
          onPress={() => router.push('/rook-connect')}
        />
      </View>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm,
  },
  card: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: tokens.colors.dark_navy.bg_primary, fontSize: 16, fontWeight: '600' },
  sub: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 2 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  badgeConnected: { backgroundColor: 'rgba(34,197,94,0.15)' },
  badgeDisconnected: { backgroundColor: tokens.colors.dark_navy.bg_card },
  badgeText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: tokens.spacing.md, marginTop: 10 },
  syncBtn: {
    backgroundColor: tokens.colors.dark_navy.bg_card,
    paddingVertical: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, borderRadius: 999,
  },
  syncText: { color: tokens.colors.dark_navy.bg_primary, fontSize: 13, fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 100 },
});

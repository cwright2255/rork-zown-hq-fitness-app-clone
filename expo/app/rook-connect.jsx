// app/rook-connect.jsx
//
// Real device-connect screen for ROOK's REST API path (functions/src/
// index.js's getRookAuthorizerUrl/getRookConnectedSources/
// revokeRookDataSource) - deliberately separate from the native
// RookSyncGate SDK path (app/health.jsx), which has an unresolved
// Context Provider crash. This path needs no native SDK at all: Fitbit/
// Garmin/WHOOP/etc. sync to their OWN cloud, so ROOK's backend can pull
// their data server-side once the user completes a simple OAuth-style
// web connect flow. Apple Health specifically still requires the native
// SDK (on-device data, no cloud API exists for it) - not something this
// screen can offer.
//
// Field names on each item returned by getRookConnectedSources are not
// fully confirmed live yet (ROOK's REST API docs don't spell out the
// exact item shape) - reasoned from a REAL, already-confirmed sibling
// endpoint in this same codebase (getRookAuthorizerUrl's real response
// uses snake_case: `authorized`, `authorization_url`), so snake_case
// (`data_source`, `authorized`, `image_url`) is checked first, with the
// React Native SDK's documented camelCase shape (`source`, `status`,
// `imageUrl`) as a fallback. Worth confirming against a real live
// response the first time this actually runs.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { functions } from '@/src/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { appleHealthService } from '@/services/appleHealthService';

// Exact, case-sensitive list the backend validates against
// (functions/src/index.js's getRookAuthorizerUrl).
const PROVIDERS = ['Garmin', 'Oura', 'Polar', 'Fitbit', 'Withings', 'Whoop', 'Dexcom'];

function normalizeSource(item) {
  return {
    name: item.data_source ?? item.source ?? item.name ?? 'Unknown',
    authorized: item.authorized ?? item.status ?? false,
    imageUrl: item.image_url ?? item.imageUrl ?? null,
  };
}

export default function RookConnectScreen() {
  const [connecting, setConnecting] = useState(null); // which provider is mid-connect, or null
  const [connectingApple, setConnectingApple] = useState(false);
  const [appleHealthStatus, setAppleHealthStatus] = useState('unknown'); // 'unknown' | 'connected' | 'not-connected'

  useEffect(() => {
    appleHealthService.getTodayRecovery().then((data) => {
      setAppleHealthStatus(data ? 'connected' : 'not-connected');
    });
  }, []);

  const handleConnectAppleHealth = async () => {
    setConnectingApple(true);
    try {
      const available = await appleHealthService.isAvailable();
      if (!available) {
        Alert.alert('Not available', 'Apple Health is not available on this device.');
        return;
      }
      const granted = await appleHealthService.requestAuthorization();
      if (!granted) {
        Alert.alert('Connection failed', 'Could not get Apple Health authorization. Please try again.');
        return;
      }
      // HealthKit's authorization prompt doesn't tell the app which
      // specific permissions were actually granted (Apple's own privacy
      // design) - re-checking for real data is the only honest way to
      // confirm the connection actually works, same pattern rookService
      // already uses for its own connect() flow.
      const data = await appleHealthService.getTodayRecovery();
      setAppleHealthStatus(data ? 'connected' : 'not-connected');
      if (!data) {
        Alert.alert(
          'Connected, but no data yet',
          'Apple Health access was granted, but no resting heart rate or HRV samples were found. This is normal if your Apple Watch hasn\'t recorded any yet.'
        );
      }
    } catch (e) {
      Alert.alert('Connection failed', e?.message || 'Please try again.');
    } finally {
      setConnectingApple(false);
    }
  };
  const [connectedSources, setConnectedSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const loadConnectedSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const fn = httpsCallable(functions, 'getRookConnectedSources');
      const result = await fn();
      const raw = result.data?.dataSources ?? [];
      setConnectedSources(raw.map(normalizeSource));
    } catch (e) {
      console.warn('[RookConnect] loadConnectedSources error:', e?.message);
      setConnectedSources([]);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadConnectedSources();
  }, [loadConnectedSources]);

  const handleConnect = async (provider) => {
    setConnecting(provider);
    try {
      const fn = httpsCallable(functions, 'getRookAuthorizerUrl');
      const result = await fn({ dataSource: provider });
      const { authorized, authorizationUrl } = result.data || {};
      if (authorized) {
        Alert.alert('Already connected', provider + ' is already connected.');
        loadConnectedSources();
        return;
      }
      if (authorizationUrl) {
        await Linking.openURL(authorizationUrl);
      } else {
        Alert.alert('Error', 'No authorization URL was returned. Please try again.');
      }
    } catch (e) {
      Alert.alert('Connection failed', e?.message || 'Please try again.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider) => {
    setRevoking(provider);
    try {
      const fn = httpsCallable(functions, 'revokeRookDataSource');
      await fn({ dataSource: provider });
      await loadConnectedSources();
    } catch (e) {
      Alert.alert('Disconnect failed', e?.message || 'Please try again.');
    } finally {
      setRevoking(null);
    }
  };

  const connectedNames = new Set(connectedSources.filter((s) => s.authorized).map((s) => s.name));

  return (
    <View style={styles.safe}>
      <ScreenHeader title="Connect Health Data" showBack variant="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.desc}>
          Connect a wearable to sync real heart rate, HRV, and sleep data.
        </Text>

        <Text style={styles.sectionTitle}>Apple Health</Text>
        <View style={styles.sourceRow}>
          <View style={styles.sourceInfo}>
            <Ionicons
              name={appleHealthStatus === 'connected' ? 'checkmark-circle' : 'heart-outline'}
              size={18}
              color={appleHealthStatus === 'connected' ? colors.green : colors.textSecondary}
            />
            <Text style={styles.sourceName}>
              {appleHealthStatus === 'connected' ? 'Connected' : 'Not connected'}
            </Text>
          </View>
          <PrimaryButton
            title={connectingApple ? 'Connecting\u2026' : (appleHealthStatus === 'connected' ? 'Manage' : 'Connect')}
            onPress={handleConnectAppleHealth}
            loading={connectingApple}
            fullWidth={false}
            style={styles.connectBtn}
          />
        </View>

        <Text style={styles.sectionTitle}>Connected</Text>
        {loadingSources ? (
          <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: spacing.lg }} />
        ) : connectedSources.filter((s) => s.authorized).length === 0 ? (
          <Text style={styles.emptyText}>No devices connected yet.</Text>
        ) : (
          connectedSources.filter((s) => s.authorized).map((s) => (
            <View key={s.name} style={styles.sourceRow}>
              <View style={styles.sourceInfo}>
                <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                <Text style={styles.sourceName}>{s.name}</Text>
              </View>
              <Pressable
                onPress={() => handleDisconnect(s.name)}
                disabled={revoking === s.name}
              >
                <Text style={styles.disconnectText}>
                  {revoking === s.name ? 'Removing…' : 'Disconnect'}
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Available</Text>
        {PROVIDERS.filter((p) => !connectedNames.has(p)).map((provider) => (
          <View key={provider} style={styles.sourceRow}>
            <Text style={styles.sourceName}>{provider}</Text>
            <PrimaryButton
              title={connecting === provider ? 'Connecting…' : 'Connect'}
              onPress={() => handleConnect(provider)}
              loading={connecting === provider}
              disabled={connecting != null && connecting !== provider}
              fullWidth={false}
              style={styles.connectBtn}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.base, paddingBottom: spacing.xxl },
  desc: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h4, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary },
  sourceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sourceInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sourceName: { ...typography.body, color: colors.text },
  disconnectText: { ...typography.bodySmall, color: colors.red },
  connectBtn: { height: 40, paddingHorizontal: spacing.lg },
});
